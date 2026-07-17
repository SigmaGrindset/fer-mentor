"""SQLAlchemy engine, session factory and declarative base."""
from __future__ import annotations

from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import settings

engine = create_engine(
    settings.database_url,
    future=True,
    pool_pre_ping=True,
    # Neon closes idle server-side connections; recycle before that bites.
    pool_recycle=300,
    # Backstop for runaway queries (e.g. the centroid seq-scan in similar.py):
    # endpoints run sync in the threadpool, so the server can't cancel them —
    # the statement timeout is what actually frees the connection.
    connect_args={"options": "-c statement_timeout=15000"},
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_session() -> Iterator[Session]:
    """FastAPI-style dependency / context helper yielding a session."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
