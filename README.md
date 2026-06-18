# FERmentor

Web-aplikacija koja studentu FER-a, na temelju **slobodnog opisa teme**, preporučuje
**mentore** čiji se radovi najbolje poklapaju — i prikaže konkretne radove kao dokaz.

Srž je **semantičko pretraživanje** (gotov višejezični embedding model + kosinusna
sličnost), bez treniranja vlastitog modela. Sve je **besplatno / open-source**.

## Arhitektura

```
data/*.html  +  OAI-PMH (MODS)  ->  ingestion/  ->  PostgreSQL+pgvector
                                                          |
                                     recommender/  (embeddinzi + ranking)
                                                          |
                                        backend/ (FastAPI)  ->  frontend/ (React+TS)
```

- `core/` — zajednički ugovor: config, DB, ORM modeli (`models.py`), API sheme (`schemas.py`)
- `ingestion/` — parser HTML rasporeda (A) + OAI-PMH MODS harvester (B) + normalizacija mentora
- `recommender/` — embedding pipeline + rangiranje
- `backend/` — FastAPI API
- `frontend/` — React + TypeScript (Vite)
- `scripts/` — pomoćne skripte (`init_db.py`, …)

## Pokretanje (lokalno)

```bash
# 1) venv + dependencije
python -m venv .venv
.venv/Scripts/activate        # Windows
pip install -e ".[ingestion,ml,backend]"

# 2) baza (Postgres 16 + pgvector)
cp .env.example .env
docker compose up -d
python scripts/init_db.py

# 3) podaci + embeddinzi (jednom, offline)
python scripts/ingest.py                 # parsira HTML (A) + harvesta repozitorij (B)
python scripts/build_embeddings.py       # bge-m3 embeddinzi + pgvector HNSW index

# 4) pokretanje (dva terminala)
python -m uvicorn backend.app.main:app --port 8000     # backend  -> http://localhost:8000
npm --prefix frontend run dev                          # frontend -> http://localhost:5173
```

> Izvori podataka: lokalni HTML rasporedi obrana u `data/` + Repozitorij FER-a
> (OAI-PMH, `mods` format). Indeksiraju se samo metapodaci i sažeci.

## Status

MVP = mentor-recommender. Kolegiji su zaseban kasniji feature.
**Deploy se NE radi bez izričitog odobrenja.**
