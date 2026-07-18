"""Ingestion parser tests against small handcrafted fixtures.

Each fixture contains valid rows AND known-bad rows, so these tests pin both
the extraction and the reject/warning accounting added for ingest_runs.
"""
from __future__ import annotations

import shutil
from pathlib import Path

import pytest

from core.ingest_log import RunStats
from ingestion.harvest_repo import iter_records, parse_record
from ingestion.parse_courses import parse_programme
from ingestion.parse_schedule import parse_file
from scripts.ingest import prune_schedule

from lxml import etree

FIXTURES = Path(__file__).parent / "fixtures"


class TestParseSchedule:
    def test_good_rows_extracted_and_bad_rows_rejected(self):
        stats = RunStats()
        rows = parse_file(FIXTURES / "schedule.html", "zavrsni", stats)

        assert len(rows) == 2
        first = rows[0]
        assert first.title_hr == "Detekcija objekata u prometnim snimkama"
        assert (first.mentor_prezime, first.mentor_ime) == ("Kovačević", "Ivana")
        assert first.zavod_code == "ZEMRIS"
        assert first.student_name == "Perić, Pero"
        assert first.thesis_type == "zavrsni"
        assert first.embedding_text == first.title_hr

        # Bad rows: one short row, one empty title, one unparseable mentor.
        assert stats.rejected == 3
        reasons = " | ".join(stats.warnings)
        assert "fewer than 4 cells" in reasons
        assert "empty title" in reasons
        assert "unparseable mentor cell" in reasons

    def test_ext_id_is_stable(self):
        a = parse_file(FIXTURES / "schedule.html", "zavrsni")
        b = parse_file(FIXTURES / "schedule.html", "zavrsni")
        assert [t.ext_id for t in a] == [t.ext_id for t in b]


class TestParseRepoRecord:
    def _records(self):
        tree = etree.parse(str(FIXTURES / "oai_page_0000.xml")).getroot()
        ns = {"oai": "http://www.openarchives.org/OAI/2.0/"}
        return tree.findall(".//oai:record", ns)

    def test_full_record(self):
        good = parse_record(self._records()[0])
        assert good is not None
        assert good.ext_id == "oai:repozitorij.fer.unizg.hr:fer:1001"
        assert good.title_hr == "Duboko učenje za detekciju objekata"
        assert good.title_en == "Deep learning for object detection"
        assert good.abstract_hr == "Sažetak rada o dubokom učenju."
        assert (good.mentor_prezime, good.mentor_ime) == ("Kovačević", "Ivana")
        assert good.thesis_type == "diplomski"
        assert good.year == 2024
        assert good.urn == "urn:nbn:hr:168:001001"
        assert good.scientific_field == "Računarstvo"
        assert good.keywords == ["duboko učenje", "detekcija objekata"]
        assert [(c.prezime, c.role) for c in good.committee] == [("Horvat", "chair")]
        assert "Duboko učenje" in (good.embedding_text or "")

    def test_deleted_record_is_none(self):
        assert parse_record(self._records()[1]) is None

    def test_record_without_advisor_still_parses(self):
        # The reject happens later, at upsert time — parsing must keep it.
        thesis = parse_record(self._records()[2])
        assert thesis is not None
        assert thesis.mentor_prezime is None
        assert thesis.thesis_type == "zavrsni"

    def test_iter_records_counts_deleted_as_rejected(self, tmp_path):
        # Pre-seed the page cache so no HTTP request is ever made.
        shutil.copy(FIXTURES / "oai_page_0000.xml", tmp_path / "oai_page_0000.xml")
        stats = RunStats()
        got = list(
            iter_records("http://unused.invalid/oai/", tmp_path, stats=stats)
        )
        assert len(got) == 2  # good + advisor-less
        assert stats.rejected == 1
        assert "fer:1002" in stats.warnings[0]


class TestParseProgramme:
    def test_groups_semesters_and_flags(self):
        stats = RunStats()
        html = (FIXTURES / "programme.html").read_text(encoding="utf-8")
        page = parse_programme(html, stats)

        assert page.name_hr == "Računarska znanost"
        by_code = {r.code: r for r in page.rows}
        assert set(by_code) == {"matan1", "dubuce", "racvid"}

        assert by_code["matan1"].is_elective is False
        assert by_code["matan1"].semester == 1
        assert by_code["matan1"].ects == 5.0

        assert by_code["dubuce"].is_elective is True
        # The "(3)" count suffix is stripped from the group label.
        assert by_code["dubuce"].elective_group == "Izborni predmeti profila"

        assert by_code["racvid"].semester == 2

        # Transversal course skipped (warning), linkless coursebox rejected.
        assert stats.rejected == 1
        assert any("without /predmet/ link" in w for w in stats.warnings)
        assert any("transversal" in w for w in stats.warnings)


class TestPruneSchedule:
    """The schedule ext_id is a title hash, so edited titles re-hash into new
    rows; pruning is what stops the old ones piling up as near-duplicates.

    The suite runs without Postgres, so the session is faked — enough to pin
    which rows get deleted and in what order.
    """

    class FakeQuery:
        def __init__(self, session):
            self._session = session

        def filter(self, *_args):
            return self

        def delete(self, **_kwargs):
            self._session.memberships_cleared = True
            return 0

    class FakeSession:
        def __init__(self, rows):
            self._rows = rows
            self.deleted = []
            self.memberships_cleared = False
            self.flushed = False

        def scalars(self, _stmt):
            return self

        def all(self):
            return self._rows

        def query(self, _model):
            return TestPruneSchedule.FakeQuery(self)

        def delete(self, row):
            self.deleted.append(row)

        def flush(self):
            self.flushed = True

    class Row:
        def __init__(self, id_):
            self.id = id_

    def test_deletes_stale_rows_and_clears_memberships_first(self):
        stale = [self.Row(7), self.Row(9)]
        session = self.FakeSession(stale)

        assert prune_schedule(session, {"live-a", "live-b"}) == 2
        assert session.deleted == stale
        # Memberships have no ON DELETE cascade, so they must go first.
        assert session.memberships_cleared is True
        assert session.flushed is True

    def test_no_stale_rows_is_a_noop(self):
        session = self.FakeSession([])

        assert prune_schedule(session, {"live-a"}) == 0
        assert session.deleted == []
        assert session.memberships_cleared is False

    def test_refuses_to_prune_on_an_empty_parse(self):
        """A failed parse must never be read as "every defence was withdrawn"."""
        session = self.FakeSession([self.Row(1)])

        with pytest.raises(ValueError, match="produced 0 theses"):
            prune_schedule(session, set())
        assert session.deleted == []
