"""Name normalization and mentor matching helpers.

The single source of truth for turning a human name ("Prezime, Ime") into a
canonical `slug` used to deduplicate and join mentors across the two sources.
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field

from rapidfuzz import fuzz, process

# Croatian-specific letters that NFKD does not decompose (đ has no combining
# form, the digraphs are ligatures). Everything else falls back to NFKD.
_CHAR_MAP = {
    "š": "s", "č": "c", "ć": "c", "ž": "z", "đ": "d",
    "Š": "s", "Č": "c", "Ć": "c", "Ž": "z", "Đ": "d",
}


def strip_diacritics(text: str) -> str:
    """Lowercase ASCII-fold a string, mapping Croatian diacritics to base letters."""
    out = []
    for ch in text:
        if ch in _CHAR_MAP:
            out.append(_CHAR_MAP[ch])
        else:
            # Decompose and drop combining marks (handles é, ü, ä, ...).
            decomposed = unicodedata.normalize("NFKD", ch)
            out.append("".join(c for c in decomposed if not unicodedata.combining(c)))
    return "".join(out).lower()


def parse_name(raw: str) -> tuple[str, str] | None:
    """Parse a "Prezime, Ime" string into (prezime, ime).

    Tolerates the schedule's "Prezime,<br>Ime" (newline/pipe separators) and
    trailing whitespace. Returns None if the input is empty or a placeholder.
    """
    if not raw:
        return None
    cleaned = re.sub(r"[\r\n\t|]+", " ", raw).strip()
    if not cleaned or cleaned == "-":
        return None
    if "," in cleaned:
        prezime, _, ime = cleaned.partition(",")
    else:
        # No comma: assume "Ime Prezime" with the last token as surname.
        parts = cleaned.split()
        if len(parts) < 2:
            return None
        ime, prezime = " ".join(parts[:-1]), parts[-1]
    prezime = re.sub(r"\s+", " ", prezime).strip()
    ime = re.sub(r"\s+", " ", ime).strip()
    if not prezime or not ime:
        return None
    return prezime, ime


def make_slug(prezime: str, ime: str) -> str:
    """Build the canonical join key, e.g. ("Škopljanac-Mačina", "Frano") ->
    "skopljanac-macina_frano"."""
    p = re.sub(r"[^a-z0-9]+", "-", strip_diacritics(prezime)).strip("-")
    i = re.sub(r"[^a-z0-9]+", "-", strip_diacritics(ime)).strip("-")
    return f"{p}_{i}"


def full_name(prezime: str, ime: str) -> str:
    return f"{prezime}, {ime}"


@dataclass
class MentorKey:
    """A normalized mentor identity accumulated while ingesting both sources."""

    slug: str
    prezime: str
    ime: str
    zavod_code: str | None = None
    n_theses_repo: int = 0
    n_theses_current: int = 0
    # Which sources contributed this mentor (for join diagnostics).
    sources: set[str] = field(default_factory=set)

    @property
    def full_name(self) -> str:
        return full_name(self.prezime, self.ime)


def match_slug(
    slug: str,
    candidates: dict[str, MentorKey],
    threshold: float = 92.0,
) -> str | None:
    """Resolve `slug` against an existing pool of mentor slugs.

    Prefers an exact match; otherwise uses RapidFuzz token_sort similarity and
    returns the best candidate slug iff it clears `threshold`. Returns None when
    nothing is close enough (caller then creates a new mentor).
    """
    if slug in candidates:
        return slug
    if not candidates:
        return None
    best = process.extractOne(
        slug, candidates.keys(), scorer=fuzz.token_sort_ratio
    )
    if best and best[1] >= threshold:
        return best[0]
    return None
