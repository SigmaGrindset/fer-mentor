"""Lightweight, LLM-free term matching for templated explanations.

Croatian-aware-ish: lowercase + strip diacritics, tokenize on letters/digits,
drop stopwords and very short tokens. Matching is tolerant of light inflection
(a shared prefix counts as a match for tokens of length >= 4), which copes with
Croatian case endings without any stemmer or model.

Two entry points, by matching direction:
  - `matched_keywords(query, keywords)` — which of a thesis's structured
    keyword phrases the free-text query covers (returns the phrases).
  - `matched_query_terms(query, text)` — which of the query's content words
    appear in a course's free-text outcomes/syllabus (returns the query words).
"""
from __future__ import annotations

import re
import unicodedata
from collections.abc import Iterable

# Letter/digit runs only (drops punctuation, whitespace, underscores).
_TOKEN_RE = re.compile(r"[^\W_]+", re.UNICODE)
# Tokens shorter than this carry little topical signal ("u", "na", "ai").
_MIN_LEN = 3
# Inflection tolerance: two tokens match when they share a long-enough stem.
# Croatian case endings usually differ only in the last character(s), so we
# compare the longest common prefix against the shorter token's length.
_PREFIX_MIN = 4
_PREFIX_LEN_SLACK = 1


def normalize(text: str) -> str:
    """Lowercase and strip diacritics (č→c, ž→z, š→s, ć→c, đ→d)."""
    lowered = text.lower().replace("đ", "d").replace("ð", "d")
    nfkd = unicodedata.normalize("NFKD", lowered)
    return "".join(c for c in nfkd if not unicodedata.combining(c))


# Croatian + English function words and generic FERmentor filler ("sustav",
# "razvoj", ...) that add noise but no topic. Stored normalized (no diacritics).
_RAW_STOPWORDS = {
    # hr function words
    "i", "ili", "te", "pa", "ali", "no", "kao", "za", "na", "od", "do", "iz",
    "sa", "se", "su", "je", "li", "da", "ne", "što", "koji", "koja", "koje",
    "kojom", "čiji", "gdje", "kada", "kako", "ovaj", "ova", "ovo", "taj", "to",
    "neki", "neka", "neko", "moj", "moja", "moje", "tvoj", "svoj", "bih", "biti",
    "želim", "htio", "htjela", "raditi", "rad", "tema", "temu", "nešto",
    # generic, high-frequency / low-signal nouns
    "sustav", "sustava", "razvoj", "izrada", "implementacija", "analiza",
    "primjena", "primjene", "pomoću", "temelju", "korištenjem", "metode",
    "metoda", "model", "modela",
    # en function words (queries/titles sometimes mix languages)
    "the", "and", "for", "with", "using", "based", "system", "development",
    "analysis", "application", "from", "this", "that",
}
HR_STOPWORDS: set[str] = {normalize(w) for w in _RAW_STOPWORDS}


def _content_pairs(text: str | None) -> list[tuple[str, str]]:
    """(original_surface, normalized) content tokens — ordered, deduped by norm."""
    if not text:
        return []
    out: list[tuple[str, str]] = []
    seen: set[str] = set()
    for m in _TOKEN_RE.finditer(text):
        orig = m.group()
        norm = normalize(orig)
        if len(norm) < _MIN_LEN or norm.isdigit() or norm in HR_STOPWORDS or norm in seen:
            continue
        seen.add(norm)
        out.append((orig, norm))
    return out


def content_terms(text: str | None) -> list[str]:
    """Ordered, de-duplicated normalized content tokens (stopwords removed)."""
    return [norm for _, norm in _content_pairs(text)]


def _shared_prefix_len(a: str, b: str) -> int:
    n = 0
    for ca, cb in zip(a, b):
        if ca != cb:
            break
        n += 1
    return n


def _token_match(token: str, vocab: set[str]) -> bool:
    """True if `token` equals, or shares a long-enough stem with, any vocab term.

    A stem match requires the longest common prefix to cover (almost) all of the
    shorter token, so only the trailing case ending may differ.
    """
    if token in vocab:
        return True
    if len(token) < _PREFIX_MIN:
        return False
    for v in vocab:
        if len(v) < _PREFIX_MIN:
            continue
        lcp = _shared_prefix_len(token, v)
        if lcp >= _PREFIX_MIN and lcp >= min(len(token), len(v)) - _PREFIX_LEN_SLACK:
            return True
    return False


def matched_keywords(query: str, keywords: Iterable[str]) -> list[str]:
    """Keyword phrases that the free-text query covers, in their readable form.

    A phrase matches when at least one of its content tokens overlaps a query
    content token (prefix-tolerant). Order follows `keywords`; duplicates
    (case/diacritic-insensitive) are removed.
    """
    qvocab = set(content_terms(query))
    if not qvocab:
        return []
    out: list[str] = []
    seen: set[str] = set()
    for kw in keywords:
        if not kw or not kw.strip():
            continue
        key = normalize(kw).strip()
        if key in seen:
            continue
        kw_tokens = content_terms(kw)
        if kw_tokens and any(_token_match(t, qvocab) for t in kw_tokens):
            seen.add(key)
            out.append(kw.strip())
    return out


def matched_query_terms(query: str, text: str | None) -> list[str]:
    """Query content words that appear in `text`, in the query's readable form."""
    tvocab = set(content_terms(text))
    if not tvocab:
        return []
    out: list[str] = []
    seen: set[str] = set()
    for orig, norm in _content_pairs(query):
        if norm in seen:
            continue
        if _token_match(norm, tvocab):
            seen.add(norm)
            out.append(orig)
    return out


def lexical_overlap(query: str, text: str | None) -> float:
    """Fraction of the query's content terms that also appear in `text`, 0..1.

    A cheap lexical retrieval signal to blend with dense (vector) similarity:
    it rewards exact-terminology hits — acronyms and specific terms like "FPGA"
    or "reinforcement learning" — that pure semantic search can under-rank. Uses
    the same diacritic-insensitive, prefix-tolerant matcher as the explanations,
    so Croatian inflection ("vid"/"vida") still counts. Returns 0 when the query
    carries no content terms (all stopwords) or `text` is empty.
    """
    q_terms = set(content_terms(query))
    if not q_terms:
        return 0.0
    return len(matched_query_terms(query, text)) / len(q_terms)
