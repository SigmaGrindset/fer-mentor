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


settings = Settings()
