"""Eyeball the recommender from the command line.

    python -m recommender.cli                       # run the default sample set
    python -m recommender.cli "obrada slika"         # single custom query
    python -m recommender.cli --top-k 5 "web aplikacije"
    python -m recommender.cli --zavod ZEMRIS "umjetna inteligencija"

Pretty-prints the top mentors with their evidence theses for each query.
"""
from __future__ import annotations

import argparse

from core.db import SessionLocal

from .recommend import recommend

SAMPLE_QUERIES = [
    "web aplikacije",
    "računalni vid i duboko učenje",
    "obrada prirodnog jezika",
    "raspodijeljeni sustavi",
    "sigurnost računalnih mreža",
]


def _print_query(query: str, top_k: int, zavod: str | None, field: str | None) -> None:
    print("=" * 78)
    extra = []
    if zavod:
        extra.append(f"zavod={zavod}")
    if field:
        extra.append(f"field={field}")
    suffix = f"  [{', '.join(extra)}]" if extra else ""
    print(f"QUERY: {query!r}{suffix}")
    print("=" * 78)
    with SessionLocal() as session:
        recs = recommend(session, query, top_k=top_k, zavod=zavod, field=field)
    if not recs:
        print("  (no matches)\n")
        return
    for i, r in enumerate(recs, 1):
        print(
            f"{i:2}. {r.full_name}  [{r.zavod_code or '-'}]  "
            f"score={r.score:.3f}  n_theses={r.n_theses}"
        )
        print(f"    {r.explanation}")
        for ev in r.evidence[:3]:
            god = f", {ev.year}" if ev.year else ""
            print(f"      - ({ev.similarity:.3f}{god}) {ev.title[:90]}")
        if r.current_topics:
            print(f"    Trenutno mentorira: {len(r.current_topics)} tema "
                  f"(npr. „{r.current_topics[0][:70]}”)")
    print()


def main() -> None:
    ap = argparse.ArgumentParser(description="Try the FERmentor recommender.")
    ap.add_argument("query", nargs="?", help="custom query (omit to run samples)")
    ap.add_argument("--top-k", type=int, default=5)
    ap.add_argument("--zavod", default=None, help="Mentor.zavod_code filter")
    ap.add_argument("--field", default=None, help="Thesis.scientific_field filter")
    args = ap.parse_args()

    queries = [args.query] if args.query else SAMPLE_QUERIES
    for q in queries:
        _print_query(q, args.top_k, args.zavod, args.field)


if __name__ == "__main__":
    main()
