"""Text embedding for FERmentor — free, open-source, CPU-only.

Loads the model named in `settings.embedding_model` once (process-wide cache)
and exposes two functions that apply the model's own prompt convention:

  - `encode_passages(texts)` — embed documents (thesis texts) to store / index.
  - `encode_query(text)`     — embed a user query for nearest-neighbour search.

Both return L2-normalized float32 vectors, so a plain inner product equals
cosine similarity (matching pgvector's `vector_cosine_ops`).

Prompt convention is model-aware:
  - `intfloat/multilingual-e5-*` REQUIRE `"query: "` / `"passage: "` prefixes.
  - `BAAI/bge-m3` needs NO prefix (it is asymmetric-free for retrieval).
Anything else falls back to "no prefix", which is the safe default.
"""
from __future__ import annotations

import os
import threading

import numpy as np
import torch
from sentence_transformers import SentenceTransformer

from core.config import settings
from core.errors import EncoderBusy
from core.metrics import time_stage

__all__ = ["EncoderBusy", "encode_passages", "encode_query", "get_model"]

os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

# Truncate very long abstracts so we never blow past the model's context. We cap
# at 512 tokens (via max_seq_length below): plenty for title+abstract+keywords
# retrieval, and ~7x faster on CPU than bge-m3's native 8192 (the long-tail
# abstracts otherwise dominate cost). A cheap char cap keeps tokenization fast.
_MAX_TOKENS = 512
_MAX_CHARS = 6000

_model: SentenceTransformer | None = None
_lock = threading.Lock()

# Bound how many query encodes run at once. On the 2-vCPU Space, unbounded
# concurrent .encode() calls oversubscribe the CPU and every request slows ~Nx
# (load test: throughput peaks at ~3 in-flight then collapses). This semaphore
# makes surplus requests queue for a slot instead of thrashing, so tail latency
# stays bounded. Default 2 (the measured throughput sweet spot); overridable.
_ENCODE_CONCURRENCY = max(1, int(os.environ.get("ENCODE_CONCURRENCY") or 2))
_encode_slots = threading.Semaphore(_ENCODE_CONCURRENCY)

# If no slot frees up within this budget the server is overloaded (a burst, or
# an abuser bypassing the per-IP limit): shed the request with a fast 503 the
# client can retry, rather than let it sit in a queue past the browser timeout.
_ENCODE_ACQUIRE_TIMEOUT = float(os.environ.get("ENCODE_ACQUIRE_TIMEOUT") or 20)


def _needs_e5_prefix(model_name: str) -> bool:
    name = model_name.lower()
    return ("e5" in name and "multilingual" in name) or name.startswith("intfloat/")


def get_model() -> SentenceTransformer:
    """Load (once) and return the configured SentenceTransformer model."""
    global _model
    if _model is None:
        with _lock:
            if _model is None:
                # Intra-op threads. In a container os.cpu_count() reports the
                # HOST's cores, not the (smaller) cgroup CPU budget — so on a 2
                # vCPU host that value oversubscribes and thrashes. Honour an
                # explicit TORCH_NUM_THREADS (set it to the real vCPU count in
                # deployment); fall back to os.cpu_count() locally.
                _n_threads = int(os.environ.get("TORCH_NUM_THREADS") or (os.cpu_count() or 8))
                torch.set_num_threads(max(1, _n_threads))
                model = SentenceTransformer(settings.embedding_model, device="cpu")
                # 512 tokens: enough for retrieval, ~7x faster than the native
                # long context on CPU (applies to bge-m3 and e5 alike).
                model.max_seq_length = _MAX_TOKENS
                _model = model
    return _model


def _prefix(texts: list[str], prefix: str) -> list[str]:
    return [f"{prefix}{t}" for t in texts]


def _truncate(texts: list[str]) -> list[str]:
    return [t[:_MAX_CHARS] if t else "" for t in texts]


def _encode(texts: list[str], *, batch_size: int) -> np.ndarray:
    model = get_model()
    vecs = model.encode(
        _truncate(texts),
        batch_size=batch_size,
        normalize_embeddings=True,  # L2 -> inner product == cosine
        convert_to_numpy=True,
        show_progress_bar=False,
    )
    return vecs.astype(np.float32)


def encode_passages(texts: list[str], *, batch_size: int = 32) -> np.ndarray:
    """Embed documents/passages. Returns (n, dim) float32, L2-normalized."""
    if _needs_e5_prefix(settings.embedding_model):
        texts = _prefix(texts, "passage: ")
    return _encode(texts, batch_size=batch_size)


def encode_query(text: str) -> np.ndarray:
    """Embed a single query. Returns (dim,) float32, L2-normalized."""
    payload = [text]
    if _needs_e5_prefix(settings.embedding_model):
        payload = _prefix(payload, "query: ")
    # Serialize past the concurrency bound so the CPU isn't oversubscribed; the
    # wait for a slot is counted inside embed_ms (it is latency the user feels).
    with time_stage("embed_ms"):
        if not _encode_slots.acquire(timeout=_ENCODE_ACQUIRE_TIMEOUT):
            raise EncoderBusy
        try:
            return _encode(payload, batch_size=1)[0]
        finally:
            _encode_slots.release()
