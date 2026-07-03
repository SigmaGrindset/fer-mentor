# Backend image for Hugging Face Spaces (Docker SDK).
# CPU-only torch keeps the image small (no CUDA); the embedding model is baked
# into the image so a cold start after the Space sleeps does not re-download ~2 GB.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HOME=/app/.hf-cache \
    TOKENIZERS_PARALLELISM=false \
    EMBEDDING_MODEL=BAAI/bge-m3 \
    EMBEDDING_DIM=1024

WORKDIR /app

# Dependencies. core/ must be present because pyproject sets packages=["core"].
COPY pyproject.toml ./
COPY core ./core
RUN pip install --upgrade pip \
 && pip install torch --index-url https://download.pytorch.org/whl/cpu \
 && pip install ".[backend,ml]"

# Runtime code (the API imports only core + recommender + backend).
COPY recommender ./recommender
COPY backend ./backend

# Pre-bake the embedding model into the image (avoids re-download on restart).
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('BAAI/bge-m3')"

EXPOSE 7860
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "7860"]
