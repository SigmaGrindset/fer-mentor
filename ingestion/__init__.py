"""FERmentor data-ingestion pipeline (Phase 1).

Loads two sources into Postgres and joins their mentors:
  - parse_schedule : local "Raspored obrana" HTML (current-year, title-only)
  - harvest_repo   : FER repository OAI-PMH / MODS (historical, rich metadata)
  - normalize      : name -> slug + mentor matching glue
"""
