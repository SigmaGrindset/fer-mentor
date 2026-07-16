"""Core recommendation service — importable by the backend.

`recommend(session, query, ...)` embeds the free-text query, finds the most
similar theses via pgvector cosine search, aggregates them per mentor with a
recency-weighted, count-damped score, and returns ranked
`MentorRecommendation` objects (with evidence theses, current-year topics and a
templated Croatian explanation).

No LLM is used anywhere — explanations come from a string template.
"""
from __future__ import annotations

from collections import namedtuple
from datetime import datetime

from sqlalchemy import bindparam, select, text
from sqlalchemy.orm import Session

from core.links import thesis_url
from core.models import Mentor, Thesis, ThesisEmbedding
from core.schemas import EvidenceThesis, MentorRecommendation

from .embedder import encode_query
from .textmatch import lexical_overlap, matched_keywords

# --------------------------------------------------------------------------- #
# Scoring knobs
# --------------------------------------------------------------------------- #
# How many theses to pull from the vector search before aggregating by mentor.
# A deeper pool means a specialist whose best work ranks lower still surfaces.
CANDIDATE_POOL = 400
# pgvector HNSW explores at most `hnsw.ef_search` candidates (default 40). With a
# larger LIMIT that default silently caps recall, so we raise it per query to
# comfortably exceed the pool. Higher = better recall, slightly slower.
HNSW_EF_SEARCH = 800
# Hybrid retrieval: final_sim = cosine + LEXICAL_WEIGHT * lexical_overlap. The
# lexical term (0..1) rewards exact-terminology/acronym hits the dense model can
# under-rank. Kept small so semantics still dominate; it only breaks near-ties.
LEXICAL_WEIGHT = 0.15
# A thesis whose (pure cosine) similarity is below this is treated as irrelevant:
# it never counts toward a mentor's score, never appears as evidence, and a
# mentor with no thesis above it is dropped (honest "no strong match" instead of
# ten lukewarm hits). Calibrated for bge-m3 on this corpus: its cosines sit in a
# narrow, high band — even gibberish tops out ~0.45 while genuine topical matches
# run 0.5–0.73 — so this mainly gates whole off-topic queries to an empty result.
RELEVANCE_FLOOR = 0.47
# Recency: newer theses weigh more. Exponential decay with a ~4-year half-life;
# ALL theses still contribute (weight never reaches 0).
RECENCY_HALF_LIFE_YEARS = 4.0
# Prolific mentors shouldn't win on volume alone. We damp the evidence sum by a
# sublinear factor of the number of matching theses: score = mean_sim_term *
# count**EVIDENCE_EXPONENT, with at most MAX_EVIDENCE theses contributing. The
# exponent is deliberately gentle so a focused mentor with a few strong matches
# isn't buried by a generalist with many weak ones.
EVIDENCE_EXPONENT = 0.25
MAX_EVIDENCE_CONTRIB = 12
# How many evidence theses to surface per mentor in the response.
EVIDENCE_SHOWN = 5

# One retrieved candidate thesis: the DB row plus its pure cosine and the
# blended (hybrid) similarity used for ranking.
_Hit = namedtuple("_Hit", ["row", "pure", "hybrid"])


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


def _explanation(
    rec_name: str, k: int, evidence: list[EvidenceThesis], matched: list[str]
) -> str:
    """Templated Croatian explanation (no LLM).

    When the query lexically overlaps the mentor's thesis keywords, name those
    shared terms; otherwise fall back to the generic semantic-similarity wording.
    """
    if not evidence:
        return f"Preporučeno na temelju semantičke sličnosti radova {rec_name}."
    top = evidence[0]
    god = f" ({top.year})" if top.year else ""
    rada = "rad" if k == 1 else ("rada" if 2 <= k <= 4 else "radova")
    if matched:
        terms = matched[:3]
        koji = "koji dijeli" if k == 1 else "koji dijele"
        pojam = "pojam" if len(terms) == 1 else "pojmove"
        pojmovi = ", ".join(f"„{t}”" for t in terms)
        return (
            f"Preporučeno jer {rec_name} ima {k} {rada} {koji} {pojam} "
            f"{pojmovi} — npr. „{top.title}”{god}."
        )
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
    thesis_type: str | None = None,
) -> list[MentorRecommendation]:
    """Recommend mentors for a free-text topic query.

    Args:
        session: an open SQLAlchemy session.
        query: free-text description of the desired thesis topic.
        top_k: number of mentors to return.
        zavod: optional Mentor.zavod_code filter (exact match).
        field: optional Thesis.scientific_field filter (case-insensitive
            substring) applied to candidate theses.
        thesis_type: optional Thesis.thesis_type hard filter (exact match,
            e.g. 'zavrsni') — non-matching theses neither score nor appear
            as evidence, and mentors without a match drop out.

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
            Thesis.keywords,
            Thesis.urn,
            Thesis.source,
            sim_expr,
        )
        .join(ThesisEmbedding, ThesisEmbedding.thesis_id == Thesis.id)
        .order_by(ThesisEmbedding.embedding.cosine_distance(bindparam("qvec")))
    )
    if field:
        stmt = stmt.where(Thesis.scientific_field.ilike(f"%{field}%"))
    if thesis_type:
        stmt = stmt.where(Thesis.thesis_type == thesis_type)
    if zavod:
        stmt = stmt.join(Mentor, Mentor.id == Thesis.mentor_id).where(
            Mentor.zavod_code == zavod
        )
    stmt = stmt.limit(CANDIDATE_POOL)

    # Raise HNSW ef_search for this transaction so the larger pool is backed by a
    # matching exploration budget (otherwise the default silently caps recall).
    session.execute(text(f"SET LOCAL hnsw.ef_search = {int(HNSW_EF_SEARCH)}"))
    rows = session.execute(stmt, {"qvec": qvec}).all()
    if not rows:
        return []

    # ----- 2) Hybrid re-rank + relevance floor, then group by mentor ---------
    # Blend dense cosine with a lexical-overlap bonus, and drop theses below the
    # floor so weak matches neither pad a mentor's score nor show as evidence.
    by_mentor: dict[int, list[_Hit]] = {}
    for r in rows:
        pure = float(r.similarity)
        if pure < RELEVANCE_FLOOR:
            continue
        doc = " ".join(
            p for p in (r.title_hr, r.title_en, " ".join(r.keywords or [])) if p
        )
        hybrid = pure + LEXICAL_WEIGHT * lexical_overlap(query, doc)
        by_mentor.setdefault(r.mentor_id, []).append(_Hit(r, pure, hybrid))

    if not by_mentor:
        return []

    # ----- 3) Score each mentor (on the hybrid similarity) -------------------
    scored: list[tuple[float, int, list[_Hit]]] = []
    for mentor_id, hits in by_mentor.items():
        sims = [h.hybrid for h in hits]
        weights = [_recency_weight(h.row.year, now_year) for h in hits]
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
        # Same type filter as the search: a završni student shouldn't be shown
        # this year's diplomski topics (schedule theses are cleanly typed).
        topics_stmt = (
            select(Thesis.mentor_id, Thesis.title_hr, Thesis.title_en)
            .where(Thesis.mentor_id.in_(mentor_ids))
            .where(Thesis.source == "schedule")
        )
        if thesis_type:
            topics_stmt = topics_stmt.where(Thesis.thesis_type == thesis_type)
        for tid_mentor, title_hr, title_en in session.execute(topics_stmt).all():
            title = (title_hr or title_en or "").strip()
            if title:
                current_topics[tid_mentor].append(title)

    # ----- 5) Build response objects -----------------------------------------
    results: list[MentorRecommendation] = []
    for score, mentor_id, hits in scored:
        mentor = mentors.get(mentor_id)
        if mentor is None:
            continue
        # Order evidence by the hybrid relevance, but show the honest cosine.
        hits_sorted = sorted(hits, key=lambda h: h.hybrid, reverse=True)
        evidence = [
            EvidenceThesis(
                id=h.row.id,
                title=(h.row.title_hr or h.row.title_en or "").strip() or "(bez naslova)",
                year=h.row.year,
                thesis_type=h.row.thesis_type,
                similarity=round(h.pure, 4),
                url=thesis_url(h.row.source, h.row.urn),
            )
            for h in hits_sorted[:EVIDENCE_SHOWN]
        ]
        all_keywords = [kw for h in hits_sorted for kw in (h.row.keywords or [])]
        matched = matched_keywords(query, all_keywords)[:6]
        # Count for the explanation. When we name shared concepts, count only the
        # theses that actually carry one (so "ima N radova koji dijele pojmove …"
        # is literally true); otherwise report all semantically-similar hits.
        if matched:
            n_explain = sum(
                1 for h in hits_sorted if matched_keywords(query, h.row.keywords or [])
            )
        else:
            n_explain = len(hits)
        results.append(
            MentorRecommendation(
                mentor_id=mentor.id,
                full_name=mentor.display_name,
                zavod_code=mentor.zavod_code,
                score=round(score, 4),
                n_theses=mentor.n_theses_repo + mentor.n_theses_current,
                evidence=evidence,
                current_topics=current_topics.get(mentor_id, [])[:10],
                explanation=_explanation(mentor.display_name, n_explain, evidence, matched),
                matched_keywords=matched,
            )
        )
    return results
