# Backend API — contract notes

The frontend (in `frontend/`) is built against these expectations. Honor them.

## Endpoints (response shapes are Pydantic models in `core/schemas.py`)

### Mentors (feature #1)
- `POST /api/recommend` — body `RecommendRequest` → `RecommendResponse`; optional
  `thesis_type: "zavrsni" | "diplomski"` hard-filters which theses are searched and
  shown as evidence (omitted/null = all types, incl. doktorski)
- `GET /api/mentors?zavod=&field=&q=&sort=&limit=&offset=` → `MentorListResponse`
- `GET /api/mentors/{id}` → `MentorDetail`; **HTTP 404 (not 200/null) for an unknown id**
- `GET /api/mentors/{id}/similar?limit=` → `list[SimilarMentor]` (404 for unknown id)
- `GET /api/zavodi` → `list[ZavodOut]`

### Elective courses (feature #2)
- `GET /api/programmes` → `ProgrammeCatalog` (grouped client-side by level/area)
- `POST /api/courses/recommend` — body `CourseRecommendRequest` (query + exactly one
  of `programme_code`/`programme_id`, optional `semester`) → `CourseRecommendResponse`
- `GET /api/courses/{code}` → `CourseDetail`; 404 for an unknown code

### Ops
- `GET /api/health` → `HealthResponse` (`{ "status": "ok" }`)
- `GET /api/meta` → `MetaResponse` — last successful ingest run per source
  (schedule / repo / courses / thesis_embeddings / course_embeddings) with counts

## Limits & protection
- `query` fields: 1–500 chars (422 beyond). Free-text GET params (`q`, `field`):
  max 200 chars; `zavod`: max 100.
- Rate limiting (per client IP, in-process): 60/min default, **15/min** on the two
  POST recommend endpoints. Exceeding it returns **429** with a `detail` body.
- Repeated recommend queries (case/whitespace-insensitive, same filters) are served
  from a 1-hour in-process cache.
- DB statements are capped at 15 s (`statement_timeout`); the frontend aborts
  requests after 30 s.

## Conventions the frontend relies on
- Errors: non-2xx responses use FastAPI's default `{ "detail": "<message>" }` body
  (including the 429 above).
- **CORS:** allow the Vite dev origin `http://localhost:5173` plus the deployed
  frontend (`CORS_ORIGINS` env); `*.vercel.app` previews match by regex.

## Observability
- One JSON log line per request on stdout ("fermentor" logger): request id, path,
  status, `total_ms` + stage timings (`embed_ms`, `search_ms`, `db_ms`) and cache
  hit/miss. `LOG_LEVEL` env controls verbosity.
- Sentry error tracking activates only when `SENTRY_DSN` is set.
