"""Pydantic schemas — the API contract shared by backend and frontend.

These shapes are stable; the frontend agent can mock against them while the
backend agent implements the endpoints.
"""
from __future__ import annotations

from pydantic import BaseModel, Field, model_validator


class EvidenceThesis(BaseModel):
    """A single thesis shown as evidence for why a mentor was recommended."""

    id: int
    title: str  # display title (Croatian, English fallback)
    year: int | None = None
    thesis_type: str | None = None
    similarity: float  # cosine similarity to the query, 0..1
    url: str | None = None  # public repository landing page (repo source only)


class MentorRecommendation(BaseModel):
    mentor_id: int
    full_name: str
    zavod_code: str | None = None
    score: float  # aggregated, recency-weighted relevance
    n_theses: int
    evidence: list[EvidenceThesis] = Field(default_factory=list)
    current_topics: list[str] = Field(default_factory=list)  # this year's titles (src A)
    matched_keywords: list[str] = Field(default_factory=list)  # query↔thesis keyword overlap
    explanation: str = ""  # templated, no LLM


class RecommendRequest(BaseModel):
    query: str = Field(min_length=1)
    top_k: int = Field(default=10, ge=1, le=50)
    zavod: str | None = None
    field: str | None = None


class RecommendResponse(BaseModel):
    query: str
    results: list[MentorRecommendation]


class ThesisOut(BaseModel):
    id: int
    title: str
    year: int | None = None
    thesis_type: str | None = None
    scientific_field: str | None = None
    keywords: list[str] = Field(default_factory=list)
    source: str  # 'repo' | 'schedule'
    url: str | None = None  # public repository landing page (repo source only)


class MentorDetail(BaseModel):
    id: int
    full_name: str
    zavod_code: str | None = None
    scientific_fields: list[str] = Field(default_factory=list)
    n_theses: int
    theses: list[ThesisOut] = Field(default_factory=list)


class MentorSummary(BaseModel):
    id: int
    full_name: str
    zavod_code: str | None = None
    n_theses: int


class SimilarMentor(MentorSummary):
    """A mentor whose thesis corpus is close to another mentor's (centroid cosine)."""

    similarity: float  # cosine similarity between thesis centroids, 0..1


class MentorListResponse(BaseModel):
    total: int
    mentors: list[MentorSummary]


class ZavodOut(BaseModel):
    """A department with how many mentors belong to it (for the filter)."""

    code: str
    count: int


class HealthResponse(BaseModel):
    status: str = "ok"


# --------------------------------------------------------------------------- #
# Feature #2 — elective course recommender
# --------------------------------------------------------------------------- #
class ProgrammeOut(BaseModel):
    """A study programme/profile, used to populate the context selector."""

    id: int
    level: str  # 'preddiplomski' | 'diplomski'
    area: str | None = None  # grouping for the UI, e.g. 'Računarstvo' | 'EIT' | 'IKT'
    code: str
    name: str  # display name (Croatian)


class ProgrammeCatalog(BaseModel):
    """Flat list of all programmes; the frontend groups by `level` then `area`."""

    programmes: list[ProgrammeOut] = Field(default_factory=list)


class CourseRecommendation(BaseModel):
    course_id: int
    code: str
    name: str  # display title (Croatian, English fallback)
    ects: float | None = None
    semester: int | None = None  # semester within the requested programme
    score: float  # relevance (cosine + small title-term bonus), 0..1
    # Programme names (within the selected level) that offer this as an elective.
    profiles: list[str] = Field(default_factory=list)
    outcomes_snippet: str | None = None  # short excerpt of learning outcomes
    matched_keywords: list[str] = Field(default_factory=list)  # query↔outcomes term overlap
    explanation: str = ""  # templated, no LLM
    url: str | None = None  # link to the FER course page


class CourseRecommendRequest(BaseModel):
    query: str = Field(min_length=1)
    # Exactly one of programme_code / programme_id identifies the student context.
    programme_code: str | None = None
    programme_id: int | None = None
    semester: int | None = None  # optional filter; None = all eligible semesters
    top_k: int = Field(default=12, ge=1, le=50)

    @model_validator(mode="after")
    def _require_programme(self) -> "CourseRecommendRequest":
        if self.programme_code is None and self.programme_id is None:
            raise ValueError("programme_code or programme_id is required")
        return self


class CourseRecommendResponse(BaseModel):
    query: str
    programme: ProgrammeOut | None = None
    results: list[CourseRecommendation] = Field(default_factory=list)


class CourseDetail(BaseModel):
    id: int
    code: str
    name_hr: str | None = None
    name_en: str | None = None
    ects: float | None = None
    nositelj: str | None = None
    outcomes: str | None = None
    syllabus: str | None = None
    url: str | None = None
    programmes: list[ProgrammeOut] = Field(default_factory=list)
