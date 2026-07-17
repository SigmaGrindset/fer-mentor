"""Central configuration, loaded from environment / .env."""
from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # PostgreSQL connection (psycopg v3 driver).
    database_url: str = (
        "postgresql+psycopg://fermentor:fermentor@localhost:5433/fermentor"
    )

    # Embedding model — free / open-source, runs locally. Keep EMBEDDING_DIM in
    # sync with the model (bge-m3 / e5-large = 1024, e5-small = 384). Changing the
    # model means recreating the thesis_embeddings table.
    embedding_model: str = "BAAI/bge-m3"
    embedding_dim: int = 1024

    # FER repository OAI-PMH endpoint. Use the `mods` metadataPrefix (oai_dc does
    # not label the mentor role).
    oai_base_url: str = "https://repozitorij.fer.unizg.hr/oai/"

    # CORS allowed origins for the API (comma-separated). Set CORS_ORIGINS in the
    # deployed environment to the production frontend URL; *.vercel.app preview
    # deploys are matched by a regex in the app, so they need not be listed here.
    cors_origins: str = "http://localhost:5173"

    # Error monitoring. Empty = Sentry disabled (local dev, tests).
    sentry_dsn: str = ""

    # Level for the structured request log ("fermentor" logger).
    log_level: str = "INFO"


settings = Settings()
