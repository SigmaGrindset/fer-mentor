"""Parse FER course-catalogue HTML (programme pages + `/predmet/<code>` details).

Programme page layout (validated against the live site):
  - per-semester sections have ids ending `_<tab>_<n>` (n = 0-based semester);
  - inside a section, `div.grouptitle` headers introduce groups:
      "Obavezni predmeti"      -> mandatory
      "Izborni kolegiji (...)" -> elective   (what we recommend)
      "Transverzalni kolegiji" -> transversal (IGNORED per product decision)
  - each course is a `div.coursebox-content` with ECTS in `.leftcont` and the
    title link `span.coursetitle > a[href="/predmet/<code>"]` in `.col-11`.

Detail page: `h3`/`h4` section headings ("Ishodi učenja", "Opis kolegija",
"Nositelji"); content is the heading's following siblings up to the next heading.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from bs4 import BeautifulSoup, Tag

from core.ingest_log import RunStats


@dataclass
class CourseRow:
    code: str  # /predmet/<code>
    name: str
    ects: float | None
    semester: int | None
    is_elective: bool
    elective_group: str | None


@dataclass
class ProgrammePage:
    name_hr: str
    rows: list[CourseRow] = field(default_factory=list)


@dataclass
class CourseDetail:
    name_hr: str | None
    name_en: str | None
    ects: float | None
    nositelj: str | None
    outcomes: str | None
    syllabus: str | None


_SECTION_HREF_RE = re.compile(r"#(v1id-[\w.-]+)$")
_SEMESTER_TITLE_RE = re.compile(r"^\s*(\d+)\.\s*semestar", re.I)
_GROUP_NUM_RE = re.compile(r"\s*\(\d+\)\s*$")


def _parse_ects(text: str | None) -> float | None:
    if not text:
        return None
    m = re.search(r"(\d+(?:[.,]\d+)?)", text)
    return float(m.group(1).replace(",", ".")) if m else None


def _group_kind(title: str) -> str:
    t = title.lower()
    if "transverzaln" in t:
        return "skip"
    if "izborni" in t:
        return "elective"
    return "mandatory"  # "Obavezni predmeti" and anything else default to mandatory


def parse_programme(html: str, stats: RunStats | None = None) -> ProgrammePage:
    soup = BeautifulSoup(html, "lxml")
    h1 = soup.find("h1")
    name = (h1.get_text(" ", strip=True) if h1 else None) or (
        soup.title.get_text(strip=True) if soup.title else "?"
    )

    rows: list[CourseRow] = []
    seen: set[tuple[str, int | None]] = set()  # (code, semester) dedupe within page

    # Discover the real per-semester sections from the "N. semestar" tab nav.
    # (The page contains several independent tab widgets, so we cannot guess the
    # semester from the section id alone — we anchor on the nav titles.)
    sem_sections: list[tuple[int, Tag]] = []
    seen_ids: set[str] = set()
    for a in soup.find_all("a", href=True):
        m = _SECTION_HREF_RE.match(a["href"])
        if m is None:
            continue
        title = a.get("title") or a.get_text(" ", strip=True)
        sm = _SEMESTER_TITLE_RE.match(title or "")
        if sm is None:
            continue
        sec_id = m.group(1)
        if sec_id in seen_ids:
            continue
        sec = soup.find("div", id=sec_id)
        if sec is not None:
            seen_ids.add(sec_id)
            sem_sections.append((int(sm.group(1)), sec))

    for semester, sec in sem_sections:
        current = "mandatory"
        group_label: str | None = None
        for el in sec.descendants:
            if not isinstance(el, Tag):
                continue
            cls = el.get("class") or []
            if "grouptitle" in cls:
                gt = el.get_text(" ", strip=True)
                current = _group_kind(gt)
                group_label = _GROUP_NUM_RE.sub("", gt).strip()
                continue
            if "coursebox-content" in cls:
                if current == "skip":
                    if stats:
                        stats.warn(
                            f"semester {semester}: transversal course skipped "
                            f"({el.get_text(' ', strip=True)[:60]!r})"
                        )
                    continue
                a = el.select_one('a[href^="/predmet/"]')
                if a is None:
                    if stats:
                        stats.reject(
                            f"semester {semester}: coursebox without /predmet/ link "
                            f"({el.get_text(' ', strip=True)[:60]!r})"
                        )
                    continue
                code = a["href"].split("/predmet/", 1)[1].strip("/").split("?")[0]
                if not code or (code, semester) in seen:
                    continue
                seen.add((code, semester))
                left = el.select_one(".leftcont")
                rows.append(
                    CourseRow(
                        code=code,
                        name=a.get_text(" ", strip=True),
                        ects=_parse_ects(left.get_text(" ", strip=True) if left else None),
                        semester=semester,
                        is_elective=(current == "elective"),
                        elective_group=group_label if current == "elective" else None,
                    )
                )
    return ProgrammePage(name_hr=name, rows=rows)


def _section_after(soup: BeautifulSoup, *labels: str) -> str | None:
    """Text of the section whose h3/h4 heading equals one of `labels`.

    Collects the heading's following siblings up to the next h3/h4 heading.
    """
    for lbl in labels:
        h = soup.find(
            lambda t: t.name in ("h3", "h4") and t.get_text(strip=True) == lbl
        )
        if h is None:
            continue
        chunks: list[str] = []
        for sib in h.next_siblings:
            if isinstance(sib, Tag) and sib.name in ("h3", "h4"):
                break
            text = sib.get_text(" ", strip=True) if isinstance(sib, Tag) else str(sib).strip()
            if text:
                chunks.append(text)
        joined = " ".join(chunks).strip()
        if joined:
            return joined
    return None


def parse_detail(html: str, html_en: str | None = None) -> CourseDetail:
    soup = BeautifulSoup(html, "lxml")
    name_hr = soup.title.get_text(strip=True) if soup.title else None

    name_en = None
    if html_en:
        s2 = BeautifulSoup(html_en, "lxml")
        name_en = s2.title.get_text(strip=True) if s2.title else None

    return CourseDetail(
        name_hr=name_hr,
        name_en=name_en,
        ects=None,  # ECTS comes from the programme listing (reliable there)
        nositelj=_section_after(soup, "Nositelji", "Nositelj"),
        outcomes=_section_after(soup, "Ishodi učenja"),
        syllabus=_section_after(soup, "Opis kolegija", "Opis predmeta", "Sadržaj"),
    )


def build_embedding_text(d: CourseDetail) -> str:
    parts = [d.name_hr, d.name_en, d.outcomes, d.syllabus]
    return "\n".join(p for p in parts if p)
