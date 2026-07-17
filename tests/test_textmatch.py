"""Unit tests for the lexical matching used in hybrid ranking and explanations."""
from recommender.textmatch import (
    lexical_overlap,
    matched_keywords,
    matched_query_terms,
    normalize,
)


class TestNormalize:
    def test_lowercases_and_strips_diacritics(self):
        assert normalize("Čvor ŽELJEZO šuma ćup") == "cvor zeljezo suma cup"

    def test_dj_ligature(self):
        assert normalize("Đurđevac") == "durdevac"

    def test_plain_ascii_unchanged(self):
        assert normalize("strojno ucenje") == "strojno ucenje"


class TestLexicalOverlap:
    def test_full_overlap_with_inflection(self):
        # "strojnog učenja" vs "strojno učenje" — only case endings differ.
        assert lexical_overlap("strojno učenje", "primjena strojnog učenja") == 1.0

    def test_no_overlap(self):
        assert lexical_overlap("kvantna kriptografija", "uzgoj rajčica u plastenicima") == 0.0

    def test_stopword_only_query_scores_zero(self):
        assert lexical_overlap("kako i za što", "bilo koji tekst") == 0.0

    def test_partial_overlap_is_fractional(self):
        score = lexical_overlap("duboko učenje robotika", "duboko učenje slika")
        assert 0.0 < score < 1.0

    def test_empty_text(self):
        assert lexical_overlap("računalni vid", None) == 0.0
        assert lexical_overlap("računalni vid", "") == 0.0

    def test_diacritic_insensitive(self):
        assert lexical_overlap("racunalni vid", "računalni vid u prometu") > 0.0


class TestMatchedKeywords:
    def test_returns_matching_phrases_in_readable_form(self):
        got = matched_keywords(
            "duboko učenje za klasifikaciju slika",
            ["Duboko učenje", "robotika", "klasifikacija slika"],
        )
        assert got == ["Duboko učenje", "klasifikacija slika"]

    def test_deduplicates_case_and_diacritics(self):
        got = matched_keywords("neuronske mreže", ["Neuronske mreže", "neuronske mreze"])
        assert len(got) == 1

    def test_empty_query(self):
        assert matched_keywords("", ["nešto"]) == []


class TestMatchedQueryTerms:
    def test_returns_query_surface_forms(self):
        got = matched_query_terms("Reinforcement Learning u robotici", "reinforcement learning")
        assert "Reinforcement" in got
        assert "Learning" in got

    def test_empty_text(self):
        assert matched_query_terms("bilo što", None) == []
