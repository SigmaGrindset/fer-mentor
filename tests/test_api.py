"""API contract tests — response shapes, validation limits, 404s, rate limits.

No database and no embedding model: `get_db` is overridden (see conftest) and
the recommender entrypoints are monkeypatched to return canned objects.
"""
from __future__ import annotations

import pytest

import backend.app.routes as routes
from core.errors import EncoderBusy
from core.models import Mentor, Programme
from core.schemas import (
    CourseRecommendation,
    EvidenceThesis,
    MentorRecommendation,
    SimilarMentor,
)


def _mentor_row(id_: int = 1) -> Mentor:
    return Mentor(
        id=id_,
        prezime="Kovačević",
        ime="Ivana",
        full_name="Ivana Kovačević",
        slug="kovacevic_ivana",
        zavod_code="ZEMRIS",
        n_theses_repo=12,
        n_theses_current=3,
    )


def _recommendation() -> MentorRecommendation:
    return MentorRecommendation(
        mentor_id=1,
        full_name="Ivana Kovačević",
        zavod_code="ZEMRIS",
        score=0.83,
        n_theses=15,
        evidence=[EvidenceThesis(id=7, title="Naslov", year=2024, similarity=0.8)],
        current_topics=["Tema 1"],
        matched_keywords=["vid"],
        explanation="…",
    )


class TestHealth:
    def test_ok(self, client):
        r = client.get("/api/health")
        assert r.status_code == 200
        assert r.json() == {"status": "ok"}


class TestRecommendContract:
    def test_response_shape(self, client, monkeypatch):
        monkeypatch.setattr(routes, "recommend", lambda *a, **k: [_recommendation()])
        r = client.post("/api/recommend", json={"query": "računalni vid"})
        assert r.status_code == 200
        body = r.json()
        assert body["query"] == "računalni vid"
        (res,) = body["results"]
        assert res["mentor_id"] == 1
        assert res["full_name"] == "Ivana Kovačević"
        assert res["evidence"][0]["title"] == "Naslov"

    def test_empty_query_rejected(self, client):
        assert client.post("/api/recommend", json={"query": ""}).status_code == 422

    def test_overlong_query_rejected(self, client):
        r = client.post("/api/recommend", json={"query": "x" * 501})
        assert r.status_code == 422

    def test_top_k_bounds(self, client):
        assert client.post("/api/recommend", json={"query": "a", "top_k": 0}).status_code == 422
        assert client.post("/api/recommend", json={"query": "a", "top_k": 51}).status_code == 422

    def test_invalid_thesis_type_rejected(self, client):
        r = client.post("/api/recommend", json={"query": "a", "thesis_type": "doktorski"})
        assert r.status_code == 422

    def test_repeated_query_is_served_from_cache(self, client, monkeypatch):
        calls = []
        monkeypatch.setattr(
            routes, "recommend", lambda *a, **k: calls.append(1) or [_recommendation()]
        )
        first = client.post("/api/recommend", json={"query": "Duboko  učenje"})
        # Same query modulo case/whitespace — must not recompute.
        second = client.post("/api/recommend", json={"query": "duboko učenje"})
        assert first.status_code == second.status_code == 200
        assert first.json()["results"] == second.json()["results"]
        assert len(calls) == 1


class TestOverloadShedding:
    def test_encoder_busy_becomes_503_with_retry_after(self, client, monkeypatch):
        def busy(*a, **k):
            raise EncoderBusy

        monkeypatch.setattr(routes, "recommend", busy)
        r = client.post("/api/recommend", json={"query": "gužva"})
        assert r.status_code == 503
        assert r.headers["Retry-After"] == "5"
        assert r.json()["detail"]

    def test_shed_request_is_not_cached(self, client, monkeypatch):
        """A 503 must not poison the cache: the retry has to reach the
        recommender, not replay the overload response."""
        calls = []

        def busy(*a, **k):
            calls.append(1)
            raise EncoderBusy

        monkeypatch.setattr(routes, "recommend", busy)
        assert client.post("/api/recommend", json={"query": "gužva"}).status_code == 503
        monkeypatch.setattr(routes, "recommend", lambda *a, **k: [_recommendation()])
        assert client.post("/api/recommend", json={"query": "gužva"}).status_code == 200
        assert len(calls) == 1


class TestRateLimit:
    def test_recommend_returns_429_after_budget(self, client, monkeypatch):
        monkeypatch.setattr(routes, "recommend", lambda *a, **k: [])
        # A dedicated client IP so this test doesn't eat other tests' budget.
        headers = {"X-Forwarded-For": "203.0.113.77"}
        statuses = [
            client.post(
                "/api/recommend", json={"query": f"q {i}"}, headers=headers
            ).status_code
            for i in range(20)
        ]
        assert 429 in statuses
        r = client.post("/api/recommend", json={"query": "one more"}, headers=headers)
        assert r.status_code == 429
        assert "detail" in r.json()


class TestMentorEndpoints:
    def test_list_mentors_shape(self, client, fake_db):
        fake_db.scalars_rows = [_mentor_row()]
        fake_db.scalar_value = 1
        r = client.get("/api/mentors")
        assert r.status_code == 200
        body = r.json()
        assert body["total"] == 1
        assert body["mentors"][0]["n_theses"] == 15

    def test_list_mentors_name_search(self, client, fake_db):
        fake_db.scalars_rows = [_mentor_row()]
        r = client.get("/api/mentors", params={"q": "ivana kovacevic"})
        assert r.status_code == 200
        body = r.json()
        assert body["total"] == 1
        assert body["mentors"][0]["full_name"] == "Ivana Kovačević"

    def test_list_mentors_overlong_q_rejected(self, client):
        assert client.get("/api/mentors", params={"q": "x" * 201}).status_code == 422

    def test_get_mentor_404(self, client):
        r = client.get("/api/mentors/999")
        assert r.status_code == 404
        assert r.json() == {"detail": "Mentor nije pronađen"}

    def test_get_mentor_shape(self, client, fake_db):
        fake_db.get_map = {1: _mentor_row()}
        fake_db.scalars_rows = []  # theses
        r = client.get("/api/mentors/1")
        assert r.status_code == 200
        body = r.json()
        assert body["id"] == 1
        assert body["theses"] == []
        assert body["n_theses"] == 15

    def test_similar_mentors_404(self, client):
        assert client.get("/api/mentors/999/similar").status_code == 404

    def test_similar_mentors_shape(self, client, fake_db, monkeypatch):
        fake_db.get_map = {1: _mentor_row()}
        monkeypatch.setattr(
            routes,
            "similar_mentors",
            lambda *a, **k: [
                SimilarMentor(id=2, full_name="Marko Horvat", n_theses=4, similarity=0.91)
            ],
        )
        r = client.get("/api/mentors/1/similar")
        assert r.status_code == 200
        assert r.json()[0]["similarity"] == 0.91

    def test_zavodi_shape(self, client, fake_db):
        fake_db.execute_rows = [("ZEMRIS", 10), ("ZARI", 5)]
        r = client.get("/api/zavodi")
        assert r.status_code == 200
        assert r.json() == [
            {"code": "ZEMRIS", "count": 10},
            {"code": "ZARI", "count": 5},
        ]


class TestCourseEndpoints:
    @pytest.fixture
    def programme(self):
        return Programme(
            id=3, level="diplomski", area="Računarstvo", code="racunarska-znanost",
            name_hr="Računarska znanost",
        )

    def test_recommend_courses_shape(self, client, fake_db, monkeypatch, programme):
        fake_db.scalar_value = programme
        monkeypatch.setattr(
            routes,
            "recommend_courses",
            lambda *a, **k: [
                CourseRecommendation(
                    course_id=5, code="123", name="Duboko učenje", ects=5.0,
                    semester=1, score=0.7,
                )
            ],
        )
        r = client.post(
            "/api/courses/recommend",
            json={"query": "strojno učenje", "programme_code": "racunarska-znanost"},
        )
        assert r.status_code == 200
        body = r.json()
        assert body["programme"]["code"] == "racunarska-znanost"
        assert body["results"][0]["name"] == "Duboko učenje"

    def test_missing_programme_rejected(self, client):
        r = client.post("/api/courses/recommend", json={"query": "ai"})
        assert r.status_code == 422

    def test_overlong_query_rejected(self, client):
        r = client.post(
            "/api/courses/recommend",
            json={"query": "x" * 501, "programme_code": "c"},
        )
        assert r.status_code == 422

    def test_get_course_404(self, client):
        r = client.get("/api/courses/nepostojeci")
        assert r.status_code == 404
        assert r.json() == {"detail": "Predmet nije pronađen"}

    def test_programmes_shape(self, client, fake_db, programme):
        fake_db.scalars_rows = [programme]
        r = client.get("/api/programmes")
        assert r.status_code == 200
        assert r.json()["programmes"][0]["name"] == "Računarska znanost"


class TestMeta:
    def test_empty_meta(self, client):
        r = client.get("/api/meta")
        assert r.status_code == 200
        assert r.json() == {"sources": []}


class TestCors:
    def test_vercel_preview_origin_allowed(self, client):
        r = client.get(
            "/api/health", headers={"Origin": "https://fermentor-preview.vercel.app"}
        )
        assert r.headers.get("access-control-allow-origin") == (
            "https://fermentor-preview.vercel.app"
        )
