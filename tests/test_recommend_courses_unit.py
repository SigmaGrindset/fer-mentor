"""Unit tests for course-recommender helpers that don't need a real DB."""
from recommender.recommend_courses import _profiles_offering_bulk


class _StubResult:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


class _StubSession:
    def __init__(self, rows):
        self._rows = rows
        self.calls = 0

    def execute(self, stmt):
        self.calls += 1
        return _StubResult(self._rows)


class TestProfilesOfferingBulk:
    def test_groups_and_sorts_per_course(self):
        session = _StubSession(
            [(1, "Računarska znanost"), (1, "Programsko inženjerstvo"), (2, "Telekomunikacije")]
        )
        got = _profiles_offering_bulk(session, [1, 2, 3], "diplomski")
        assert got == {
            1: ["Programsko inženjerstvo", "Računarska znanost"],
            2: ["Telekomunikacije"],
        }

    def test_single_query_for_many_courses(self):
        session = _StubSession([(1, "A"), (2, "B"), (3, "C")])
        _profiles_offering_bulk(session, [1, 2, 3], "preddiplomski")
        assert session.calls == 1

    def test_empty_ids_skip_the_db_entirely(self):
        session = _StubSession([])
        assert _profiles_offering_bulk(session, [], "diplomski") == {}
        assert session.calls == 0
