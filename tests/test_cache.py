"""Unit tests for the TTL-LRU response cache and its key normalization."""
import recommender.cache as cache_mod
from recommender.cache import TTLCache, normalize_query


class TestNormalizeQuery:
    def test_lowercase_and_whitespace_collapse(self):
        assert normalize_query("  Strojno   UČENJE \n") == "strojno učenje"

    def test_diacritics_are_preserved(self):
        # "veza" and "veža" embed differently — they must not share a cache key.
        assert normalize_query("Veža") != normalize_query("Veza")


class TestTTLCache:
    def test_miss_then_hit(self):
        c = TTLCache()
        assert c.get("k") is None
        c.set("k", [1, 2])
        assert c.get("k") == [1, 2]

    def test_entries_expire(self, monkeypatch):
        now = [1000.0]
        monkeypatch.setattr(cache_mod.time, "monotonic", lambda: now[0])
        c = TTLCache(ttl=60)
        c.set("k", "v")
        now[0] += 59
        assert c.get("k") == "v"
        now[0] += 2
        assert c.get("k") is None

    def test_lru_eviction_at_maxsize(self):
        c = TTLCache(maxsize=2)
        c.set("a", 1)
        c.set("b", 2)
        c.set("c", 3)  # evicts "a", the least recently used
        assert c.get("a") is None
        assert c.get("b") == 2
        assert c.get("c") == 3

    def test_get_refreshes_recency(self):
        c = TTLCache(maxsize=2)
        c.set("a", 1)
        c.set("b", 2)
        c.get("a")  # "a" is now most recently used
        c.set("c", 3)  # evicts "b"
        assert c.get("a") == 1
        assert c.get("b") is None
