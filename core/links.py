"""Public URL construction for source records.

Repository theses (``source == 'repo'``) carry a URN that resolves to a public
landing page on the Croatian national URN resolver. Schedule theses (current
year, title-only) are unpublished and have no public URL.
"""
from __future__ import annotations

# URN resolver landing page, e.g. https://urn.nsk.hr/urn:nbn:hr:168:939980
REPO_URN_BASE = "https://urn.nsk.hr/"


def thesis_url(source: str | None, urn: str | None) -> str | None:
    """Public landing-page URL for a thesis, or ``None`` when unavailable.

    Only repository theses with a URN resolve to a public page; schedule-source
    (current-year) theses are unpublished and return ``None``.
    """
    if source != "repo":
        return None
    if not urn or not urn.strip():
        return None
    return f"{REPO_URN_BASE}{urn.strip()}"
