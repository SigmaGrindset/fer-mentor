"""Shared fixtures for the API contract tests.

The FastAPI app is imported without a database: `get_db` is overridden with a
configurable fake, and the recommender entrypoints are monkeypatched per test.
The embedding model is never loaded (its import is deferred inside the
recommender functions), so the suite runs without torch installed.
"""
from __future__ import annotations

import os

# Must happen before core.config is imported (env beats .env): tests must
# never initialize Sentry, even on a machine whose .env has a real DSN.
os.environ["SENTRY_DSN"] = ""

import pytest
from fastapi.testclient import TestClient

import backend.app.routes as routes
from backend.app.deps import get_db
from backend.app.main import app


class StubResult:
    """Duck-types the SQLAlchemy Result/ScalarResult used in the routes."""

    def __init__(self, rows):
        self._rows = list(rows)

    def all(self):
        return self._rows


class FakeDb:
    """Just enough of a Session for the route layer.

    `scalars_rows` feeds `.scalars(...).all()`, `execute_rows` feeds
    `.execute(...).all()`, `get_map` feeds `.get(Model, pk)`, `scalar_value`
    feeds `.scalar(...)`.
    """

    def __init__(self, *, scalars_rows=(), execute_rows=(), get_map=None, scalar_value=None):
        self.scalars_rows = list(scalars_rows)
        self.execute_rows = list(execute_rows)
        self.get_map = get_map or {}
        self.scalar_value = scalar_value

    def scalars(self, stmt):
        return StubResult(self.scalars_rows)

    def execute(self, stmt, params=None):
        return StubResult(self.execute_rows)

    def scalar(self, stmt):
        return self.scalar_value

    def get(self, model, pk):
        return self.get_map.get(pk)


@pytest.fixture
def fake_db():
    return FakeDb()


@pytest.fixture
def client(fake_db):
    app.dependency_overrides[get_db] = lambda: fake_db
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.fixture(autouse=True)
def clear_response_caches():
    """The recommend endpoints cache by normalized query; tests must not
    see each other's (or their own earlier) cached results."""
    routes._mentor_cache._data.clear()
    routes._course_cache._data.clear()
    yield
    routes._mentor_cache._data.clear()
    routes._course_cache._data.clear()
