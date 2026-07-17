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
    # statement_timeout only helps while the server is REACHABLE; if the DB
    # host goes silent (frozen container, network partition) a request would
    # otherwise hang until the OS TCP timeout. connect_timeout fails new
    # connections fast, and TCP keepalives tear down a mid-query dead socket
    # in ~30 s + 3×10 s instead of minutes.
    connect_args={
        "options": "-c statement_timeout=15000",
        "connect_timeout": 10,
        "keepalives": 1,
        "keepalives_idle": 30,
        "keepalives_interval": 10,
        "keepalives_count": 3,
    },
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
