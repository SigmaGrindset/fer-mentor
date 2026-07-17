"""Unit tests for the fuzzy mentor-name search."""
from backend.app.name_search import normalize, rank_mentors
from core.models import Mentor


def _mentor(prezime: str, ime: str, n: int = 0) -> Mentor:
    return Mentor(
        prezime=prezime,
        ime=ime,
        full_name=f"{ime} {prezime}",
        slug=f"{prezime}_{ime}".lower(),
        n_theses_repo=n,
        n_theses_current=0,
    )


class TestNormalize:
    def test_strips_diacritics_and_punctuation(self):
        assert normalize("Šegvić,  Siniša") == "segvic sinisa"


class TestRankMentors:
    def test_diacritic_insensitive_match(self):
        mentors = [_mentor("Šegvić", "Siniša"), _mentor("Horvat", "Marko")]
        got = rank_mentors(mentors, "sinisa segvic")
        assert [m.prezime for m in got] == ["Šegvić"]

    def test_word_order_does_not_matter(self):
        mentors = [_mentor("Šegvić", "Siniša")]
        assert rank_mentors(mentors, "Šegvić Siniša") == mentors
        assert rank_mentors(mentors, "Siniša Šegvić") == mentors

    def test_small_typo_still_matches(self):
        mentors = [_mentor("Vrdoljak", "Boris"), _mentor("Novak", "Ana")]
        got = rank_mentors(mentors, "Vrodljak")
        assert [m.prezime for m in got] == ["Vrdoljak"]

    def test_substring_match_outranks_fuzzy(self):
        exact = _mentor("Horvat", "Marko")
        fuzzy = _mentor("Horvatić", "Mirko", n=100)
        got = rank_mentors([fuzzy, exact], "marko horvat")
        assert got[0] is exact

    def test_empty_query_returns_all(self):
        mentors = [_mentor("A", "B"), _mentor("C", "D")]
        assert rank_mentors(mentors, "   ") == mentors

    def test_unrelated_names_are_dropped(self):
        mentors = [_mentor("Kovačević", "Ivana")]
        assert rank_mentors(mentors, "Žnidaršič") == []
