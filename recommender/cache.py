"""Small thread-safe TTL-LRU cache for recommendation responses.

The expensive part of a recommend request is encoding the query with bge-m3 on
CPU; repeated queries (same topic retyped, back-button resubmits) should not
pay it twice. Entries expire after `ttl` seconds so re-ingests reach users
within the hour without any explicit invalidation.
"""
from __future__ import annotations

import threading
import time
from collections import OrderedDict
from typing import Any, Hashable


def normalize_query(query: str) -> str:
    """Cache-key form of a free-text query: lowercase, collapsed whitespace.

    Deliberately does NOT strip diacritics — "veza" and "veža" embed
    differently, so conflating them would serve wrong cached results.
    """
    return " ".join(query.lower().split())


class TTLCache:
    def __init__(self, maxsize: int = 256, ttl: float = 3600.0) -> None:
        self._maxsize = maxsize
        self._ttl = ttl
        self._lock = threading.Lock()
        self._data: OrderedDict[Hashable, tuple[float, Any]] = OrderedDict()

    def get(self, key: Hashable) -> Any | None:
        with self._lock:
            entry = self._data.get(key)
            if entry is None:
                return None
            expires_at, value = entry
            if time.monotonic() >= expires_at:
                del self._data[key]
                return None
            self._data.move_to_end(key)
            return value

    def set(self, key: Hashable, value: Any) -> None:
        with self._lock:
            self._data[key] = (time.monotonic() + self._ttl, value)
            self._data.move_to_end(key)
            while len(self._data) > self._maxsize:
                self._data.popitem(last=False)
