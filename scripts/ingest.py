"""FERmentor ingestion entrypoint (Phase 1).

Runs source A (schedule HTML) + source B (repo OAI-PMH), joins their mentors by
canonical slug, and upserts everything into Postgres. Idempotent: re-running
upserts on the (source, ext_id) unique constraint and the mentor slug.

    python scripts/ingest.py                 # full run (A + B)
    python scripts/ingest.py --repo-limit 200
    python scripts/ingest.py --skip-repo     # schedule only
    python scripts/ingest.py --skip-schedule # repo only

Embeddings are intentionally NOT computed here (separate agent); we only fill
`embedding_text`.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Make the repo root importable so `ingestion` resolves when run as a script
# (only `core` is installed as a package).
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from core import models  # noqa: F401  (registers tables)
from core.config import settings
from core.db import SessionLocal
from core.models import CommitteeMembership, Mentor, Thesis
from ingestion.harvest_repo import RepoThesis, iter_records
from ingestion.normalize import MentorKey, make_slug, match_slug
from ingestion.parse_schedule import ScheduleThesis, parse_schedules

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = REPO_ROOT / "data"
RAW_DIR = DATA_DIR / "raw"


# --------------------------------------------------------------------------- #
# Mentor pool — built in memory, then persisted, so we can dedupe/join first.
# --------------------------------------------------------------------------- #
class MentorPool:
    """Accumulates unique mentors across both sources, joining by slug."""

    def __init__(self, fuzzy_threshold: float = 94.0) -> None:
        self._by_slug: dict[str, MentorKey] = {}
        # Every raw slug ever seen -> the canonical slug it resolved to, so the
        # thesis upsert side resolves identically (incl. fuzzy merges).
        self._canonical: dict[str, str] = {}
        self._threshold = fuzzy_threshold

    def resolve(
        self, prezime: str, ime: str, *, source: str, zavod_code: str | None = None
    ) -> str:
        """Return the canonical slug for a mentor, creating/merging as needed."""
        slug = make_slug(prezime, ime)
        if slug in self._canonical:
            key = self._by_slug[self._canonical[slug]]
        else:
            existing = match_slug(slug, self._by_slug, self._threshold)
            if existing is not None:
                key = self._by_slug[existing]
            else:
                key = MentorKey(slug=slug, prezime=prezime, ime=ime)
                self._by_slug[slug] = key
            self._canonical[slug] = key.slug
        # Schedule source carries the zavod code; never overwrite a known one.
        if zavod_code and not key.zavod_code:
            key.zavod_code = zavod_code
        key.sources.add(source)
        return key.slug

    def canonical(self, prezime: str, ime: str) -> str | None:
        """Canonical slug for an already-resolved mentor (None if never seen)."""
        return self._canonical.get(make_slug(prezime, ime))

    @property
    def mentors(self) -> dict[str, MentorKey]:
        return self._by_slug


def upsert_mentors(session: Session, pool: MentorPool) -> dict[str, int]:
    """Insert/update mentor rows; return slug -> mentor.id."""
    slug_to_id: dict[str, int] = {}
    existing = {m.slug: m for m in session.scalars(select(Mentor)).all()}
    for slug, key in pool.mentors.items():
        row = existing.get(slug)
        if row is None:
            row = Mentor(
                slug=slug,
                prezime=key.prezime,
                ime=key.ime,
                full_name=key.full_name,
                zavod_code=key.zavod_code,
            )
            session.add(row)
        else:
            row.prezime = key.prezime
            row.ime = key.ime
            row.full_name = key.full_name
            if key.zavod_code:
                row.zavod_code = key.zavod_code
        session.flush()
        slug_to_id[slug] = row.id
    return slug_to_id


# --------------------------------------------------------------------------- #
# Thesis upserts
# --------------------------------------------------------------------------- #
def _get_thesis(session: Session, source: str, ext_id: str) -> Thesis | None:
    return session.scalars(
        select(Thesis).where(Thesis.source == source, Thesis.ext_id == ext_id)
    ).one_or_none()


def upsert_schedule(
    session: Session,
    items: list[ScheduleThesis],
    slug_to_id: dict[str, int],
    pool: MentorPool,
) -> int:
    n = 0
    seen: set[str] = set()
    for item in items:
        # The source HTML contains some exact-duplicate rows; the ext_id hash
        # collapses them to a single thesis.
        if item.ext_id in seen:
            continue
        seen.add(item.ext_id)
        slug = pool.canonical(item.mentor_prezime, item.mentor_ime)
        mentor_id = slug_to_id.get(slug) if slug else None
        if mentor_id is None:
            continue  # mentor unresolved (should not happen — pool built first)
        row = _get_thesis(session, "schedule", item.ext_id)
        if row is None:
            row = Thesis(source="schedule", ext_id=item.ext_id)
            session.add(row)
        row.title_hr = item.title_hr
        row.smjer = item.smjer
        row.student_name = item.student_name
        row.thesis_type = item.thesis_type
        row.year = item.year
        row.embedding_text = item.embedding_text
        row.mentor_id = mentor_id
        n += 1
    session.flush()
    return n


def upsert_repo(
    session: Session,
    item: RepoThesis,
    slug_to_id: dict[str, int],
    pool: MentorPool,
) -> bool:
    if item.mentor_prezime is None or item.mentor_ime is None:
        return False  # no advisor -> useless for recommendation
    slug = pool.canonical(item.mentor_prezime, item.mentor_ime)
    mentor_id = slug_to_id.get(slug) if slug else None
    if mentor_id is None:
        return False

    row = _get_thesis(session, "repo", item.ext_id)
    if row is None:
        row = Thesis(source="repo", ext_id=item.ext_id)
        session.add(row)
    row.urn = item.urn
    row.title_hr = item.title_hr
    row.title_en = item.title_en
    row.abstract_hr = item.abstract_hr
    row.abstract_en = item.abstract_en
    row.keywords = item.keywords or None
    row.scientific_field = item.scientific_field
    row.thesis_type = item.thesis_type
    row.year = item.year
    row.study_programme = item.study_programme
    row.smjer = item.smjer
    row.embedding_text = item.embedding_text
    row.mentor_id = mentor_id
    session.flush()

    # Replace committee memberships for this thesis (idempotent rebuild).
    session.query(CommitteeMembership).filter_by(thesis_id=row.id).delete()
    for member in item.committee:
        cm_slug = pool.canonical(member.prezime, member.ime)
        cm_id = slug_to_id.get(cm_slug) if cm_slug else None
        if cm_id is None:
            continue
        session.add(
            CommitteeMembership(thesis_id=row.id, mentor_id=cm_id, role=member.role)
        )
    return True


def recompute_counts(session: Session) -> None:
    """Refresh n_theses_repo / n_theses_current from the theses table."""
    counts = dict(
        session.execute(
            select(Thesis.mentor_id, func.count())
            .where(Thesis.source == "repo")
            .group_by(Thesis.mentor_id)
        ).all()
    )
    current = dict(
        session.execute(
            select(Thesis.mentor_id, func.count())
            .where(Thesis.source == "schedule")
            .group_by(Thesis.mentor_id)
        ).all()
    )
    for mentor in session.scalars(select(Mentor)).all():
        mentor.n_theses_repo = counts.get(mentor.id, 0)
        mentor.n_theses_current = current.get(mentor.id, 0)
    session.flush()


# --------------------------------------------------------------------------- #
# Orchestration
# --------------------------------------------------------------------------- #
def run(
    *,
    repo_limit: int | None,
    skip_repo: bool,
    skip_schedule: bool,
    delay: float,
    refresh: bool,
) -> None:
    pool = MentorPool()

    schedule_items: list[ScheduleThesis] = []
    if not skip_schedule:
        schedule_items = parse_schedules(DATA_DIR)
        for s in schedule_items:
            pool.resolve(
                s.mentor_prezime, s.mentor_ime, source="schedule",
                zavod_code=s.zavod_code,
            )
        print(f"[schedule] parsed {len(schedule_items)} theses")

    # Harvest repo into memory first so the mentor pool is complete before the
    # join (committee members also need to resolve against the pool).
    repo_items: list[RepoThesis] = []
    if not skip_repo:
        for item in iter_records(
            settings.oai_base_url, RAW_DIR, limit=repo_limit, delay=delay,
            refresh=refresh,
        ):
            repo_items.append(item)
            if item.mentor_prezime and item.mentor_ime:
                pool.resolve(item.mentor_prezime, item.mentor_ime, source="repo")
            for cm in item.committee:
                pool.resolve(cm.prezime, cm.ime, source="repo")
        print(f"[repo] harvested {len(repo_items)} records")

    with SessionLocal() as session:
        slug_to_id = upsert_mentors(session, pool)
        print(f"[mentors] upserted {len(slug_to_id)} unique mentors")

        if schedule_items:
            n = upsert_schedule(session, schedule_items, slug_to_id, pool)
            print(f"[schedule] upserted {n} theses")

        if repo_items:
            seen_repo: set[str] = set()
            n = 0
            for item in repo_items:
                if item.ext_id in seen_repo:
                    continue
                seen_repo.add(item.ext_id)
                if upsert_repo(session, item, slug_to_id, pool):
                    n += 1
            print(f"[repo] upserted {n} theses (records with a resolvable advisor)")

        recompute_counts(session)
        session.commit()
    print("[done] ingestion complete")


def main() -> None:
    ap = argparse.ArgumentParser(description="FERmentor ingestion (sources A + B).")
    ap.add_argument("--repo-limit", type=int, default=None,
                    help="harvest at most N repo records (for fast testing)")
    ap.add_argument("--skip-repo", action="store_true", help="skip source B (repo)")
    ap.add_argument("--skip-schedule", action="store_true",
                    help="skip source A (schedule HTML)")
    ap.add_argument("--delay", type=float, default=0.4,
                    help="seconds to wait between OAI requests")
    ap.add_argument("--refresh", action="store_true",
                    help="ignore cached OAI pages and re-fetch")
    args = ap.parse_args()
    run(
        repo_limit=args.repo_limit,
        skip_repo=args.skip_repo,
        skip_schedule=args.skip_schedule,
        delay=args.delay,
        refresh=args.refresh,
    )


if __name__ == "__main__":
    main()
