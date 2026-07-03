"""FERmentor FastAPI application."""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import settings

from .routes import router

app = FastAPI(title="FERmentor API", version="0.1.0")

# Allowed origins come from config (CORS_ORIGINS env); Vercel preview deploys are
# matched by regex. No cookies/auth are used, so credentials are not allowed
# (a wildcard/regex origin with credentials would be rejected by browsers anyway).
origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
