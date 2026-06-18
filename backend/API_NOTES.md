# Backend API — contract notes

The frontend (in `frontend/`) is already built against these expectations. Honor them.

## Endpoints (response shapes are Pydantic models in `core/schemas.py`)
- `POST /api/recommend` — body `RecommendRequest` → `RecommendResponse`
- `GET /api/mentors/{id}` → `MentorDetail`; **return HTTP 404 (not 200/null) for an unknown id**
- `GET /api/mentors?zavod=&field=` → `MentorListResponse` (support both `zavod` and `field` query params)
- `GET /api/health` → `HealthResponse` (`{ "status": "ok" }`)

## Conventions the frontend relies on
- Errors: non-2xx responses use FastAPI's default `{ "detail": "<message>" }` body.
- **CORS:** allow the Vite dev origin `http://localhost:5173` (use `fastapi.middleware.cors.CORSMiddleware`).

## Nice-to-have (optional)
- A way to enumerate distinct `scientific_fields` and `zavod_code`s for UI facets — either a small `/api/facets` endpoint or include them where convenient. Not required for MVP.
