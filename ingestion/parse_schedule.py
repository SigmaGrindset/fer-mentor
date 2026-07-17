"""Parse the local "Raspored obrana" HTML files (source A).

These hold the *current* academic year's defences: only a title is available
per thesis (no abstract / keywords), so `embedding_text` is just the title.
"""
from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from pathlib import Path

from bs4 import BeautifulSoup, Tag

from core.ingest_log import RunStats

from .normalize import parse_name

# (filename, thesis_type) pairs. The files are valid UTF-8 despite mojibake in
# some terminals.
SCHEDULE_FILES: list[tuple[str, str]] = [
    ("Raspored obrana - Završni rad.html", "zavrsni"),
    ("Raspored obrana - Diplomski rad.html", "diplomski"),
]

CURRENT_YEAR = 2026

# Mentor cell: "Prezime,<br> Ime (ZAVOD)" — capture the trailing ZAVOD code.
_ZAVOD_RE = re.compile(r"\(([^)]+)\)\s*$")


@dataclass
class ScheduleThesis:
    ext_id: str
    title_hr: str
    smjer: str | None
    student_name: str | None
    thesis_type: str
    year: int
    # Mentor identity parsed from the cell.
    mentor_prezime: str
    mentor_ime: str
    zavod_code: str | None
    embedding_text: str


def _cell_text(td: Tag) -> str:
    """Collapse a <td> to text, turning <br> into a separator we can split on."""
    return td.get_text("\n", strip=True)


def _parse_mentor_cell(text: str) -> tuple[str, str, str | None] | None:
    """Return (prezime, ime, zavod_code) from "Prezime,<br> Ime (ZAVOD)"."""
    text = text.strip()
    if not text or text == "-":
        return None
    zavod = None
    m = _ZAVOD_RE.search(text)
    if m:
        zavod = m.group(1).strip()
        text = text[: m.start()].strip()
    parsed = parse_name(text)
    if parsed is None:
        return None
    prezime, ime = parsed
    return prezime, ime, zavod


def _make_ext_id(smjer: str, student: str, title: str) -> str:
    raw = f"{smjer}|{student}|{title}".encode("utf-8")
    return hashlib.sha1(raw).hexdigest()[:24]


def parse_file(
    path: Path, thesis_type: str, stats: RunStats | None = None
) -> list[ScheduleThesis]:
    soup = BeautifulSoup(path.read_text(encoding="utf-8"), "lxml")
    table = soup.select_one("table.v1table.table.tablesorter_tbl")
    if table is None:
        raise ValueError(f"schedule table not found in {path.name}")
    tbody = table.find("tbody")
    rows = tbody.find_all("tr") if tbody else []

    out: list[ScheduleThesis] = []
    for i, tr in enumerate(rows, start=1):
        tds = tr.find_all("td")
        # Columns: Smjer, Student, Tema, Mentor, Termin, Povjerenstvo.
        if len(tds) < 4:
            if stats:
                stats.reject(f"{path.name} row {i}: fewer than 4 cells")
            continue
        smjer = _cell_text(tds[0]) or None
        student_raw = _cell_text(tds[1])
        title = _cell_text(tds[2]).strip()
        mentor_raw = _cell_text(tds[3])

        # Skip empty / template rows (no real title or mentor).
        if not title or title == "-":
            if stats:
                stats.reject(f"{path.name} row {i}: empty title")
            continue
        mentor = _parse_mentor_cell(mentor_raw)
        if mentor is None:
            if stats:
                stats.reject(f"{path.name} row {i}: unparseable mentor cell {mentor_raw!r}")
            continue
        prezime, ime, zavod = mentor

        student_parsed = parse_name(student_raw)
        student_name = (
            f"{student_parsed[0]}, {student_parsed[1]}" if student_parsed else None
        )

        out.append(
            ScheduleThesis(
                ext_id=_make_ext_id(smjer or "", student_name or "", title),
                title_hr=title,
                smjer=smjer,
                student_name=student_name,
                thesis_type=thesis_type,
                year=CURRENT_YEAR,
                mentor_prezime=prezime,
                mentor_ime=ime,
                zavod_code=zavod,
                embedding_text=title,
            )
        )
    return out


def parse_schedules(
    data_dir: Path, stats: RunStats | None = None
) -> list[ScheduleThesis]:
    """Parse every configured schedule file under `data_dir`."""
    results: list[ScheduleThesis] = []
    for filename, thesis_type in SCHEDULE_FILES:
        path = data_dir / filename
        if not path.exists():
            raise FileNotFoundError(path)
        results.extend(parse_file(path, thesis_type, stats))
    if stats:
        stats.parsed = len(results)
    return results
