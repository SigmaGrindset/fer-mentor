"""Fuzzy mentor name search.

The mentor list endpoint ranks mentors against a free-text name query that is
tolerant of:
  * word order — "Siniša Šegvić" matches stored "Šegvić, Siniša";
  * diacritics — "sinisa segvic" matches "Šegvić, Siniša";
  * small typos — "Vrodljak" matches "Vrdoljak".

The dataset is tiny (~1300 mentors), so we score every candidate in Python with
rapidfuzz; no DB extension is required.
"""
from __future__ import annotations

import unicodedata

from rapidfuzz import fuzz

from core.models import Mentor

# rapidfuzz WRatio is 0..100. Below this, a non-substring candidate is dropped.
_SCORE_THRESHOLD = 72.0


def normalize(text: str) -> str:
    """Lowercase, strip diacritics and collapse whitespace.

    e.g. "Šegvić,  Siniša" -> "segvic sinisa".
    """
    decomposed = unicodedata.normalize("NFKD", text or "")
    stripped = "".join(c for c in decomposed if not unicodedata.combining(c))
    # Drop punctuation (commas etc.) so word boundaries stay clean.
    cleaned = "".join(c if c.isalnum() or c.isspace() else " " for c in stripped)
    return " ".join(cleaned.lower().split())


def rank_mentors(mentors: list[Mentor], query: str) -> list[Mentor]:
    """Return mentors matching the name query, best match first.

    Exact substring matches rank above fuzzy ones; within each group we order by
    match score and then by prolificacy (number of theses).
    """
    nq = normalize(query)
    if not nq:
        return list(mentors)

    scored: list[tuple[int, float, int, Mentor]] = []
    for m in mentors:
        ime = normalize(m.ime)
        prezime = normalize(m.prezime)
        # Compare against both reading orders so order doesn't matter.
        forms = (f"{ime} {prezime}".strip(), f"{prezime} {ime}".strip())
        is_substring = any(nq in form for form in forms)
        score = max(fuzz.WRatio(nq, form) for form in forms)
        if not is_substring and score < _SCORE_THRESHOLD:
            continue
        n_theses = m.n_theses_repo + m.n_theses_current
        scored.append((1 if is_substring else 0, score, n_theses, m))

    scored.sort(key=lambda t: (t[0], t[1], t[2]), reverse=True)
    return [m for _, _, _, m in scored]
