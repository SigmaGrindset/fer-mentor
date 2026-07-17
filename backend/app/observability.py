"""Structured request logging.

One JSON line per request on stdout (which is what the HF Space "Logs" tab
shows), carrying status, total duration and whatever stage metrics the
recommender recorded (embed_ms, search_ms, db_ms, cache hit/miss, ...).
Unhandled exceptions are logged with traceback, then re-raised so FastAPI's
error handling (and Sentry, when configured) still applies.
"""
from __future__ import annotations

import json
import logging
import sys
import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from core.metrics import request_metrics

log = logging.getLogger("fermentor")


def setup_logging(level: str = "INFO") -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter("%(message)s"))
    log.setLevel(level.upper())
    log.handlers = [handler]
    log.propagate = False


class RequestLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        metrics: dict = {}
        token = request_metrics.set(metrics)
        rid = uuid.uuid4().hex[:8]
        status = 500
        t0 = time.perf_counter()
        try:
            response = await call_next(request)
            status = response.status_code
            return response
        except Exception:
            log.exception("unhandled error rid=%s %s %s", rid, request.method, request.url.path)
            raise
        finally:
            request_metrics.reset(token)
            payload = {
                "rid": rid,
                "method": request.method,
                "path": request.url.path,
                "status": status,
                "total_ms": round((time.perf_counter() - t0) * 1000, 1),
                **metrics,
            }
            # Keep-warm pings hit /api/health every few hours; don't let them
            # drown out real traffic at INFO.
            level = logging.DEBUG if request.url.path == "/api/health" else logging.INFO
            log.log(level, json.dumps(payload, ensure_ascii=False))
