# FERmentor

Web-aplikacija koja studentu FER-a, na temelju **slobodnog opisa teme**, preporučuje
**mentore** čiji se radovi najbolje poklapaju — i prikaže konkretne radove kao dokaz.
Uz to preporučuje i **izborne predmete** unutar studentovog studija/profila
(feature #2, također semantičko pretraživanje).

Srž je **semantičko pretraživanje** (gotov višejezični embedding model + kosinusna
sličnost), bez treniranja vlastitog modela. Sve je **besplatno / open-source**.

## Arhitektura

```
data/*.html  +  OAI-PMH (MODS)  +  fer.unizg.hr katalog predmeta
                     |
                ingestion/  ->  PostgreSQL + pgvector
                                       |
                  recommender/  (embeddinzi + ranking, mentori i predmeti)
                                       |
                     backend/ (FastAPI)  ->  frontend/ (React+TS)
```

- `core/` — zajednički ugovor: config, DB, ORM modeli (`models.py`), API sheme (`schemas.py`)
- `ingestion/` — parser HTML rasporeda (A) + OAI-PMH MODS harvester (B) + scraper
  kataloga predmeta (C) + normalizacija mentora
- `recommender/` — embedding pipeline + rangiranje (mentori i izborni predmeti)
- `backend/` — FastAPI API (rate limiting, keširanje upita, strukturirani logovi)
- `frontend/` — React + TypeScript (Vite)
- `scripts/` — pipeline skripte: `init_db.py`, `ingest.py`, `ingest_courses.py`,
  `build_embeddings.py`, `build_course_embeddings.py`
- `tests/` — pytest testovi (ranking, API ugovor, ingestion fixturi)

## Pokretanje (lokalno)

```bash
# 1) venv + dependencije
python -m venv .venv
.venv/Scripts/activate        # Windows
pip install -e ".[ingestion,ml,backend,dev]"

# 2) baza (Postgres 16 + pgvector)
cp .env.example .env
docker compose up -d
python scripts/init_db.py

# 3) podaci + embeddinzi (jednom, offline)
python scripts/ingest.py                    # mentori: HTML raspored (A) + repozitorij (B)
python scripts/build_embeddings.py          # bge-m3 embeddinzi radova + HNSW index
python scripts/ingest_courses.py            # predmeti: FER katalog (studiji + /predmet/*)
python scripts/build_course_embeddings.py   # embeddinzi predmeta + HNSW index

# 4) pokretanje (dva terminala)
python -m uvicorn backend.app.main:app --port 8000     # backend  -> http://localhost:8000
npm --prefix frontend run dev                          # frontend -> http://localhost:5173
```

> Izvori podataka: lokalni HTML rasporedi obrana u `data/`, Repozitorij FER-a
> (OAI-PMH, `mods` format) i javni katalog predmeta na `www.fer.unizg.hr`.
> Indeksiraju se samo metapodaci, sažeci i ishodi učenja. Svaka ingestija
> zapisuje run u tablicu `ingest_runs` (vidljivo na `GET /api/meta`).

## Testovi

```bash
pytest                                   # Python: ranking, API ugovor, ingestion
npm --prefix frontend run test           # React komponente (vitest, mock API)
npm --prefix frontend run test:e2e       # Playwright: keyboard flow (mock API)
```

CI (`.github/workflows/tests.yml`) pokreće sve tri grupe na svaki push.

Sve gore navedeno radi nad *mockovima* — ništa od toga ne dokazuje da je
deployana verzija ispravna. Za to postoji zaseban smoke test nad **živim**
sustavom (Vercel + HF Space + Neon):

```bash
npm --prefix frontend run test:e2e:prod   # Playwright nad fermentor.vercel.app
```

Namjerno je izvan `testDir` glavne konfiguracije pa ga CI **ne** pokreće:
besplatni Space ima rate limit od 15 zahtjeva/min. Pokreni ga ručno nakon
deploya ili nakon osvježavanja podataka.

## Status

Live: mentor-recommender **i** preporuka izbornih predmeta (feature #2) su
implementirani i deployani — frontend na Vercelu, API na Hugging Face Spaceu.
**Deploy se NE radi bez izričitog odobrenja.**
