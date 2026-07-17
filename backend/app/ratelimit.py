"""Rate limiting (slowapi). Separate module so routes can import the limiter
without a circular import through main.
"""
from __future__ import annotations

from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded

# The Space sits behind Hugging Face's proxy, so the peer address is the proxy;
# the real client is the first hop of X-Forwarded-For.
def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


limiter = Limiter(key_func=client_ip, default_limits=["60/minute"])

# The two POST recommend endpoints burn ~200 ms of CPU each on bge-m3 encoding,
# so they get a stricter budget than the cheap GET endpoints.
RECOMMEND_LIMIT = "15/minute"


def rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    # Same {"detail": ...} error body as the rest of the API.
    return JSONResponse(
        status_code=429,
        content={"detail": "Previše zahtjeva. Pokušaj ponovno za minutu."},
    )
