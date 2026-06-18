"""Create the pgvector extension and all tables. Idempotent.

Run after the Postgres container is up:
    python scripts/init_db.py
"""
from __future__ import annotations

from sqlalchemy import text

from core import models  # noqa: F401  (import registers tables on Base.metadata)
from core.db import Base, engine


def main() -> None:
    with engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    Base.metadata.create_all(engine)
    tables = ", ".join(sorted(Base.metadata.tables))
    print(f"DB initialized. Tables: {tables}")


if __name__ == "__main__":
    main()
