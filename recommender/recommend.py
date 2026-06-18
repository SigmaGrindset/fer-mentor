"""Core recommendation service — importable by the backend.

`recommend(session, query, ...)` embeds the free-text query, finds the most
similar theses via pgvector cosine search, aggregates them per mentor with a
recency-weighted, count-damped score, and returns ranked
`MentorRecommendation` objects (with evidence theses, current-year topics and a
templated Croatian explanation).

No LLM is used anywhere — explanations come from a string template.
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import bindparam, select
from sqlalchemy.orm import Session

from core.models import Mentor, Thesis, ThesisEmbedding
from core.schemas import EvidenceThesis, MentorRecommendation

from .embedder import encode_query

# --------------------------------------------------------------------------- #
# Scoring knobs
# --------------------------------------------------------------------------- #
# How many theses to pull from the vector search before aggregating by mentor.
CANDIDATE_POOL = 200
# Recency: newer theses weigh more. Exponential decay with a ~4-year half-life;
# ALL theses still contribute (weight never reaches 0).
RECENCY_HALF_LIFE_YEARS = 4.0
# Prolific mentors shouldn't win on volume alone. We damp the evidence sum by a
# sublinear factor of the number of matching theses: score = mean_sim_term *
# count**EVIDENCE_EXPONENT, with at most MAX_EVIDENCE theses contributing.
EVIDENCE_EXPONENT = 0.35
MAX_EVIDENCE_CONTRIB = 12
# How many evidence theses to surface per mentor in the response.
EVIDENCE_SHOWN = 5


def _recency_weight(year: int | None, now_year: int) -> float:
    if year is None:
        return 0.5  # unknown year: middling weight, still contributes
    age = max(0, now_year - year)
    return 0.5 ** (age / RECENCY_HALF_LIFE_YEARS)


def _mentor_score(sims: list[float], weights: list[float]) -> float:
    """Blend per-thesis relevance with a dampened bit of evidence volume.

    Take the recency-weighted similarities (best first), keep the strongest
    MAX_EVIDENCE_CONTRIB, average them, then nudge up by a sublinear function of
    how many strong matches the mentor has. This rewards both quality and a
    little volume without letting prolific mentors dominate purely by count.
    """
    pairs = sorted(zip(sims, weights), key=lambda p: p[0] * p[1], reverse=True)
    pairs = pairs[:MAX_EVIDENCE_CONTRIB]
    weighted = [s * w for s, w in pairs]
    if not weighted:
        return 0.0
    mean_term = sum(weighted) / len(weighted)
    volume_factor = len(weighted) ** EVIDENCE_EXPONENT
    return mean_term * volume_factor


def _explanation(rec_name: str, k: int, evidence: list[EvidenceThesis]) -> str:
    """Templated Croatian explanation (no LLM)."""
    if not evidence:
        return f"Preporučeno na temelju semantičke sličnosti radova {rec_name}."
    top = evidence[0]
    god = f" ({top.year})" if top.year else ""
    rada = "rad" if k == 1 else ("rada" if 2 <= k <= 4 else "radova")
    return (
        f"Preporučeno jer {rec_name} ima {k} {rada} na sličnu temu, "
        f"npr. „{top.title}”{god}."
    )


def recommend(
    session: Session,
    query: str,
    top_k: int = 10,
    zavod: str | None = None,
    field: str | None = None,
) -> list[MentorRecommendation]:
    """Recommend mentors for a free-text topic query.

    Args:
        session: an open SQLAlchemy session.
        query: free-text description of the desired thesis topic.
        top_k: number of mentors to return.
        zavod: optional Mentor.zavod_code filter (exact match).
        field: optional Thesis.scientific_field filter (case-insensitive
            substring) applied to candidate theses.

    Returns:
        Up to `top_k` MentorRecommendation objects, sorted by score desc.
    """
    qvec = encode_query(query).tolist()
    now_year = datetime.now().year

    # ----- 1) Vector nearest-neighbour search over theses --------------------
    # `<=>` is pgvector cosine distance (0 = identical); similarity = 1 - dist.
    # We over-fetch CANDIDATE_POOL so per-mentor aggregation has enough signal.
    sim_expr = (
        1 - ThesisEmbedding.embedding.cosine_distance(bindparam("qvec"))
    ).label("similarity")
    stmt = (
        select(
            Thesis.id,
            Thesis.mentor_id,
            Thesis.title_hr,
            Thesis.title_en,
            Thesis.year,
            Thesis.thesis_type,
            sim_expr,
        )
        .join(ThesisEmbedding, ThesisEmbedding.thesis_id == Thesis.id)
        .order_by(ThesisEmbedding.embedding.cosine_distance(bindparam("qvec")))
    )
    if field:
        stmt = stmt.where(Thesis.scientific_field.ilike(f"%{field}%"))
    if zavod:
        stmt = stmt.join(Mentor, Mentor.id == Thesis.mentor_id).where(
            Mentor.zavod_code == zavod
        )
    stmt = stmt.limit(CANDIDATE_POOL)

    rows = session.execute(stmt, {"qvec": qvec}).all()
    if not rows:
        return []

    # ----- 2) Aggregate candidates by mentor ---------------------------------
    by_mentor: dict[int, list] = {}
    for r in rows:
        by_mentor.setdefault(r.mentor_id, []).append(r)

    # ----- 3) Score each mentor ----------------------------------------------
    scored: list[tuple[float, int, list]] = []
    for mentor_id, hits in by_mentor.items():
        sims = [float(h.similarity) for h in hits]
        weights = [_recency_weight(h.year, now_year) for h in hits]
        score = _mentor_score(sims, weights)
        scored.append((score, mentor_id, hits))
    scored.sort(key=lambda x: x[0], reverse=True)
    scored = scored[:top_k]

    # ----- 4) Hydrate mentors + current-year topics in bulk ------------------
    mentor_ids = [mid for _, mid, _ in scored]
    mentors = {
        m.id: m
        for m in session.scalars(select(Mentor).where(Mentor.id.in_(mentor_ids))).all()
    }
    current_topics: dict[int, list[str]] = {mid: [] for mid in mentor_ids}
    if mentor_ids:
        for tid_mentor, title_hr, title_en in session.execute(
            select(Thesis.mentor_id, Thesis.title_hr, Thesis.title_en)
            .where(Thesis.mentor_id.in_(mentor_ids))
            .where(Thesis.source == "schedule")
        ).all():
            title = (title_hr or title_en or "").strip()
            if title:
                current_topics[tid_mentor].append(title)

    # ----- 5) Build response objects -----------------------------------------
    results: list[MentorRecommendation] = []
    for score, mentor_id, hits in scored:
        mentor = mentors.get(mentor_id)
        if mentor is None:
            continue
        hits_sorted = sorted(hits, key=lambda h: float(h.similarity), reverse=True)
        evidence = [
            EvidenceThesis(
                id=h.id,
                title=(h.title_hr or h.title_en or "").strip() or "(bez naslova)",
                year=h.year,
                thesis_type=h.thesis_type,
                similarity=round(float(h.similarity), 4),
            )
            for h in hits_sorted[:EVIDENCE_SHOWN]
        ]
        n_matching = len(hits)
        results.append(
            MentorRecommendation(
                mentor_id=mentor.id,
                full_name=mentor.display_name,
                zavod_code=mentor.zavod_code,
                score=round(score, 4),
                n_theses=mentor.n_theses_repo + mentor.n_theses_current,
                evidence=evidence,
                current_topics=current_topics.get(mentor_id, [])[:10],
                explanation=_explanation(mentor.display_name, n_matching, evidence),
            )
        )
    return results
