"""SQLAlchemy ORM models — the canonical data model for FERmentor.

Sources:
  - 'schedule' : local "Raspored obrana" HTML (current-year theses, title only)
  - 'repo'     : FER repository OAI-PMH, MODS format (historical, rich metadata)

Mentors from both sources are matched on `Prezime, Ime`; the ZAVOD code (only
present in the schedule source) disambiguates duplicate surnames.
"""
from __future__ import annotations

from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .config import settings
from .db import Base


class Mentor(Base):
    __tablename__ = "mentors"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Canonical name parts, parsed from "Prezime, Ime".
    prezime: Mapped[str] = mapped_column(String(120), index=True)
    ime: Mapped[str] = mapped_column(String(120))
    full_name: Mapped[str] = mapped_column(String(255))
    # Normalized join/url key, e.g. "skopljanac-macina_frano".
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    # FER department code, e.g. "ZEMRIS" (from the schedule source; may be NULL).
    zavod_code: Mapped[str | None] = mapped_column(String(16), index=True)

    n_theses_repo: Mapped[int] = mapped_column(Integer, default=0)
    n_theses_current: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    theses: Mapped[list["Thesis"]] = relationship(
        back_populates="mentor", cascade="all, delete-orphan"
    )

    @property
    def display_name(self) -> str:
        """Natural reading order "Ime Prezime" (vs. stored "Prezime, Ime")."""
        name = f"{self.ime} {self.prezime}".strip()
        return name or self.full_name


class Thesis(Base):
    __tablename__ = "theses"
    __table_args__ = (UniqueConstraint("source", "ext_id", name="uq_thesis_source_extid"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    source: Mapped[str] = mapped_column(String(16), index=True)  # 'repo' | 'schedule'
    ext_id: Mapped[str | None] = mapped_column(String(255))  # OAI identifier
    urn: Mapped[str | None] = mapped_column(String(255))

    title_hr: Mapped[str | None] = mapped_column(Text)
    title_en: Mapped[str | None] = mapped_column(Text)
    abstract_hr: Mapped[str | None] = mapped_column(Text)
    abstract_en: Mapped[str | None] = mapped_column(Text)
    keywords: Mapped[list[str] | None] = mapped_column(ARRAY(String))

    scientific_field: Mapped[str | None] = mapped_column(String(255))
    thesis_type: Mapped[str | None] = mapped_column(String(64))  # zavrsni/diplomski/...
    year: Mapped[int | None] = mapped_column(Integer, index=True)
    study_programme: Mapped[str | None] = mapped_column(String(255))
    smjer: Mapped[str | None] = mapped_column(String(255))
    # Privacy: kept minimal; not exposed publicly by the API.
    student_name: Mapped[str | None] = mapped_column(String(255))

    # The exact text fed to the embedding model (title + abstract + keywords).
    embedding_text: Mapped[str | None] = mapped_column(Text)

    mentor_id: Mapped[int] = mapped_column(ForeignKey("mentors.id"), index=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    mentor: Mapped["Mentor"] = relationship(back_populates="theses")
    embedding: Mapped["ThesisEmbedding | None"] = relationship(
        back_populates="thesis", cascade="all, delete-orphan", uselist=False
    )


class ThesisEmbedding(Base):
    __tablename__ = "thesis_embeddings"

    thesis_id: Mapped[int] = mapped_column(
        ForeignKey("theses.id"), primary_key=True
    )
    model_name: Mapped[str] = mapped_column(String(255))
    embedding: Mapped[list[float]] = mapped_column(Vector(settings.embedding_dim))

    thesis: Mapped["Thesis"] = relationship(back_populates="embedding")


class CommitteeMembership(Base):
    """Secondary signal: who sat on a thesis committee (related research groups)."""

    __tablename__ = "committee_memberships"

    id: Mapped[int] = mapped_column(primary_key=True)
    thesis_id: Mapped[int] = mapped_column(ForeignKey("theses.id"), index=True)
    mentor_id: Mapped[int] = mapped_column(ForeignKey("mentors.id"), index=True)
    role: Mapped[str | None] = mapped_column(String(32))  # 'chair' | 'member'


# --------------------------------------------------------------------------- #
# Feature #2 — elective course recommender
#
# Source: FER course catalogue (www.fer.unizg.hr), scraped with a browser UA.
#   - Programme/profile pages list courses per semester (mandatory + elective),
#     each linking to a `/predmet/<code>` detail page.
#   - The SAME course is an elective on MANY profiles -> CourseOffering is the
#     many-to-many link carrying (semester, is_elective) per programme.
# --------------------------------------------------------------------------- #
class Programme(Base):
    """A study programme/profile, e.g. (preddiplomski, Računarstvo) or
    (diplomski, "Računarstvo – Programsko inženjerstvo i informacijski sustavi")."""

    __tablename__ = "programmes"

    id: Mapped[int] = mapped_column(primary_key=True)
    level: Mapped[str] = mapped_column(String(16), index=True)  # 'preddiplomski' | 'diplomski'
    # Coarse grouping for the UI selector: 'Računarstvo' | 'EIT' | 'IKT' | ...
    area: Mapped[str | None] = mapped_column(String(64), index=True)
    # URL slug, unique key, e.g. 'fer3/racunarstvo' or 'dipl/rac/piis'.
    code: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    name_hr: Mapped[str] = mapped_column(String(255))
    name_en: Mapped[str | None] = mapped_column(String(255))

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    offerings: Mapped[list["CourseOffering"]] = relationship(
        back_populates="programme", cascade="all, delete-orphan"
    )


class Course(Base):
    """A single FER course (`/predmet/<code>`), independent of programme."""

    __tablename__ = "courses"

    id: Mapped[int] = mapped_column(primary_key=True)
    # `/predmet/<code>` slug, e.g. 'asp', 'bazpod' — unique catalogue key.
    code: Mapped[str] = mapped_column(String(64), unique=True, index=True)

    name_hr: Mapped[str | None] = mapped_column(String(512))
    name_en: Mapped[str | None] = mapped_column(String(512))
    ects: Mapped[float | None] = mapped_column(Float)
    nositelj: Mapped[str | None] = mapped_column(Text)  # lecturer(s), free text
    outcomes: Mapped[str | None] = mapped_column(Text)  # "Ishodi učenja"
    syllabus: Mapped[str | None] = mapped_column(Text)  # "Sadržaj / Opis"

    # Exact text fed to the embedding model (name + outcomes + syllabus).
    embedding_text: Mapped[str | None] = mapped_column(Text)
    url: Mapped[str | None] = mapped_column(String(512))

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    offerings: Mapped[list["CourseOffering"]] = relationship(
        back_populates="course", cascade="all, delete-orphan"
    )
    embedding: Mapped["CourseEmbedding | None"] = relationship(
        back_populates="course", cascade="all, delete-orphan", uselist=False
    )


class CourseOffering(Base):
    """Where/when a course is taught: one row per (course, programme, semester).

    `is_elective` distinguishes electives from mandatory courses; the same
    course typically appears as an elective across many programmes/profiles.
    """

    __tablename__ = "course_offerings"
    __table_args__ = (
        UniqueConstraint(
            "course_id", "programme_id", "semester", name="uq_offering"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id"), index=True)
    programme_id: Mapped[int] = mapped_column(ForeignKey("programmes.id"), index=True)
    semester: Mapped[int | None] = mapped_column(Integer, index=True)
    is_elective: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    # Optional FER elective bucket label (e.g. "Izborni predmeti profila").
    elective_group: Mapped[str | None] = mapped_column(String(128))

    course: Mapped["Course"] = relationship(back_populates="offerings")
    programme: Mapped["Programme"] = relationship(back_populates="offerings")


class CourseEmbedding(Base):
    __tablename__ = "course_embeddings"

    course_id: Mapped[int] = mapped_column(
        ForeignKey("courses.id"), primary_key=True
    )
    model_name: Mapped[str] = mapped_column(String(255))
    embedding: Mapped[list[float]] = mapped_column(Vector(settings.embedding_dim))

    course: Mapped["Course"] = relationship(back_populates="embedding")


class IngestRun(Base):
    """Metadata of one ingestion/embedding run — who ran, when, with what yield.

    Written by the scripts in `scripts/` (via `core.ingest_log.ingest_run`);
    read by `GET /api/meta` so data freshness is visible from outside.
    """

    __tablename__ = "ingest_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # 'schedule' | 'repo' | 'courses' | 'thesis_embeddings' | 'course_embeddings'
    source: Mapped[str] = mapped_column(String(32), index=True)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # 'running' | 'ok' | 'failed'
    status: Mapped[str] = mapped_column(String(16), default="running")
    records_parsed: Mapped[int] = mapped_column(Integer, default=0)
    records_upserted: Mapped[int] = mapped_column(Integer, default=0)
    records_rejected: Mapped[int] = mapped_column(Integer, default=0)
    # Validation warnings (capped list of strings; one per rejected/odd row).
    warnings: Mapped[list | None] = mapped_column(JSONB)
    # Exception repr when status == 'failed'.
    error: Mapped[str | None] = mapped_column(Text)
