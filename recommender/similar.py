"""Similar-mentor service — importable by the backend.

`similar_mentors(session, mentor_id, ...)` represents each mentor by the
centroid (average) of their thesis embeddings and ranks all other mentors by
cosine similarity to the target mentor's centroid. Centroids are computed on
the fly in SQL — no precomputed table — and results are cached for the life of
the process, which matches how often the data can change (re-ingest + redeploy
restarts the process).

The stored vectors are L2-normalized and `<=>` (cosine distance) normalizes its
operands anyway, so the averaged centroids need no re-normalization.
"""
from __future__ import annotations

from pgvector.sqlalchemy import Vector
from sqlalchemy import bindparam, func, select
from sqlalchemy.orm import Session

from core.config import settings
from core.models import Mentor, Thesis, ThesisEmbedding
from core.schemas import SimilarMentor

# Process-lifetime cache. Growth is bounded by (mentors × distinct top_k) — a
# few thousand small lists at most. A plain dict rather than lru_cache because
# the unhashable Session argument couldn't be part of the key anyway.
_cache: dict[tuple[int, int], list[SimilarMentor]] = {}


def _centroid():
    """AVG over thesis embeddings, typed so `.cosine_distance()` is available
    on the aggregate and the result comes back as a vector."""
    return func.avg(ThesisEmbedding.embedding, type_=Vector(settings.embedding_dim))


def similar_mentors(
    session: Session, mentor_id: int, top_k: int = 6
) -> list[SimilarMentor]:
    """Mentors whose thesis corpora are closest to `mentor_id`'s.

    Args:
        session: an open SQLAlchemy session.
        mentor_id: the mentor to find neighbours for (assumed to exist).
        top_k: number of similar mentors to return.

    Returns:
        Up to `top_k` SimilarMentor objects, most similar first. Empty when the
        mentor has no embedded theses.
    """
    key = (mentor_id, top_k)
    cached = _cache.get(key)
    if cached is not None:
        return cached

    # ----- 1) Target mentor's centroid ---------------------------------------
    # Fetched separately (not one CTE) so a mentor with no embedded theses gets
    # an honest empty result instead of NULL-distance rows in arbitrary order.
    target = session.scalar(
        select(_centroid())
        .join(Thesis, Thesis.id == ThesisEmbedding.thesis_id)
        .where(Thesis.mentor_id == mentor_id)
    )
    if target is None:
        _cache[key] = []
        return []
    cvec = target.tolist() if hasattr(target, "tolist") else list(target)

    # ----- 2) Rank all other mentors by centroid distance --------------------
    # A GROUP BY aggregate can't use the HNSW index; this is one sequential pass
    # over the embeddings, paid once per (mentor, top_k) thanks to the cache.
    dist = _centroid().cosine_distance(bindparam("cvec"))
    rows = session.execute(
        select(Thesis.mentor_id, (1 - dist).label("similarity"))
        .join(ThesisEmbedding, ThesisEmbedding.thesis_id == Thesis.id)
        .where(Thesis.mentor_id != mentor_id)
        .group_by(Thesis.mentor_id)
        .order_by(dist)
        .limit(top_k),
        {"cvec": cvec},
    ).all()

    # ----- 3) Hydrate mentors in bulk, preserving rank order -----------------
    mentors = {
        m.id: m
        for m in session.scalars(
            select(Mentor).where(Mentor.id.in_([r.mentor_id for r in rows]))
        ).all()
    }
    results = [
        SimilarMentor(
            id=m.id,
            full_name=m.display_name,
            zavod_code=m.zavod_code,
            n_theses=m.n_theses_repo + m.n_theses_current,
            similarity=round(float(r.similarity), 4),
        )
        for r in rows
        if (m := mentors.get(r.mentor_id)) is not None
    ]
    _cache[key] = results
    return results
