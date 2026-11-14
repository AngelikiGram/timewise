"""Imports dated events for every region at once from the Wikidata Query Service.

    .venv/Scripts/python ingestion/connectors/wikidata_world.py [category ...] [--fresh]

The per-region connector (wikidata_events.py) sends about 15 queries per country, and the service
allows one query a minute, so the world took days. This sends a few queries per category for the
whole world and sorts the results into regions here:

1. The subclasses of each category's classes, fetched once, so later queries match `wdt:P31` directly
   instead of walking `wdt:P279*` for every item (that walk is what kept timing out).
2. Which items of those classes belong to which state, by P17 (country), P276/P17 (located in a
   place in the country) or, for wars, P710 (participant). The rules match the per-region connector.
3. Dates, labels, coordinates and sitelinks for the matched items, in batches.

Every reply is cached under data/generated/wikidata-world/, so a stopped run picks up where it was.
--fresh ignores the cache. Wikidata is a discovery source (CC0), so everything stays an unreviewed import.
"""
from __future__ import annotations

import http.client
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(Path(__file__).parent), str(ROOT / "apps/api")]

from wikidata_events import CATEGORIES, normalize  # noqa: E402

ENDPOINT = "https://query.wikidata.org/sparql"
# TIMEWISE_CACHE moves the reply cache (a few hundred MB for the world) to another drive.
CACHE = Path(os.environ["TIMEWISE_CACHE"]) if os.environ.get("TIMEWISE_CACHE") else ROOT / "data/generated/wikidata-world"
REGIONS = ROOT / "data/source-configs/regions"
UA = "TimewiseDev/0.1 (history atlas; world import)"
INTERVAL_S = 62  # "Aggressively rate-limiting to 1 req / min"
CLASS_CHUNK = 300
DETAIL_CHUNK = 1000

# Wars a region's states took part in, which the class-and-country search misses (from wikidata_more.py).
EXTRA = {"participant_war": ("war", ["Q198", "Q188055", "Q178561"], "P585|P580", True)}
ALL = {**CATEGORIES, **EXTRA}
# Rows from the participant search are stored under the "war" category name, as wikidata_more.py does.
STORED_AS = {"participant_war": "war"}


class Timeout(Exception):
    pass


_last = 0.0


def sparql(query: str) -> list[dict]:
    """POST, so long VALUES lists fit. Waits out the rate limit; a query timeout is raised for splitting."""
    global _last
    body = urllib.parse.urlencode({"query": query}).encode()
    for attempt in range(8):
        wait = INTERVAL_S - (time.monotonic() - _last)
        if wait > 0:
            time.sleep(wait)
        _last = time.monotonic()
        req = urllib.request.Request(ENDPOINT, data=body, headers={
            "User-Agent": UA, "Accept": "application/sparql-results+json", "Content-Type": "application/x-www-form-urlencoded"})
        try:
            with urllib.request.urlopen(req, timeout=150) as r:
                raw = r.read()
            try:
                return json.loads(raw)["results"]["bindings"]
            except (json.JSONDecodeError, KeyError):
                # A query that runs out of time can return a truncated body with status 200.
                raise Timeout("truncated reply")
        except urllib.error.HTTPError as e:
            text = e.read().decode("utf8", "replace")
            if e.code in (500, 502, 504) and ("TimeoutException" in text or "timeout" in text.lower()):
                raise Timeout(f"HTTP {e.code}")
            if e.code == 429 or e.code >= 500:
                retry = e.headers.get("Retry-After")
                pause = float(retry) if retry and retry.isdigit() else 60 * (attempt + 1)
                print(f"    HTTP {e.code}, waiting {pause:.0f}s", flush=True)
                time.sleep(pause)
                continue
            raise
        except (http.client.HTTPException, ConnectionError) as e:
            # e.g. IncompleteRead when the service drops a long reply. Not the query's fault: retry it.
            print(f"    connection dropped ({e!r}), retrying", flush=True)
            time.sleep(60)
            continue
        except (TimeoutError, urllib.error.URLError) as e:
            if isinstance(e, urllib.error.URLError) and not isinstance(getattr(e, "reason", None), TimeoutError):
                print(f"    network error {e}, retrying", flush=True)
                time.sleep(60)
                continue
            raise Timeout("client timeout")
    raise RuntimeError("Wikidata kept refusing")


def cached(name: str, fresh: bool, compute):
    path = CACHE / f"{name}.json"
    if path.exists() and not fresh:
        return json.loads(path.read_text("utf8"))
    value = compute()
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(value), "utf8")
    tmp.replace(path)  # atomic, so a full disk or a crash never leaves half a file to be read back
    return value


def qid(b: dict, key: str) -> str:
    return b[key]["value"].rsplit("/", 1)[-1]


def load_regions() -> tuple[dict[str, set[str]], dict[str, set[str]]]:
    """state QID -> regions (any listed state), country QID -> regions (the place-in-country path)."""
    by_state: dict[str, set[str]] = {}
    by_country: dict[str, set[str]] = {}
    for path in sorted(REGIONS.glob("*.json")):
        if path.name.endswith(".boundary.geojson"):
            continue
        config = json.loads(path.read_text("utf8"))
        for s in config["wikidata_states"]:
            by_state.setdefault(s, set()).add(config["id"])
        by_country.setdefault(config["wikidata_country"], set()).add(config["id"])
    return by_state, by_country


def class_closure(name: str, roots: list[str], use_subclass: bool, fresh: bool) -> list[str]:
    if not use_subclass:
        return roots
    def compute():
        values = " ".join(f"wd:{r}" for r in roots)
        found = {qid(b, "c") for b in sparql(f"SELECT DISTINCT ?c WHERE {{ VALUES ?root {{ {values} }} ?c wdt:P279* ?root }}")}
        return sorted(found | set(roots))
    return cached(f"classes-{name}", fresh, compute)


def membership(name: str, classes: list[str], fresh: bool) -> list[list[str]]:
    """[item, state, via] triples. A chunk that times out is split in half and retried."""
    if name == "participant_war":
        pattern = "?i wdt:P710 ?s . BIND('p710' AS ?via)"
    else:
        pattern = "{ ?i wdt:P17 ?s . BIND('p17' AS ?via) } UNION { ?i wdt:P276 ?where . ?where wdt:P17 ?s . BIND('p276' AS ?via) }"

    def fetch(chunk: list[str], label: str) -> list[list[str]]:
        def compute():
            values = " ".join(f"wd:{c}" for c in chunk)
            try:
                rows = sparql(f"SELECT DISTINCT ?i ?s ?via WHERE {{ VALUES ?class {{ {values} }} ?i wdt:P31 ?class . {pattern} }}")
            except Timeout as e:
                if len(chunk) == 1:
                    print(f"    class {chunk[0]} times out on its own ({e}); skipped", flush=True)
                    return {"skipped": chunk, "rows": []}
                print(f"    {len(chunk)} classes timed out ({e}); splitting", flush=True)
                half = len(chunk) // 2
                return {"rows": fetch(chunk[:half], label + "a") + fetch(chunk[half:], label + "b")}
            return {"rows": [[qid(b, "i"), qid(b, "s"), b["via"]["value"]] for b in rows]}
        return cached(f"members-{name}-{label}", fresh, compute)["rows"]

    out = []
    for n, start in enumerate(range(0, len(classes), CLASS_CHUNK)):
        rows = fetch(classes[start:start + CLASS_CHUNK], str(n))
        print(f"  membership chunk {n}: {len(rows)} links", flush=True)
        out += rows
    return out


def details(name: str, items: list[str], date_props: str, fresh: bool) -> list[dict]:
    dates = " UNION ".join(f"{{ ?i p:{p}/psv:{p} ?n }}" for p in date_props.split("|"))
    out = []
    for n, start in enumerate(range(0, len(items), DETAIL_CHUNK)):
        chunk = items[start:start + DETAIL_CHUNK]

        def compute(chunk=chunk):
            values = " ".join(f"wd:{i}" for i in chunk)
            q = f"""SELECT ?i ?en ?de ?desc ?time ?precision ?end ?coord ?placeCoord ?links WHERE {{
  VALUES ?i {{ {values} }}
  {dates}
  ?n wikibase:timeValue ?time ; wikibase:timePrecision ?precision .
  ?i wikibase:sitelinks ?links .
  OPTIONAL {{ ?i rdfs:label ?en FILTER(LANG(?en) = "en") }}
  OPTIONAL {{ ?i rdfs:label ?de FILTER(LANG(?de) = "de") }}
  OPTIONAL {{ ?i schema:description ?desc FILTER(LANG(?desc) = "en") }}
  OPTIONAL {{ ?i wdt:P582 ?end }}
  OPTIONAL {{ ?i wdt:P625 ?coord }}
  OPTIONAL {{ ?i wdt:P276/wdt:P625 ?placeCoord }}
}}"""
            try:
                return sparql(q)
            except Timeout:
                # Detail queries are cheap, so this is rare. A single item that times out is skipped.
                if len(chunk) == 1:
                    print(f"    details for {chunk[0]} time out; skipped", flush=True)
                    return []
                half = len(chunk) // 2
                print("    detail batch timed out; splitting", flush=True)
                return compute(chunk[:half]) + compute(chunk[half:])
        rows = cached(f"details-{name}-{n}", fresh, compute)
        print(f"  details batch {n}: {len(rows)} rows", flush=True)
        out += rows
    return out


UPSERT = """
    INSERT INTO imported_events (id, region_id, provider, title, description, category, date_start, date_end, date_precision, dates_conflict, geom, location_source, sitelinks, url)
    VALUES (:id, :r, 'wikidata', CAST(:title AS jsonb), :description, :category, CAST(:date_start AS date), CAST(:date_end AS date), :date_precision, :dates_conflict,
            CASE WHEN CAST(:lng AS float8) IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint(:lng, :lat), 4326) END, :location_source, :sitelinks, :url)
    ON CONFLICT (region_id, id) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description, date_start = EXCLUDED.date_start, date_end = EXCLUDED.date_end,
      date_precision = EXCLUDED.date_precision, dates_conflict = EXCLUDED.dates_conflict, geom = EXCLUDED.geom, location_source = EXCLUDED.location_source,
      sitelinks = EXCLUDED.sitelinks, retrieved_at = current_date"""


def run_category(name: str, by_state, by_country, fresh: bool) -> int:
    from sqlalchemy import text
    from timewise_api.db import engine

    theme, roots, props, use_subclass = ALL[name]
    category = STORED_AS.get(name, name)
    with engine().begin() as conn:
        run_id = conn.execute(text("INSERT INTO ingestion_runs (provider, query) VALUES ('wikidata', :q) RETURNING id"), {"q": f"world:{name}"}).scalar()
    try:
        classes = class_closure(name, roots, use_subclass, fresh)
        print(f"{name}: {len(classes)} classes", flush=True)
        regions_of: dict[str, set[str]] = {}
        for item, state, via in membership(name, classes, fresh):
            targets = by_country.get(state, set()) if via == "p276" else by_state.get(state, set())
            if targets:
                regions_of.setdefault(item, set()).update(targets)
        print(f"  {len(regions_of)} items belong to a region", flush=True)
        bindings = details(name, sorted(regions_of), props, fresh)
        rows, dropped = normalize(bindings, category, theme)
        params = [{**r, "r": region, "title": json.dumps(r["title"], ensure_ascii=False)} for r in rows for region in sorted(regions_of.get(r["id"], ()))]
        with engine().begin() as conn:
            for start in range(0, len(params), 2000):
                conn.execute(text(UPSERT), params[start:start + 2000])
            conn.execute(text("UPDATE ingestion_runs SET status='completed', finished_at=now(), inserted=:n WHERE id=:id"), {"n": len(params), "id": run_id})
        print(f"{name}: {len(rows)} events, {len(params)} region rows stored, dropped {dropped}", flush=True)
        return 0
    except Exception as e:
        with engine().begin() as conn:
            conn.execute(text("UPDATE ingestion_runs SET status='failed', finished_at=now(), error=:e WHERE id=:id"), {"e": repr(e)[:500], "id": run_id})
        print(f"{name}: FAILED {e!r}", flush=True)
        return 1


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    fresh = "--fresh" in sys.argv
    names = args or list(ALL)
    by_state, by_country = load_regions()
    print(f"{len(by_country)} regions, {len(by_state)} states; categories {names}", flush=True)
    status = 0
    for name in names:
        status |= run_category(name, by_state, by_country, fresh)
    return status


if __name__ == "__main__":
    raise SystemExit(main())
