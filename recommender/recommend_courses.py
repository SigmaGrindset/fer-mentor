"""Elective-course recommender — importable by the backend.

`recommend_courses(session, query, ...)` embeds the free-text interest query,
finds the most similar courses via pgvector cosine search **restricted to the
electives the student can actually take** (their programme, `is_elective`, and
optionally a specific semester), and returns ranked `CourseRecommendation`
objects with a templated Croatian explanation.

No LLM is used — explanations come from a string template. Recency is irrelevant
for courses; the hard part is the eligibility filter, not weighting.
"""
from __future__ import annotations

import re

from sqlalchemy import bindparam, select
from sqlalchemy.orm import Session

from core.models import Course, CourseEmbedding, CourseOffering, Programme
from core.schemas import CourseRecommendation

from .embedder import encode_query
from .textmatch import matched_query_terms

# Over-fetch factor: a course may have several offerings (semesters) in one
# programme, so the joined rows out-number distinct courses; we de-dup in Python.
POOL_FACTOR = 10
SNIPPET_CHARS = 220


def _resolve_programme(
    session: Session, programme_id: int | None, programme_code: str | None
) -> Programme | None:
    if programme_id is not None:
        return session.get(Programme, programme_id)
    if programme_code is not None:
        return session.scalar(select(Programme).where(Programme.code == programme_code))
    return None


def _snippet(text: str | None) -> str | None:
    if not text:
        return None
    collapsed = re.sub(r"\s+", " ", text).strip()
    if len(collapsed) <= SNIPPET_CHARS:
        return collapsed
    return collapsed[:SNIPPET_CHARS].rsplit(" ", 1)[0] + "…"


def _explanation(ects: float | None, semester: int | None, matched: list[str]) -> str:
    bits: list[str] = []
    if ects:
        bits.append(f"{ects:g} ECTS")
    if semester:
        bits.append(f"{semester}. semestar")
    suffix = f" ({', '.join(bits)})" if bits else ""
    if matched:
        pojmovi = ", ".join(f"„{t}”" for t in matched[:3])
        return (
            f"Predloženo jer se tvoji pojmovi {pojmovi} poklapaju s ishodima "
            f"predmeta{suffix}."
        )
    return (
        "Predloženo jer se ishodi i sadržaj predmeta poklapaju s tvojim "
        f"opisom interesa{suffix}."
    )


def _profiles_offering(session: Session, course_id: int, level: str) -> list[str]:
    """Names of same-level programmes that offer this course as an elective."""
    rows = session.execute(
        select(Programme.name_hr)
        .join(CourseOffering, CourseOffering.programme_id == Programme.id)
        .where(
            CourseOffering.course_id == course_id,
            CourseOffering.is_elective.is_(True),
            Programme.level == level,
        )
        .distinct()
    ).all()
    return sorted(n for (n,) in rows)


def recommend_courses(
    session: Session,
    query: str,
    *,
    programme_id: int | None = None,
    programme_code: str | None = None,
    semester: int | None = None,
    top_k: int = 12,
) -> list[CourseRecommendation]:
    """Recommend elective courses for a free-text interest within a programme.

    Args:
        session: open SQLAlchemy session.
        query: free-text description of the student's interest.
        programme_id / programme_code: identifies the student's programme
            (exactly one should be given).
        semester: optional filter; None = all eligible semesters.
        top_k: number of courses to return.
    """
    prog = _resolve_programme(session, programme_id, programme_code)
    if prog is None:
        return []

    qvec = encode_query(query).tolist()

    # `<=>` is pgvector cosine distance (0 = identical); similarity = 1 - dist.
    # Restrict to electives offered by THIS programme (+ optional semester).
    dist = CourseEmbedding.embedding.cosine_distance(bindparam("qvec"))
    stmt = (
        select(
            Course.id,
            Course.code,
            Course.name_hr,
            Course.name_en,
            Course.ects,
            Course.outcomes,
            Course.syllabus,
            Course.url,
            CourseOffering.semester,
            (1 - dist).label("similarity"),
        )
        .join(CourseEmbedding, CourseEmbedding.course_id == Course.id)
        .join(CourseOffering, CourseOffering.course_id == Course.id)
        .where(
            CourseOffering.programme_id == prog.id,
            CourseOffering.is_elective.is_(True),
        )
        .order_by(dist)
        .limit(top_k * POOL_FACTOR)
    )
    if semester is not None:
        stmt = stmt.where(CourseOffering.semester == semester)

    rows = session.execute(stmt, {"qvec": qvec}).all()
    if not rows:
        return []

    # De-dup by course, keeping the best similarity and a representative semester.
    best: dict[int, dict] = {}
    for r in rows:
        cur = best.get(r.id)
        sim = float(r.similarity)
        if cur is None:
            best[r.id] = {
                "row": r,
                "sim": sim,
                "semesters": {r.semester} if r.semester is not None else set(),
            }
        else:
            cur["sim"] = max(cur["sim"], sim)
            if r.semester is not None:
                cur["semesters"].add(r.semester)

    ranked = sorted(best.values(), key=lambda d: d["sim"], reverse=True)[:top_k]

    results: list[CourseRecommendation] = []
    for d in ranked:
        r = d["row"]
        # Display semester: the filtered one if given, else the earliest offered.
        disp_sem = semester if semester is not None else (
            min(d["semesters"]) if d["semesters"] else None
        )
        matched = matched_query_terms(
            query, " ".join(p for p in (r.name_hr, r.name_en, r.outcomes, r.syllabus) if p)
        )[:6]
        results.append(
            CourseRecommendation(
                course_id=r.id,
                code=r.code,
                name=(r.name_hr or r.name_en or r.code).strip(),
                ects=r.ects,
                semester=disp_sem,
                score=round(d["sim"], 4),
                profiles=_profiles_offering(session, r.id, prog.level),
                outcomes_snippet=_snippet(r.outcomes),
                matched_keywords=matched,
                explanation=_explanation(r.ects, disp_sem, matched),
                url=r.url,
            )
        )
    return results
