"""World import in one go: every category for every region, the filler rules, then the atlas export.

    .venv/Scripts/python -u ingestion/run_world.py [category ...]

Set TIMEWISE_CACHE to keep Wikidata's replies on another drive. Safe to rerun: cached replies are
reused and rows are upserted. Replaces run_all_regions.py, which needed about 3,000 queries.
"""
from __future__ import annotations

import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / "ingestion/connectors"), str(ROOT / "apps/api")]

import wikidata_world  # noqa: E402
from wikidata_more import apply_rules  # noqa: E402


def main() -> int:
    started = time.monotonic()
    names = sys.argv[1:] or list(wikidata_world.ALL)
    by_state, by_country = wikidata_world.load_regions()
    failed = [n for n in names if wikidata_world.run_category(n, by_state, by_country, fresh=False)]

    regions = sorted({r for rs in by_country.values() for r in rs})
    hidden = {}
    for region in regions:
        for rule, n in apply_rules(region).items():
            hidden[rule] = hidden.get(rule, 0) + n
    print("hidden by filler rules:", hidden, flush=True)

    from timewise_api.export import export_imported
    counts = export_imported()
    print(f"exported {len(counts)} regions, {sum(counts.values())} events; smallest {sorted(counts.items(), key=lambda kv: kv[1])[:5]}", flush=True)
    print(f"done in {(time.monotonic() - started) / 60:.0f} min; failed categories: {failed or 'none'}", flush=True)
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
