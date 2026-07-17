"""Ingest the FER course catalogue into `programmes`, `courses`, `course_offerings`.

Two passes:
  1) listing  — crawl each programme/profile page, upsert the Programme, and one
     CourseOffering per (course, programme, semester) with its is_elective flag;
  2) detail   — fetch each unique `/predmet/<code>` page once and fill the Course
     with name / outcomes / syllabus / nositelj + the embedding_text.

Idempotent (safe to re-run); pages are cached on disk by the harvester.

    .venv/Scripts/python.exe scripts/ingest_courses.py
    .venv/Scripts/python.exe scripts/ingest_courses.py --skip-detail   # quick structure-only
    .venv/Scripts/python.exe scripts/ingest_courses.py --limit 30      # detail for 30 courses
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from core import models  # noqa: F401  (registers tables)
from core.db import SessionLocal
from core.ingest_log import ingest_run
from core.models import Course, CourseOffering, Programme
from ingestion.harvest_courses import (
    BASE,
    PREDDIPLOMSKI,
    discover_diplomski,
    fetch,
    make_client,
    try_fetch,
)
from ingestion.parse_courses import build_embedding_text, parse_detail, parse_programme

RAW_DIR = Path(__file__).resolve().parent.parent / "data" / "raw" / "courses"


def _get_or_create_programme(
    session: Session, code: str, level: str, area: str, name_hr: str
) -> Programme:
    prog = session.scalar(select(Programme).where(Programme.code == code))
    if prog is None:
        prog = Programme(code=code, level=level, area=area, name_hr=name_hr)
        session.add(prog)
        session.flush()
    else:
        prog.level, prog.area = level, area
        if name_hr:
            prog.name_hr = name_hr
    return prog


def _get_or_create_course(
    session: Session, code: str, name: str, ects: float | None
) -> Course:
    c = session.scalar(select(Course).where(Course.code == code))
    if c is None:
        c = Course(code=code, name_hr=name, ects=ects, url=f"{BASE}/predmet/{code}")
        session.add(c)
        session.flush()
    else:
        if not c.name_hr and name:
            c.name_hr = name
        if c.ects is None and ects is not None:
            c.ects = ects
        if not c.url:
            c.url = f"{BASE}/predmet/{code}"
    return c


def _upsert_offering(
    session: Session,
    course_id: int,
    programme_id: int,
    semester: int | None,
    is_elective: bool,
    group: str | None,
) -> None:
    ex = session.scalar(
        select(CourseOffering).where(
            CourseOffering.course_id == course_id,
            CourseOffering.programme_id == programme_id,
            CourseOffering.semester == semester,
        )
    )
    if ex is None:
        session.add(
            CourseOffering(
                course_id=course_id,
                programme_id=programme_id,
                semester=semester,
                is_elective=is_elective,
                elective_group=group,
            )
        )
    else:
        ex.is_elective = is_elective
        ex.elective_group = group


def ingest(*, refresh: bool, skip_detail: bool, limit: int | None, with_en: bool, delay: float) -> None:
    with ingest_run("courses") as stats:
        _ingest(
            stats,
            refresh=refresh,
            skip_detail=skip_detail,
            limit=limit,
            with_en=with_en,
            delay=delay,
        )


def _ingest(stats, *, refresh: bool, skip_detail: bool, limit: int | None, with_en: bool, delay: float) -> None:
    client = make_client()

    programmes: list[tuple[str, str, str]] = [  # (code, area, level)
        (code, area, "preddiplomski") for code, area in PREDDIPLOMSKI
    ]
    for code, area in discover_diplomski(client, RAW_DIR, refresh=refresh):
        programmes.append((code, area, "diplomski"))
    print(f"[ingest] programmes to crawl: {len(programmes)}")

    course_codes: set[str] = set()

    # ----- Pass 1: listing (programmes + offerings) --------------------------
    with SessionLocal() as session:
        for code, area, level in programmes:
            html = fetch(client, f"/studiji/{code}", RAW_DIR, refresh=refresh, delay=delay)
            page = parse_programme(html, stats)
            prog = _get_or_create_programme(session, code, level, area, page.name_hr)
            n_elec = 0
            for row in page.rows:
                course = _get_or_create_course(session, row.code, row.name, row.ects)
                _upsert_offering(
                    session, course.id, prog.id, row.semester, row.is_elective, row.elective_group
                )
                course_codes.add(row.code)
                n_elec += int(row.is_elective)
            stats.parsed += len(page.rows)
            stats.upserted += len(page.rows)
            session.commit()
            print(f"  {code:24s} {level:13s} courses={len(page.rows):3d} elective={n_elec:3d}  [{page.name_hr}]")

    # ----- Pass 2: detail (course content + embedding_text) ------------------
    if not skip_detail:
        codes = sorted(course_codes)
        if limit is not None:
            codes = codes[:limit]
        print(f"[ingest] fetching detail for {len(codes)} courses (with_en={with_en})")
        with SessionLocal() as session:
            for i, code in enumerate(codes, 1):
                html = fetch(client, f"/predmet/{code}", RAW_DIR, refresh=refresh, delay=delay)
                html_en = (
                    try_fetch(client, f"/en/course/{code}", RAW_DIR, refresh=refresh)
                    if with_en
                    else None
                )
                d = parse_detail(html, html_en)
                c = session.scalar(select(Course).where(Course.code == code))
                if c is None:
                    stats.reject(f"detail {code}: no matching course row from pass 1")
                    continue
                if d.name_hr:
                    c.name_hr = d.name_hr
                if d.name_en:
                    c.name_en = d.name_en
                c.nositelj = d.nositelj
                c.outcomes = d.outcomes
                c.syllabus = d.syllabus
                c.url = f"{BASE}/predmet/{code}"
                c.embedding_text = build_embedding_text(d) or None
                if i % 25 == 0:
                    session.commit()
                    print(f"  detail {i}/{len(codes)}", flush=True)
            session.commit()

    _summary()


def _summary() -> None:
    with SessionLocal() as session:
        n_prog = session.scalar(select(func.count(Programme.id)))
        n_course = session.scalar(select(func.count(Course.id)))
        n_off = session.scalar(select(func.count(CourseOffering.id)))
        n_elec = session.scalar(
            select(func.count(CourseOffering.id)).where(CourseOffering.is_elective.is_(True))
        )
        n_text = session.scalar(
            select(func.count(Course.id)).where(Course.embedding_text.is_not(None))
        )
        print(
            f"\n[summary] programmes={n_prog} courses={n_course} offerings={n_off} "
            f"elective_offerings={n_elec} courses_with_text={n_text}"
        )

        # One course offered as an elective across multiple programmes.
        rows = session.execute(
            select(Course.code, func.count(CourseOffering.id).label("n"))
            .join(CourseOffering, CourseOffering.course_id == Course.id)
            .where(CourseOffering.is_elective.is_(True))
            .group_by(Course.code)
            .order_by(func.count(CourseOffering.id).desc())
            .limit(1)
        ).all()
        if rows:
            code, n = rows[0]
            course = session.scalar(select(Course).where(Course.code == code))
            progs = session.execute(
                select(Programme.name_hr)
                .join(CourseOffering, CourseOffering.programme_id == Programme.id)
                .where(CourseOffering.course_id == course.id, CourseOffering.is_elective.is_(True))
            ).all()
            names = sorted({p[0] for p in progs})
            print(
                f"[shared elective] '{course.name_hr}' ({code}) is elective in {n} "
                f"programmes, e.g.: {', '.join(names[:6])}"
            )


def main() -> None:
    ap = argparse.ArgumentParser(description="Ingest FER course catalogue.")
    ap.add_argument("--refresh", action="store_true", help="ignore cache, re-fetch pages")
    ap.add_argument("--skip-detail", action="store_true", help="programmes+offerings only")
    ap.add_argument("--limit", type=int, default=None, help="detail for at most N courses")
    ap.add_argument("--with-en", action="store_true", help="also fetch EN course names")
    ap.add_argument("--delay", type=float, default=0.5, help="seconds between requests")
    args = ap.parse_args()

    ingest(
        refresh=args.refresh,
        skip_detail=args.skip_detail,
        limit=args.limit,
        with_en=args.with_en,
        delay=args.delay,
    )


if __name__ == "__main__":
    main()
