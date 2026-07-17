"""Per-request stage metrics, shared by the backend and the recommender.

The backend middleware opens a metrics dict per request (a ContextVar, which
propagates into the threadpool where sync endpoints run); recommender code
adds stage timings to it via `time_stage`. Outside a request (scripts, tests)
every helper is a no-op.
"""
from __future__ import annotations

import time
from contextlib import contextmanager
from contextvars import ContextVar
from typing import Any, Iterator

request_metrics: ContextVar[dict[str, Any] | None] = ContextVar(
    "request_metrics", default=None
)


def record(key: str, value: Any) -> None:
    """Attach a value (e.g. cache="hit") to the current request's log line."""
    metrics = request_metrics.get()
    if metrics is not None:
        metrics[key] = value


@contextmanager
def time_stage(stage: str) -> Iterator[None]:
    """Accumulate wall time of a code block under `stage` (in ms)."""
    metrics = request_metrics.get()
    if metrics is None:
        yield
        return
    t0 = time.perf_counter()
    try:
        yield
    finally:
        elapsed_ms = (time.perf_counter() - t0) * 1000
        metrics[stage] = round(metrics.get(stage, 0.0) + elapsed_ms, 1)
