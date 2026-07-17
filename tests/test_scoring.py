"""Unit tests for the pure ranking/scoring helpers of both recommenders."""
import pytest

from recommender.recommend import (
    MAX_EVIDENCE_CONTRIB,
    RECENCY_HALF_LIFE_YEARS,
    _mentor_score,
    _recency_weight,
)
from recommender.recommend_courses import (
    BASE_FLOOR,
    SEMANTIC_ONLY_FLOOR,
    passes_relevance_gate,
)

NOW = 2026


class TestRecencyWeight:
    def test_current_year_full_weight(self):
        assert _recency_weight(NOW, NOW) == 1.0

    def test_unknown_year_middling(self):
        assert _recency_weight(None, NOW) == 0.5

    def test_half_life(self):
        assert _recency_weight(NOW - RECENCY_HALF_LIFE_YEARS, NOW) == pytest.approx(0.5)

    def test_future_year_clamped(self):
        # A thesis dated next year must not get >1 weight.
        assert _recency_weight(NOW + 3, NOW) == 1.0

    def test_monotonic_in_age(self):
        weights = [_recency_weight(NOW - age, NOW) for age in range(0, 20)]
        assert weights == sorted(weights, reverse=True)


class TestMentorScore:
    def test_empty_evidence_scores_zero(self):
        assert _mentor_score([], []) == 0.0

    def test_single_recent_thesis_scores_its_similarity(self):
        # One thesis, weight 1: mean = sim, volume factor = 1**e = 1.
        assert _mentor_score([0.8], [1.0]) == pytest.approx(0.8)

    def test_more_equal_evidence_scores_higher(self):
        one = _mentor_score([0.8], [1.0])
        three = _mentor_score([0.8, 0.8, 0.8], [1.0, 1.0, 1.0])
        assert three > one

    def test_volume_is_dampened_not_linear(self):
        one = _mentor_score([0.8], [1.0])
        four = _mentor_score([0.8] * 4, [1.0] * 4)
        assert four < 4 * one

    def test_evidence_contribution_is_capped(self):
        capped = _mentor_score([0.8] * MAX_EVIDENCE_CONTRIB, [1.0] * MAX_EVIDENCE_CONTRIB)
        overfull = _mentor_score([0.8] * (MAX_EVIDENCE_CONTRIB + 5), [1.0] * (MAX_EVIDENCE_CONTRIB + 5))
        assert overfull == pytest.approx(capped)

    def test_old_theses_weigh_less(self):
        recent = _mentor_score([0.8], [1.0])
        old = _mentor_score([0.8], [0.25])
        assert old < recent


class TestCourseRelevanceGate:
    def test_semantically_strong_passes_without_lexical_overlap(self):
        assert passes_relevance_gate(SEMANTIC_ONLY_FLOOR + 0.01, 0.0)

    def test_middling_similarity_needs_overlap(self):
        mid = (BASE_FLOOR + SEMANTIC_ONLY_FLOOR) / 2
        assert not passes_relevance_gate(mid, 0.0)
        assert passes_relevance_gate(mid, 0.2)

    def test_below_base_floor_fails_even_with_overlap(self):
        assert not passes_relevance_gate(BASE_FLOOR - 0.01, 1.0)
