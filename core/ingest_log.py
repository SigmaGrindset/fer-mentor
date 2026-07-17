"""Persisted metadata for ingestion runs.

Usage in a script:

    from core.ingest_log import ingest_run

    with ingest_run("schedule") as stats:
        ...
        stats.parsed += 1
        stats.reject("row 12: no mentor cell")
        ...
        stats.upserted = n

The run row is inserted (status='running') on entry and finalized on exit —
'ok' with the collected counters, or 'failed' with the exception recorded
(and the exception re-raised). Uses its own short-lived sessions so run
metadata survives even when the script's data transaction rolls back.
"""
from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Iterator

from .db import SessionLocal
from .models import IngestRun

# Keep the warning list bounded; the counter still counts everything.
MAX_WARNINGS = 200


class RunStats:
    def __init__(self) -> None:
        self.parsed = 0
        self.upserted = 0
        self.rejected = 0
        self.warnings: list[str] = []

    def reject(self, reason: str) -> None:
        """Count a rejected row and keep its reason (up to MAX_WARNINGS)."""
        self.rejected += 1
        self.warn(reason)

    def warn(self, message: str) -> None:
        """Record a validation warning without counting a rejection."""
        if len(self.warnings) < MAX_WARNINGS:
            self.warnings.append(message)
        elif len(self.warnings) == MAX_WARNINGS:
            self.warnings.append(f"... further warnings truncated at {MAX_WARNINGS}")


def start_run(source: str) -> int:
    """Insert a status='running' row and return its id."""
    with SessionLocal() as session:
        run = IngestRun(source=source, status="running")
        session.add(run)
        session.commit()
        return run.id


@contextmanager
def ingest_run(source: str) -> Iterator[RunStats]:
    run_id = start_run(source)
    stats = RunStats()
    try:
        yield stats
    except BaseException as exc:
        finish_run(run_id, stats, status="failed", error=repr(exc))
        raise
    else:
        finish_run(run_id, stats, status="ok")


def finish_run(run_id: int, stats: RunStats, *, status: str, error: str | None = None) -> None:
    with SessionLocal() as session:
        run = session.get(IngestRun, run_id)
        if run is None:  # table dropped mid-run; nothing sane to do
            return
        run.status = status
        run.finished_at = datetime.now(timezone.utc)
        run.records_parsed = stats.parsed
        run.records_upserted = stats.upserted
        run.records_rejected = stats.rejected
        run.warnings = stats.warnings or None
        run.error = error
        session.commit()
