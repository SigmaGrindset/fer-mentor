"""FERmentor recommender: embeddings + semantic mentor recommendation.

Public surface:
  - `recommend(session, query, ...)` -> list[MentorRecommendation]  (recommend.py)
  - `encode_query(text)` / `encode_passages(texts)`                 (embedder.py)
"""
from .recommend import recommend  # noqa: F401
