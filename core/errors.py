"""Exception types shared between the API layer and the recommender.

Deliberately dependency-free. The API registers a handler for `EncoderBusy`,
but importing it must not drag in the embedding stack: `recommender.embedder`
imports numpy/torch/sentence-transformers at module level, and CI installs the
backend without the `ml` extra (see .github/workflows/tests.yml). Defining the
exception here keeps `backend.app.main` importable without those packages.
"""
from __future__ import annotations


class EncoderBusy(RuntimeError):
    """No encode slot became free in time — the server is overloaded."""
