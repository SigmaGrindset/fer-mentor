"""API routes — thin layer over the recommender and the DB.

Response models come from `core.schemas`; the recommender returns
`MentorRecommendation` objects directly.
"""
from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import distinct, func, select
from sqlalchemy.orm import Session

from core.links import thesis_url
from core.metrics import record
from core.models import Course, CourseOffering, IngestRun, Mentor, Programme, Thesis
from core.schemas import (
    CourseDetail,
    CourseRecommendRequest,
    CourseRecommendResponse,
    HealthResponse,
    IngestSourceMeta,
    MentorDetail,
    MentorListResponse,
    MentorSummary,
    MetaResponse,
    ProgrammeCatalog,
    ProgrammeOut,
    RecommendRequest,
    RecommendResponse,
    SimilarMentor,
    ThesisOut,
    ZavodOut,
)
from recommender.cache import TTLCache, normalize_query
from recommender.recommend import recommend
from recommender.recommend_courses import recommend_courses
from recommender.similar import similar_mentors

from .deps import get_db
from .name_search import rank_mentors
from .ratelimit import RECOMMEND_LIMIT, limiter

_LEVEL_ORDER = {"preddiplomski": 0, "diplomski": 1}


def _programme_out(p: Programme) -> ProgrammeOut:
    return ProgrammeOut(id=p.id, level=p.level, area=p.area, code=p.code, name=p.name_hr)

router = APIRouter(prefix="/api")

# Repeated-query caches: encoding the query with bge-m3 is the expensive step,
# so identical (normalized) queries within the TTL skip both it and the DB.
_mentor_cache = TTLCache(maxsize=256, ttl=3600)
_course_cache = TTLCache(maxsize=256, ttl=3600)


def _n_theses(m: Mentor) -> int:
    return m.n_theses_repo + m.n_theses_current


# The database collates with C.UTF-8, i.e. raw byte order, which would strand
# every č/ć/š/ž/đ surname after Z ("Šegvić" past "Zorić"). ICU's Croatian
# collation puts them in their real alphabet slots.
_HR_COLLATION = "hr-HR-x-icu"


def _mentor_order(sort: str | None):
    """ORDER BY terms for the mentor list; `id` keeps offset paging stable."""
    by_name = (
        Mentor.prezime.collate(_HR_COLLATION),
        Mentor.ime.collate(_HR_COLLATION),
        Mentor.id,
    )
    if sort == "name":
        return by_name
    # Most-active first, alphabetical within an equal thesis count.
    return ((Mentor.n_theses_repo + Mentor.n_theses_current).desc(), *by_name)


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse()


@router.get("/meta", response_model=MetaResponse)
def get_meta(db: Session = Depends(get_db)) -> MetaResponse:
    """Data freshness: the last successful ingest run per source."""
    runs = db.scalars(
        select(IngestRun)
        .where(IngestRun.status == "ok")
        # Postgres DISTINCT ON: newest finished run per source.
        .order_by(IngestRun.source, IngestRun.finished_at.desc())
        .distinct(IngestRun.source)
    ).all()
    return MetaResponse(
        sources=[
            IngestSourceMeta(
                source=r.source,
                finished_at=r.finished_at,
                records_parsed=r.records_parsed,
                records_upserted=r.records_upserted,
                records_rejected=r.records_rejected,
                n_warnings=len(r.warnings or []),
            )
            for r in runs
        ]
    )


@router.post("/recommend", response_model=RecommendResponse)
@limiter.limit(RECOMMEND_LIMIT)
def post_recommend(
    request: Request, req: RecommendRequest, db: Session = Depends(get_db)
) -> RecommendResponse:
    key = (normalize_query(req.query), req.top_k, req.zavod, req.field, req.thesis_type)
    results = _mentor_cache.get(key)
    record("cache", "miss" if results is None else "hit")
    if results is None:
        results = recommend(
            db,
            req.query,
            top_k=req.top_k,
            zavod=req.zavod,
            field=req.field,
            thesis_type=req.thesis_type,
        )
        _mentor_cache.set(key, results)
    return RecommendResponse(query=req.query, results=results)


@router.get("/zavodi", response_model=list[ZavodOut])
def list_zavodi(db: Session = Depends(get_db)) -> list[ZavodOut]:
    """Distinct departments (non-empty) with mentor counts, for the filter."""
    rows = db.execute(
        select(Mentor.zavod_code, func.count())
        .where(Mentor.zavod_code.isnot(None), Mentor.zavod_code != "")
        .group_by(Mentor.zavod_code)
        .order_by(func.count().desc(), Mentor.zavod_code)
    ).all()
    return [ZavodOut(code=code, count=count) for code, count in rows]


@router.get("/mentors", response_model=MentorListResponse)
def list_mentors(
    db: Session = Depends(get_db),
    zavod: str | None = Query(None, max_length=100),
    field: str | None = Query(None, max_length=200),
    q: str | None = Query(None, max_length=200),
    sort: Literal["name", "theses"] | None = Query(
        None,
        description=(
            "'name' = Croatian alphabetical by surname, 'theses' = most theses "
            "first. Omit for the default: best match when `q` is set, else 'theses'."
        ),
    ),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> MentorListResponse:
    filters = []
    if zavod:
        filters.append(Mentor.zavod_code == zavod)
    if field:
        filters.append(
            Mentor.id.in_(
                select(Thesis.mentor_id).where(Thesis.scientific_field.ilike(f"%{field}%"))
            )
        )

    if q and q.strip():
        # Fuzzy name search: rank all candidates in Python (tolerant of word
        # order, diacritics and small typos), then paginate the ranked list.
        candidates = db.scalars(select(Mentor).where(*filters)).all()
        ranked = rank_mentors(list(candidates), q)
        total = len(ranked)
        if sort is None:
            page = ranked[offset : offset + limit]
        else:
            # An explicit sort overrides match order. Re-order the matches in the
            # DB rather than in Python so both branches collate identically.
            page = db.scalars(
                select(Mentor)
                .where(Mentor.id.in_([m.id for m in ranked]))
                .order_by(*_mentor_order(sort))
                .limit(limit)
                .offset(offset)
            ).all()
    else:
        total = db.scalar(select(func.count(distinct(Mentor.id))).where(*filters)) or 0
        page = db.scalars(
            select(Mentor)
            .where(*filters)
            .order_by(*_mentor_order(sort))
            .limit(limit)
            .offset(offset)
        ).all()

    return MentorListResponse(
        total=total,
        mentors=[
            MentorSummary(
                id=m.id,
                full_name=m.display_name,
                zavod_code=m.zavod_code,
                n_theses=_n_theses(m),
            )
            for m in page
        ],
    )


@router.get("/mentors/{mentor_id}", response_model=MentorDetail)
def get_mentor(mentor_id: int, db: Session = Depends(get_db)) -> MentorDetail:
    m = db.get(Mentor, mentor_id)
    if m is None:
        raise HTTPException(status_code=404, detail="Mentor nije pronađen")

    theses = db.scalars(
        select(Thesis).where(Thesis.mentor_id == mentor_id).order_by(Thesis.year.desc())
    ).all()
    fields = sorted({t.scientific_field for t in theses if t.scientific_field})

    return MentorDetail(
        id=m.id,
        full_name=m.display_name,
        zavod_code=m.zavod_code,
        scientific_fields=fields,
        n_theses=_n_theses(m),
        theses=[
            ThesisOut(
                id=t.id,
                title=(t.title_hr or t.title_en or "(bez naslova)").strip(),
                year=t.year,
                thesis_type=t.thesis_type,
                scientific_field=t.scientific_field,
                keywords=t.keywords or [],
                source=t.source,
                url=thesis_url(t.source, t.urn),
            )
            for t in theses
        ],
    )


@router.get("/mentors/{mentor_id}/similar", response_model=list[SimilarMentor])
def get_similar_mentors(
    mentor_id: int,
    db: Session = Depends(get_db),
    limit: int = Query(6, ge=1, le=20),
) -> list[SimilarMentor]:
    """Mentors with the most similar thesis corpora ("Mentori sa sličnim područjima rada")."""
    if db.get(Mentor, mentor_id) is None:
        raise HTTPException(status_code=404, detail="Mentor nije pronađen")
    return similar_mentors(db, mentor_id, top_k=limit)


# --------------------------------------------------------------------------- #
# Feature #2 — elective course recommender
# --------------------------------------------------------------------------- #
@router.get("/programmes", response_model=ProgrammeCatalog)
def list_programmes(db: Session = Depends(get_db)) -> ProgrammeCatalog:
    progs = list(db.scalars(select(Programme)).all())
    progs.sort(key=lambda p: (_LEVEL_ORDER.get(p.level, 9), p.area or "", p.name_hr))
    return ProgrammeCatalog(programmes=[_programme_out(p) for p in progs])


@router.post("/courses/recommend", response_model=CourseRecommendResponse)
@limiter.limit(RECOMMEND_LIMIT)
def post_recommend_courses(
    request: Request, req: CourseRecommendRequest, db: Session = Depends(get_db)
) -> CourseRecommendResponse:
    key = (
        normalize_query(req.query),
        req.top_k,
        req.programme_id,
        req.programme_code,
        req.semester,
    )
    cached = _course_cache.get(key)
    record("cache", "miss" if cached is None else "hit")
    if cached is not None:
        results, programme = cached
    else:
        results = recommend_courses(
            db,
            req.query,
            programme_id=req.programme_id,
            programme_code=req.programme_code,
            semester=req.semester,
            top_k=req.top_k,
        )
        if req.programme_id is not None:
            prog = db.get(Programme, req.programme_id)
        else:
            prog = db.scalar(select(Programme).where(Programme.code == req.programme_code))
        programme = _programme_out(prog) if prog else None
        _course_cache.set(key, (results, programme))
    return CourseRecommendResponse(query=req.query, programme=programme, results=results)


@router.get("/courses/{code}", response_model=CourseDetail)
def get_course(code: str, db: Session = Depends(get_db)) -> CourseDetail:
    c = db.scalar(select(Course).where(Course.code == code))
    if c is None:
        raise HTTPException(status_code=404, detail="Predmet nije pronađen")
    progs = db.scalars(
        select(Programme)
        .join(CourseOffering, CourseOffering.programme_id == Programme.id)
        .where(CourseOffering.course_id == c.id)
        .distinct()
    ).all()
    return CourseDetail(
        id=c.id,
        code=c.code,
        name_hr=c.name_hr,
        name_en=c.name_en,
        ects=c.ects,
        nositelj=c.nositelj,
        outcomes=c.outcomes,
        syllabus=c.syllabus,
        url=c.url,
        programmes=[_programme_out(p) for p in progs],
    )
