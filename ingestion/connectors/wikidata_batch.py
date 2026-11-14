"""Imports Wikidata events for many countries per query, through QLever.

    python ingestion/connectors/wikidata_batch.py [--chunk 25] [--only war,treaty] [--regions austria,japan]

Why not query.wikidata.org: in November 2026 it answered every request, even a trivial one,
with "Retry-After: 1000", so the per-country import took over five hours for one country.
QLever (qlever.dev, from the University of Freiburg) serves the same Wikidata data,
CC0, from a recent dump, and answered the same query in seconds. Its data can be days behind
Wikidata itself.

Each query covers one category for a chunk of countries, and its rows are split back out per
country. Parsing, storage and the filler rules are the per-country importer's, unchanged.
Finished (category, chunk) pairs are recorded, so a rerun continues where it stopped.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(Path(__file__).parent), str(ROOT / "apps/api")]

from base import Connector, Page, ProviderError, RateLimiter  # noqa: E402
from sqlalchemy import text  # noqa: E402
from timewise_api.db import engine  # noqa: E402
from wikidata_events import CATEGORIES, normalize  # noqa: E402
from wikidata_more import UPSERT, apply_rules  # noqa: E402

ENDPOINT = "https://qlever.dev/api/wikidata"  # moved from qlever.cs.uni-freiburg.de, which now redirects
PROGRESS = ROOT / "data/generated/batch-import-progress.json"
PREFIXES = """PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX p: <http://www.wikidata.org/prop/>
PREFIX psv: <http://www.wikidata.org/prop/statement/value/>
PREFIX wikibase: <http://wikiba.se/ontology#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX schema: <http://schema.org/>
"""
TAIL = """
  ?n wikibase:timeValue ?time ; wikibase:timePrecision ?precision .
  ?i wikibase:sitelinks ?links .
  OPTIONAL { ?i rdfs:label ?en FILTER(LANG(?en) = "en") }
  OPTIONAL { ?i rdfs:label ?de FILTER(LANG(?de) = "de") }
  OPTIONAL { ?i schema:description ?desc FILTER(LANG(?desc) = "en") }
  OPTIONAL { ?i wdt:P582 ?end }
  OPTIONAL { ?i wdt:P625 ?coord }
  OPTIONAL { ?i wdt:P276/wdt:P625 ?placeCoord }
  OPTIONAL { ?i wdt:P131/wdt:P625 ?areaCoord }
"""
SELECT = "SELECT ?region ?i ?en ?de ?desc ?time ?precision ?end ?coord ?placeCoord ?areaCoord ?links"


def load_regions(only: list[str] | None) -> dict[str, dict]:
    regions = {}
    for path in sorted((ROOT / "data/source-configs/regions").glob("*.json")):
        if path.name.endswith(".boundary.geojson"):
            continue
        config = json.loads(path.read_text("utf8"))
        if config.get("wikidata_country") and (not only or config["id"] in only):
            regions[config["id"]] = config
    return regions


def pairs(regions: dict[str, dict], key: str) -> str:
    rows = []
    for rid, cfg in regions.items():
        qids = cfg["wikidata_states"] if key == "states" else [cfg["wikidata_country"]]
        rows += [f'(wd:{q} "{rid}")' for q in qids]
    return " ".join(rows)


def dates(props: str) -> str:
    return " UNION ".join(f"{{ ?i p:{p}/psv:{p} ?n }}" for p in props.split("|"))


def category_query(classes: list[str], props: str, use_subclass: bool, regions: dict[str, dict]) -> str:
    match = "?i wdt:P31/wdt:P279* ?class" if use_subclass else "?i wdt:P31 ?class"
    return f"""{PREFIXES}{SELECT} WHERE {{
  VALUES ?class {{ {" ".join(f"wd:{c}" for c in classes)} }}
  {match} .
  {{ VALUES (?state ?region) {{ {pairs(regions, "states")} }} ?i wdt:P17 ?state }}
  UNION {{ VALUES (?country ?region) {{ {pairs(regions, "country")} }} ?i wdt:P276 ?where . ?where wdt:P17 ?country }}
  {dates(props)}
{TAIL}}}"""


def participant_query(regions: dict[str, dict]) -> str:
    """Wars a region's states fought in, which the country tag misses (spec: multi-country wars)."""
    return f"""{PREFIXES}{SELECT} WHERE {{
  VALUES (?state ?region) {{ {pairs(regions, "states")} }}
  ?i wdt:P710 ?state .
  VALUES ?class {{ wd:Q198 wd:Q178561 wd:Q188055 }}
  ?i wdt:P31/wdt:P279* ?class .
  {dates("P585|P580")}
{TAIL}}}"""


def state_query(regions: dict[str, dict]) -> str:
    """Historical states, from founding to end (P571 to P576), placed at their capital.

    A state is assigned to today's countries it lies in (P17) or whose territory holds its capital.
    """
    tail = TAIL.replace("OPTIONAL { ?i wdt:P582 ?end }", "OPTIONAL { ?i wdt:P576 ?end }").replace(
        "OPTIONAL { ?i wdt:P276/wdt:P625 ?placeCoord }", "OPTIONAL { ?i wdt:P36/wdt:P625 ?placeCoord }")
    return f"""{PREFIXES}{SELECT} WHERE {{
  ?i wdt:P31/wdt:P279* wd:Q3024240 .
  # Cities such as Milan or Verona are also filed as historical states; a state's own record isn't a city's.
  FILTER NOT EXISTS {{ VALUES ?settlement {{ wd:Q515 wd:Q486972 wd:Q747074 wd:Q1549591 wd:Q15284 wd:Q3957 wd:Q532 wd:Q200250 wd:Q1637706 }} ?i wdt:P31 ?settlement }}
  {{ VALUES (?country ?region) {{ {pairs(regions, "country")} }} ?i wdt:P17 ?country }}
  UNION {{ VALUES (?country ?region) {{ {pairs(regions, "country")} }} ?i wdt:P36 ?capital . ?capital wdt:P17 ?country }}
  {dates("P571")}
{tail}}}"""


def transport(url: str, headers: dict) -> tuple[int, dict, bytes]:
    # Sent as a form POST: a chunk with long state lists made the GET URL too long (HTTP 414).
    base, _, query = url.partition("?")
    request = urllib.request.Request(base, data=query.encode(), headers={**headers, "Accept": "application/sparql-results+json", "Content-Type": "application/x-www-form-urlencoded"})
    try:
        with urllib.request.urlopen(request, timeout=600) as r:
            return r.status, dict(r.headers), r.read()
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers or {}), e.read()
    except TimeoutError:
        return 504, {}, b""


class QLever(Connector):
    provider = "qlever-wikidata"

    def __init__(self):
        # A shared academic service: one query at a time, with a pause between them.
        super().__init__(transport=transport, limiter=RateLimiter(3), max_attempts=4)

    def search(self, query: str, cursor: str | None = None, rows: int = 0) -> Page:
        reply = self.fetch_json(f"{ENDPOINT}?{urllib.parse.urlencode({'query': query})}")
        return Page(reply["results"]["bindings"], len(reply["results"]["bindings"]), None)


def store(by_region: dict[str, list[dict]], name: str, theme: str) -> dict[str, int]:
    counts = {}
    with engine().begin() as conn:
        for rid, bindings in by_region.items():
            rows, _ = normalize(bindings, name, theme)
            if rows:
                conn.execute(UPSERT, [{**r, "r": rid, "title": json.dumps(r["title"], ensure_ascii=False)} for r in rows])
            counts[rid] = len(rows)
    return counts


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--chunk", type=int, default=25, help="countries per query")
    parser.add_argument("--only", default="", help="comma-separated categories, plus 'participants'")
    parser.add_argument("--regions", default="", help="comma-separated region ids (default: all)")
    parser.add_argument("--fresh", action="store_true", help="ignore recorded progress")
    args = parser.parse_args()

    regions = load_regions([r for r in args.regions.split(",") if r] or None)
    ids = list(regions)
    chunks = [ids[i : i + args.chunk] for i in range(0, len(ids), args.chunk)]
    names = [n for n in args.only.split(",") if n] or [*CATEGORIES, "participants", "states"]
    progress = {} if args.fresh or not PROGRESS.exists() else json.loads(PROGRESS.read_text("utf8"))
    client = QLever()
    print(f"{len(ids)} regions in {len(chunks)} chunks, categories: {names}", flush=True)

    failures = 0
    for name in names:
        for n, chunk in enumerate(chunks):
            key = f"{name}:{','.join(chunk)}"
            if progress.get(key, {}).get("status") == "ok":
                continue
            subset = {r: regions[r] for r in chunk}
            if name == "participants":
                theme, query = "war", participant_query(subset)
            elif name == "states":
                theme, query = "state", state_query(subset)
            else:
                theme, classes, props, sub = CATEGORIES[name]
                query = category_query(classes, props, sub, subset)
            started = time.time()
            try:
                bindings = client.search(query).records
            except ProviderError as e:
                failures += 1
                progress[key] = {"status": "failed", "error": str(e)}
                print(f"{name} chunk {n + 1}/{len(chunks)}: FAILED {e}", flush=True)
                PROGRESS.write_text(json.dumps(progress, indent=1), "utf8")
                continue
            by_region: dict[str, list[dict]] = defaultdict(list)
            for b in bindings:
                by_region[b["region"]["value"]].append(b)
            counts = store(by_region, name, theme)
            progress[key] = {"status": "ok", "rows": len(bindings), "stored": sum(counts.values()), "seconds": round(time.time() - started, 1), "at": time.strftime("%Y-%m-%d %H:%M")}
            PROGRESS.write_text(json.dumps(progress, indent=1), "utf8")
            print(f"{name} chunk {n + 1}/{len(chunks)}: {len(bindings)} rows, {sum(counts.values())} events in {len(counts)} countries, {time.time() - started:.0f}s", flush=True)

    print("applying filler rules...", flush=True)
    hidden = defaultdict(int)
    for rid in ids:
        for rule, count in apply_rules(rid).items():
            hidden[rule] += count
    print("hidden by rule:", dict(hidden), flush=True)
    with engine().connect() as conn:
        total = conn.execute(text("SELECT count(*), count(DISTINCT region_id) FROM imported_events WHERE workflow = 'imported'")).one()
    print(f"kept: {total[0]} events in {total[1]} countries; failed chunks: {failures}", flush=True)
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
