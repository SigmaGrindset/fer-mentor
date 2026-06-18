"""Harvest the FER repository via OAI-PMH (MODS) — source B.

Pages are cached to `data/raw/` so re-runs never re-hit the server. Each record
yields one rich `RepoThesis` (title/abstract/keywords/committee), enough to build
a good `embedding_text` without ever touching the PDF.
"""
from __future__ import annotations

import re
import time
from collections.abc import Iterator
from dataclasses import dataclass, field
from pathlib import Path

import httpx
from lxml import etree

from .normalize import parse_name

OAI_NS = "http://www.openarchives.org/OAI/2.0/"
MODS_NS = "http://www.loc.gov/mods/v3"
ETD_NS = "http://www.ndltd.org/standards/metadata/etdms/1.0"
NS = {"oai": OAI_NS, "m": MODS_NS, "etd": ETD_NS}

USER_AGENT = (
    "FERmentor-ingest/0.1 (FER thesis-mentor recommender; "
    "academic, non-commercial; contact antoniobnoni@gmail.com)"
)

# COAR resource-type -> our normalized thesis_type.
_COAR_TYPE = {
    "bachelor thesis": "zavrsni",
    "master thesis": "diplomski",
    "doctoral thesis": "doktorski",
}


@dataclass
class CommitteeMember:
    prezime: str
    ime: str
    role: str | None  # 'chair' | 'member'


@dataclass
class RepoThesis:
    ext_id: str  # OAI header identifier
    urn: str | None
    title_hr: str | None
    title_en: str | None
    abstract_hr: str | None
    abstract_en: str | None
    keywords: list[str]
    scientific_field: str | None
    thesis_type: str | None
    year: int | None
    study_programme: str | None
    smjer: str | None
    mentor_prezime: str | None
    mentor_ime: str | None
    committee: list[CommitteeMember] = field(default_factory=list)
    embedding_text: str | None = None


# --------------------------------------------------------------------------- #
# HTTP harvesting (with on-disk page cache)
# --------------------------------------------------------------------------- #
def _page_path(raw_dir: Path, index: int) -> Path:
    return raw_dir / f"oai_page_{index:04d}.xml"


def harvest_pages(
    base_url: str,
    raw_dir: Path,
    *,
    delay: float = 0.4,
    refresh: bool = False,
) -> Iterator[bytes]:
    """Yield raw XML bytes for each ListRecords page, caching to `raw_dir`.

    Cached pages are reused unless `refresh=True`. Pagination follows the OAI
    `resumptionToken`.
    """
    raw_dir.mkdir(parents=True, exist_ok=True)
    headers = {"User-Agent": USER_AGENT}
    index = 0
    token: str | None = None
    with httpx.Client(headers=headers, timeout=120, follow_redirects=True) as client:
        while True:
            cache = _page_path(raw_dir, index)
            if cache.exists() and not refresh:
                data = cache.read_bytes()
            else:
                if token is None:
                    params = {"verb": "ListRecords", "metadataPrefix": "mods"}
                else:
                    params = {"verb": "ListRecords", "resumptionToken": token}
                resp = client.get(base_url, params=params)
                resp.raise_for_status()
                data = resp.content
                cache.write_bytes(data)
                time.sleep(delay)
            yield data

            # Decide whether to continue from this page's resumptionToken.
            tree = etree.fromstring(data)
            rt = tree.find(".//oai:resumptionToken", NS)
            token = rt.text.strip() if rt is not None and rt.text else None
            index += 1
            if not token:
                break


# --------------------------------------------------------------------------- #
# MODS parsing
# --------------------------------------------------------------------------- #
def _master_mods(record: etree._Element) -> etree._Element | None:
    """Return the master <mods> (the bibliographic record), not file mods."""
    modss = record.findall(".//m:mods", NS)
    for mm in modss:
        if mm.get("ID") == "master":
            return mm
    return modss[0] if modss else None


def _name_role(name_el: etree._Element) -> tuple[str | None, str | None]:
    """Return (loc_role, hrv_role) text for a <mods:name>."""
    loc_role = hrv_role = None
    for rt in name_el.findall(".//m:roleTerm", NS):
        txt = (rt.text or "").strip()
        if rt.get("lang") == "hrv":
            hrv_role = txt
        elif txt:
            loc_role = txt.lower()
    return loc_role, hrv_role


def _name_parts(name_el: etree._Element) -> tuple[str, str] | None:
    given = family = None
    for np in name_el.findall("m:namePart", NS):
        if np.get("type") == "given":
            given = (np.text or "").strip()
        elif np.get("type") == "family":
            family = (np.text or "").strip()
    if family and given:
        return family, given
    # Fall back to a single unstructured namePart "Prezime, Ime".
    plain = name_el.find("m:namePart[not(@type)]", NS)
    if plain is not None and plain.text:
        return parse_name(plain.text)
    return None


def _first_text(mm: etree._Element, xpath: str) -> str | None:
    el = mm.find(xpath, NS)
    if el is not None and el.text and el.text.strip():
        return el.text.strip()
    return None


def _extract_year(mm: etree._Element) -> int | None:
    """Year from any available date (dateIssued/dateCreated/dateOther defended)."""
    candidates = (
        mm.findall(".//m:dateIssued", NS)
        + mm.findall(".//m:dateCreated", NS)
        + mm.findall(".//m:originInfo/m:dateOther", NS)
        + mm.findall(".//m:recordCreationDate", NS)
    )
    for el in candidates:
        if el.text:
            m = re.search(r"(\d{4})", el.text)
            if m:
                return int(m.group(1))
    return None


def _extract_thesis_type(mm: etree._Element) -> str | None:
    for g in mm.findall("m:genre", NS):
        if g.get("authority") == "coar" and g.text:
            mapped = _COAR_TYPE.get(g.text.strip().lower())
            if mapped:
                return mapped
    # Fall back to the Croatian HRZVO label.
    for g in mm.findall("m:genre", NS):
        if g.get("authority") == "HRZVO-KR-Vrsta-publikacije" and g.get("lang") == "hrv":
            low = (g.text or "").lower()
            if "završni" in low or "zavrsni" in low:
                return "zavrsni"
            if "diplomski" in low:
                return "diplomski"
            if "doktor" in low:
                return "doktorski"
    return None


def _extract_scientific_field(mm: etree._Element) -> str | None:
    """Most specific Croatian field from the nvzz.hr classification subjects."""
    fields: list[str] = []
    for subj in mm.findall("m:subject", NS):
        if subj.get("authority") != "nvzz.hr":
            continue
        hrv = [t.text.strip() for t in subj.findall("m:topic[@lang='hrv']", NS) if t.text]
        if hrv:
            # Last topic is the most specific (e.g. "Računarstvo").
            fields.append(hrv[-1])
    if not fields:
        return None
    # Join distinct fields, preserving order.
    seen: list[str] = []
    for f in fields:
        if f not in seen:
            seen.append(f)
    return "; ".join(seen)


def _extract_keywords(mm: etree._Element) -> list[str]:
    kws: list[str] = []
    for subj in mm.findall("m:subject", NS):
        # Keyword subjects carry a lang/usage but NOT the nvzz authority.
        if subj.get("authority") == "nvzz.hr":
            continue
        for topic in subj.findall("m:topic", NS):
            if topic.text and topic.text.strip():
                kws.append(topic.text.strip())
    # Deduplicate preserving order.
    seen: list[str] = []
    for k in kws:
        if k not in seen:
            seen.append(k)
    return seen


def _build_embedding_text(t: RepoThesis) -> str:
    parts = [
        t.title_hr,
        t.title_en,
        t.abstract_hr,
        t.abstract_en,
        " ".join(t.keywords) if t.keywords else None,
    ]
    return "\n".join(p for p in parts if p)


def parse_record(record: etree._Element) -> RepoThesis | None:
    header_id_el = record.find("oai:header/oai:identifier", NS)
    if header_id_el is None or not header_id_el.text:
        return None
    ext_id = header_id_el.text.strip()

    # Deleted records carry no metadata.
    mm = _master_mods(record)
    if mm is None:
        return None

    title_hr = title_en = None
    for ti in mm.findall("m:titleInfo", NS):
        title_el = ti.find("m:title", NS)
        if title_el is None or not title_el.text:
            continue
        text = title_el.text.strip()
        lang = ti.get("lang")
        if ti.get("type") == "alternative" or lang == "eng":
            title_en = title_en or text
        else:
            title_hr = title_hr or text

    abstract_hr = abstract_en = None
    for ab in mm.findall("m:abstract", NS):
        if not ab.text:
            continue
        text = ab.text.strip()
        lang = ab.get("lang") or ab.get("{http://www.w3.org/XML/1998/namespace}lang")
        if lang == "eng" or ab.get("type") == "alternative":
            abstract_en = abstract_en or text
        else:
            abstract_hr = abstract_hr or text

    mentor_prezime = mentor_ime = None
    committee: list[CommitteeMember] = []
    for nm in mm.findall("m:name", NS):
        loc_role, hrv_role = _name_role(nm)
        if loc_role == "thesis advisor":
            parts = _name_parts(nm)
            if parts:
                mentor_prezime, mentor_ime = parts
        elif loc_role == "degree committee member":
            parts = _name_parts(nm)
            if parts:
                role = "chair" if hrv_role and "predsjednik" in hrv_role.lower() else "member"
                committee.append(CommitteeMember(parts[0], parts[1], role))

    study_programme = None
    for d in mm.findall(".//etd:discipline", NS):
        if d.get("type") == "studijski program" and d.get("lang") == "hrv" and d.text:
            study_programme = d.text.strip()
            break

    thesis = RepoThesis(
        ext_id=ext_id,
        urn=_first_text(mm, "m:identifier[@type='urn']"),
        title_hr=title_hr,
        title_en=title_en,
        abstract_hr=abstract_hr,
        abstract_en=abstract_en,
        keywords=_extract_keywords(mm),
        scientific_field=_extract_scientific_field(mm),
        thesis_type=_extract_thesis_type(mm),
        year=_extract_year(mm),
        study_programme=study_programme,
        smjer=study_programme,
        mentor_prezime=mentor_prezime,
        mentor_ime=mentor_ime,
        committee=committee,
    )
    thesis.embedding_text = _build_embedding_text(thesis) or None
    return thesis


def iter_records(
    base_url: str,
    raw_dir: Path,
    *,
    limit: int | None = None,
    delay: float = 0.4,
    refresh: bool = False,
) -> Iterator[RepoThesis]:
    """Harvest and parse repo theses, yielding at most `limit` records."""
    count = 0
    for page in harvest_pages(base_url, raw_dir, delay=delay, refresh=refresh):
        tree = etree.fromstring(page)
        for record in tree.findall(".//oai:record", NS):
            thesis = parse_record(record)
            if thesis is None:
                continue
            yield thesis
            count += 1
            if limit is not None and count >= limit:
                return
