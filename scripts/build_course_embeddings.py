"""Build pgvector embeddings for every course with `embedding_text`.

Batch-encodes course texts (name + outcomes + syllabus) with the configured
model and upserts them into `course_embeddings`, then creates an HNSW index for
fast cosine search.

    python scripts/build_course_embeddings.py --limit 50   # quick pipeline test
    python scripts/build_course_embeddings.py              # full build (idempotent)
    python scripts/build_course_embeddings.py --refresh    # re-embed everything

Idempotent: rows already present for the current model are skipped unless
`--refresh`. Safe to interrupt/resume — progress is committed per batch.
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import func, select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from core import models  # noqa: F401  (registers tables)
from core.config import settings
from core.db import SessionLocal, engine
from core.models import Course, CourseEmbedding
from recommender.embedder import encode_passages

INDEX_NAME = "ix_course_embeddings_hnsw"


def _pending_ids(session: Session, model_name: str, refresh: bool) -> list[int]:
    """IDs of courses needing an embedding, ordered shortest-text-first."""
    stmt = (
        select(Course.id)
        .where(Course.embedding_text.is_not(None))
        .where(Course.embedding_text != "")
        .order_by(func.length(Course.embedding_text), Course.id)
    )
    if not refresh:
        already = set(
            session.scalars(
                select(CourseEmbedding.course_id).where(
                    CourseEmbedding.model_name == model_name
                )
            ).all()
        )
        return [i for i in session.scalars(stmt).all() if i not in already]
    return list(session.scalars(stmt).all())


def _upsert_batch(session: Session, ids: list[int], vecs, model_name: str) -> None:
    rows = [
        {"course_id": cid, "model_name": model_name, "embedding": vec.tolist()}
        for cid, vec in zip(ids, vecs)
    ]
    stmt = pg_insert(CourseEmbedding).values(rows)
    stmt = stmt.on_conflict_do_update(
        index_elements=[CourseEmbedding.course_id],
        set_={"model_name": stmt.excluded.model_name, "embedding": stmt.excluded.embedding},
    )
    session.execute(stmt)


def build(*, limit: int | None, batch_size: int, refresh: bool) -> int:
    model_name = settings.embedding_model
    with SessionLocal() as session:
        ids = _pending_ids(session, model_name, refresh)
    if limit is not None:
        ids = ids[:limit]

    total = len(ids)
    if total == 0:
        print(f"[course-embeddings] nothing to do (model={model_name})")
        return 0

    print(
        f"[course-embeddings] model={model_name} dim={settings.embedding_dim} "
        f"to_embed={total} batch_size={batch_size} refresh={refresh}"
    )
    done = 0
    t0 = time.perf_counter()
    with SessionLocal() as session:
        for start in range(0, total, batch_size):
            chunk = ids[start : start + batch_size]
            text_by_id = dict(
                session.execute(
                    select(Course.id, Course.embedding_text).where(Course.id.in_(chunk))
                ).all()
            )
            chunk_ids = [cid for cid in chunk if cid in text_by_id]
            vecs = encode_passages(
                [text_by_id[cid] or "" for cid in chunk_ids], batch_size=batch_size
            )
            _upsert_batch(session, chunk_ids, vecs, model_name)
            session.commit()

            done += len(chunk_ids)
            elapsed = time.perf_counter() - t0
            rate = done / elapsed if elapsed else 0.0
            eta = (total - done) / rate if rate else 0.0
            print(
                f"  {done}/{total}  {rate:5.1f} docs/s  "
                f"elapsed={elapsed:6.1f}s  eta={eta:6.1f}s",
                flush=True,
            )
    print(f"[course-embeddings] done: {done} vectors in {time.perf_counter() - t0:.1f}s")
    return done


def create_index() -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                f"CREATE INDEX IF NOT EXISTS {INDEX_NAME} "
                "ON course_embeddings USING hnsw (embedding vector_cosine_ops) "
                "WITH (m = 16, ef_construction = 64)"
            )
        )
        conn.execute(text("ANALYZE course_embeddings"))
    print(f"[index] {INDEX_NAME} (HNSW, vector_cosine_ops) ready")


def main() -> None:
    ap = argparse.ArgumentParser(description="Build pgvector course embeddings.")
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--batch-size", type=int, default=32)
    ap.add_argument("--refresh", action="store_true")
    ap.add_argument("--skip-index", action="store_true")
    args = ap.parse_args()

    build(limit=args.limit, batch_size=args.batch_size, refresh=args.refresh)
    if not args.skip_index:
        create_index()


if __name__ == "__main__":
    main()
