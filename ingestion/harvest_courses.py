"""Harvest the FER course catalogue (www.fer.unizg.hr) — source for feature #2.

The main FER site returns **403** to bot User-Agents but **200** with a browser
User-Agent, so we send a realistic browser UA (same httpx approach as the OAI
harvester `harvest_repo.py`). Every fetched page is cached under
`data/raw/courses/` so re-runs never re-hit the server.

Two kinds of pages:
  - programme/profile pages (`/studiji/...`) listing courses per semester, with
    "Obavezni predmeti" (mandatory), "Izborni kolegiji" (elective) and
    "Transverzalni kolegiji" (transversal — ignored) groups;
  - course detail pages (`/predmet/<code>`) with name, outcomes and syllabus.
"""
from __future__ import annotations

import re
import time
from pathlib import Path

import httpx

BASE = "https://www.fer.unizg.hr"

# FER blocks non-browser UAs (403); a browser UA returns 200.
BROWSER_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)

# Preddiplomski programmes (code, area). 1st year is common; electives in sem 5-6.
PREDDIPLOMSKI: list[tuple[str, str]] = [
    ("fer3/racunarstvo", "Računarstvo"),
    ("fer3/eit", "EIT"),
]

DIPL_INDEX = "/studiji/diplomski_studiji"
# Diplomski area code -> display grouping.
DIPL_AREA = {"rac": "Računarstvo", "eit": "EIT", "ikt": "IKT"}


def make_client() -> httpx.Client:
    return httpx.Client(
        headers={"User-Agent": BROWSER_UA}, timeout=60, follow_redirects=True
    )


def _cache_name(path: str) -> str:
    """Map a URL path to a safe cache filename, e.g. '/predmet/asp' -> 'predmet__asp.html'."""
    slug = path.strip("/").replace("/", "__")
    slug = re.sub(r"[^A-Za-z0-9_.-]", "_", slug) or "index"
    return f"{slug}.html"


def fetch(
    client: httpx.Client,
    path: str,
    raw_dir: Path,
    *,
    refresh: bool = False,
    delay: float = 0.5,
) -> str:
    """Fetch BASE+path, caching the HTML to `raw_dir`. Returns the HTML text."""
    raw_dir.mkdir(parents=True, exist_ok=True)
    cache = raw_dir / _cache_name(path)
    if cache.exists() and not refresh:
        return cache.read_text(encoding="utf-8")
    resp = client.get(BASE + path)
    resp.raise_for_status()
    html = resp.text
    cache.write_text(html, encoding="utf-8")
    time.sleep(delay)
    return html


def try_fetch(
    client: httpx.Client, path: str, raw_dir: Path, *, refresh: bool = False
) -> str | None:
    """Like `fetch` but returns None on HTTP error (used for best-effort EN pages)."""
    try:
        return fetch(client, path, raw_dir, refresh=refresh)
    except httpx.HTTPError:
        return None


def discover_diplomski(
    client: httpx.Client, raw_dir: Path, *, refresh: bool = False
) -> list[tuple[str, str]]:
    """Discover diplomski profile pages from the index.

    Returns (programme_code, area) for each leaf profile, e.g.
    ('dipl/rac/piis', 'Računarstvo'). Area landing pages (`dipl/rac`) are
    excluded — only 3-segment leaves match.
    """
    html = fetch(client, DIPL_INDEX, raw_dir, refresh=refresh)
    codes = set(
        re.findall(r'href="/studiji/(dipl/(?:rac|eit|ikt)/[a-z0-9_]+)"', html)
    )
    out: list[tuple[str, str]] = []
    for code in sorted(codes):
        area_key = code.split("/")[1]
        out.append((code, DIPL_AREA.get(area_key, area_key.upper())))
    return out
