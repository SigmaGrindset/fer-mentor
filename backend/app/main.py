"""FERmentor FastAPI application."""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from core.config import settings

from .observability import RequestLogMiddleware, setup_logging
from .ratelimit import limiter, rate_limit_handler
from .routes import router

setup_logging(settings.log_level)

if settings.sentry_dsn:
    import sentry_sdk

    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        traces_sample_rate=0.1,
        profiles_sample_rate=0,
        send_default_pii=False,
    )

app = FastAPI(title="FERmentor API", version="0.1.0")

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_handler)
app.add_middleware(SlowAPIMiddleware)
# Added after SlowAPIMiddleware so it wraps it (outermost) and times/logs
# rate-limited requests too.
app.add_middleware(RequestLogMiddleware)

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
