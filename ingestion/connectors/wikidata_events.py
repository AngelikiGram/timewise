"""Imports dated events for a region from the Wikidata Query Service.

    python ingestion/connectors/wikidata_events.py austria

Wikidata is a discovery source, CC0, and not proof of contested history, so everything here
stays labelled as an unreviewed import. A date is kept at the precision Wikidata states.
Categories are saved one at a time, so a failure or a rate limit loses nothing.
"""
from __future__ import annotations

import json
import re
import random
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(Path(__file__).parent), str(ROOT / "apps/api")]

from base import Connector, Page, ProviderError, RateLimiter  # noqa: E402

ENDPOINT = "https://query.wikidata.org/sparql"
# class QID, date property. Foundings use inception, because that's the dated fact for an institution.
# For founding categories (P571), use direct P31 match (no subclass traversal) to avoid SPARQL timeouts.
CATEGORIES = {
    "war": ("war", ["Q198", "Q188055", "Q178561"], "P585|P580", True),
    "uprising": ("politics", ["Q10931", "Q124734", "Q45382", "Q3882219"], "P585|P580", True),
    "treaty": ("politics", ["Q131569"], "P585|P580", True),
    "vote": ("politics", ["Q43109", "Q40231"], "P585|P580", True),
    "disaster": ("disaster", ["Q8065"], "P585|P580", True),
    "university": ("culture", ["Q3918"], "P571", False),
    "monastery": ("culture", ["Q44613"], "P571", False),
    "museum": ("culture", ["Q33506"], "P571", False),
    "epidemic": ("health", ["Q3241045", "Q12184"], "P585|P580", True),
    "constitution": ("politics", ["Q7755"], "P571|P577", False),
}
CE_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}")
# Wikidata's RDF dates use astronomical years: "-0489" is 490 BC, "0000" is 1 BC.
ANY_DATE = re.compile(r"^(-?)(\d{4,})-(\d{2})-(\d{2})")


def to_date(value: str) -> tuple[int, str] | None:
    """(sort key, Postgres date literal) for a Wikidata date, or None for "unknown value" IRIs and the like."""
    m = ANY_DATE.match(value)
    if not m:
        return None
    year = -int(m[2]) if m[1] else int(m[2])
    month, day = max(1, int(m[3])), max(1, int(m[4]))
    literal = f"{year:04d}-{month:02d}-{day:02d}" if year > 0 else f"{1 - year:04d}-{month:02d}-{day:02d} BC"
    return year * 10000 + month * 100 + day, literal
PRECISION = {7: "century", 8: "decade", 9: "year", 10: "month", 11: "day"}


class JitteredRateLimiter(RateLimiter):
    """Rate limiter with random jitter to avoid thundering herd."""
    def __init__(self, min_interval_s: float, jitter: float = 0.1, **kwargs):
        super().__init__(min_interval_s, **kwargs)
        self.jitter = jitter

    def wait(self) -> None:
        super().wait()
        # Add jitter: ±jitter * min_interval_s
        jitter_amount = self.min_interval_s * self.jitter * random.uniform(-1, 1)
        if jitter_amount > 0:
            self.sleep(jitter_amount)


def build_query(classes: list[str], date_props: str, states: list[str], country: str, use_subclass: bool = True) -> str:
    """Build a query for a single class (to avoid SPARQL timeouts with many classes/states)."""
    values = " ".join(f"wd:{c}" for c in classes)
    state_values = " ".join(f"wd:{s}" for s in states)
    dates = " UNION ".join(f"{{ ?i p:{p}/psv:{p} ?n }}" for p in date_props.split("|"))
    class_match = "?i wdt:P31/wdt:P279* ?class" if use_subclass else "?i wdt:P31 ?class"
    return f"""
SELECT ?i ?en ?de ?desc ?time ?precision ?end ?coord ?placeCoord ?links WHERE {{
  VALUES ?class {{ {values} }}
  {class_match} .
  {{ VALUES ?state {{ {state_values} }} ?i wdt:P17 ?state }}
  UNION {{ ?i wdt:P276 ?where . ?where wdt:P17 wd:{country} }}
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


def parse_point(wkt: str | None) -> tuple[float, float] | None:
    # WDQS writes "Point(lng lat)", QLever "POINT(lng lat)"; both are WKT.
    if not wkt or not wkt.upper().startswith("POINT("):
        return None
    lng, lat = (float(v) for v in wkt[6:].rstrip(")").split()[:2])
    return (lng, lat) if -180 <= lng <= 180 and -90 <= lat <= 90 else None


def normalize(bindings: list[dict], category: str, theme: str) -> tuple[list[dict], dict]:
    """One row per item. Dropped rows are counted, never silently patched up."""
    grouped: dict[str, list[dict]] = {}
    for b in bindings:
        grouped.setdefault(b["i"]["value"].rsplit("/", 1)[-1], []).append(b)
    rows, dropped = [], {"no_label": 0, "unknown_or_too_vague": 0}
    for qid, group in grouped.items():
        first = group[0]
        en = first.get("en", {}).get("value")
        de = first.get("de", {}).get("value")
        if not en and not de:
            dropped["no_label"] += 1
            continue
        dates: dict[str, int] = {}
        keys: dict[str, int] = {}
        for b in group:
            value, precision = b["time"]["value"], int(b["precision"]["value"])
            # Wikidata's "unknown value" arrives as an IRI. BC dates are kept, in Postgres's "0490-09-07 BC" form.
            parsed = to_date(value)
            if precision in PRECISION and parsed:
                keys[parsed[1]], dates[parsed[1]] = parsed[0], precision
        if not dates:
            dropped["unknown_or_too_vague"] += 1
            continue
        start = max(dates, key=lambda d: (dates[d], -keys[d]))
        end_parsed = next((p for p in (to_date(b["end"]["value"]) for b in group if b.get("end")) if p), None)
        point = next((p for p in (parse_point(b.get("coord", {}).get("value")) for b in group) if p), None)
        source = "event" if point else None
        if not point:
            point = next((p for p in (parse_point(b.get("placeCoord", {}).get("value")) for b in group) if p), None)
            source = "place" if point else None
        if not point:
            # The district or town it is in (P131): approximate, and labelled so.
            point = next((p for p in (parse_point(b.get("areaCoord", {}).get("value")) for b in group) if p), None)
            source = "area" if point else None
        precision = PRECISION[dates[start]]
        founding = category in ("university", "monastery", "museum", "constitution")
        rows.append({
            "id": qid,
            "title": {"en": (f"Founding of {en}" if founding and en else en) or de, **({"de": de} if de else {})},
            "description": first.get("desc", {}).get("value"),
            "category": theme,
            "date_start": start,
            "date_end": end_parsed[1] if end_parsed and end_parsed[0] >= keys[start] and precision in ("day", "month", "year") else None,
            "date_precision": precision,
            "dates_conflict": len(dates) > 1,
            "lng": point[0] if point else None,
            "lat": point[1] if point else None,
            "location_source": source,
            "sitelinks": int(first["links"]["value"]),
            "url": f"https://www.wikidata.org/wiki/{qid}",
        })
    return rows, dropped


def transport(url: str, headers: dict) -> tuple[int, dict, bytes]:
    request = urllib.request.Request(url, headers={**headers, "Accept": "application/sparql-results+json"})
    try:
        with urllib.request.urlopen(request, timeout=90) as r:
            return r.status, dict(r.headers), r.read()
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers or {}), e.read()
    except TimeoutError:
        return 504, {}, b""


class WikidataEvents(Connector):
    provider = "wikidata"

    def __init__(self, **kwargs):
        # The service limits to one request a minute ("Aggressively rate-limiting to 1 req / min"),
        # and a burst only earns a longer wait. 62s base interval with jitter; on 429 the base class backs off.
        super().__init__(transport=transport, limiter=JitteredRateLimiter(62, jitter=0.1), max_attempts=5, **kwargs)

    def search(self, query: str, cursor: str | None = None, rows: int = 0) -> Page:
        reply = self.fetch_json(f"{ENDPOINT}?{urllib.parse.urlencode({'query': query})}")
        return Page(reply["results"]["bindings"], len(reply["results"]["bindings"]), None)


def search_class_by_class(client: WikidataEvents, classes: list[str], props: str, states: list[str], country: str, use_subclass: bool = True) -> list[dict]:
    """Query each class separately to avoid SPARQL timeouts."""
    all_bindings = []
    for cls in classes:
        query = build_query([cls], props, states, country, use_subclass)
        page = client.search(query)
        all_bindings.extend(page.records)
    return all_bindings


def main() -> int:
    from sqlalchemy import text
    from timewise_api.db import engine

    args = [a for a in sys.argv[1:] if a != "--skip-done"]
    region_id = args[0] if args else "austria"
    only = args[1:] or list(CATEGORIES)
    region = json.loads((ROOT / f"data/source-configs/regions/{region_id}.json").read_text("utf8"))
    if "--skip-done" in sys.argv:
        # A retry or resumed run only repeats what failed. "Done" means completed in the last 7 days.
        with engine().connect() as conn:
            done = {q.split(":", 1)[1] for (q,) in conn.execute(text(
                "SELECT query FROM ingestion_runs WHERE provider = 'wikidata' AND status = 'completed' AND query LIKE :p AND finished_at > now() - interval '7 days'"),
                {"p": f"{region_id}:%"}).all()}
        if skipped := [c for c in only if c in done]:
            print(f"already done in the last 7 days, skipping: {skipped}", flush=True)
        only = [c for c in only if c not in done]
    states = list(region["wikidata_states"])
    client = WikidataEvents()
    upsert = text("""
        INSERT INTO imported_events (id, region_id, provider, title, description, category, date_start, date_end, date_precision, dates_conflict, geom, location_source, sitelinks, url)
        VALUES (:id, :r, 'wikidata', CAST(:title AS jsonb), :description, :category, CAST(:date_start AS date), CAST(:date_end AS date), :date_precision, :dates_conflict,
                CASE WHEN CAST(:lng AS float8) IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint(:lng, :lat), 4326) END, :location_source, :sitelinks, :url)
        ON CONFLICT (region_id, id) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description, date_start = EXCLUDED.date_start, date_end = EXCLUDED.date_end,
          date_precision = EXCLUDED.date_precision, dates_conflict = EXCLUDED.dates_conflict, geom = EXCLUDED.geom, location_source = EXCLUDED.location_source,
          sitelinks = EXCLUDED.sitelinks, retrieved_at = current_date""")
    status = 0
    for name in only:
        theme, classes, props, use_subclass = CATEGORIES[name]
        with engine().begin() as conn:
            run_id = conn.execute(text("INSERT INTO ingestion_runs (provider, query) VALUES ('wikidata', :q) RETURNING id"), {"q": f"{region_id}:{name}"}).scalar()
        try:
            # Query each class separately to avoid SPARQL timeouts
            bindings = search_class_by_class(client, classes, props, states, region["wikidata_country"], use_subclass)
            rows, dropped = normalize(bindings, name, theme)
            with engine().begin() as conn:
                for r in rows:
                    conn.execute(upsert, {**r, "r": region_id, "title": json.dumps(r["title"], ensure_ascii=False)})
                conn.execute(text("UPDATE ingestion_runs SET status='completed', finished_at=now(), inserted=:n WHERE id=:id"), {"n": len(rows), "id": run_id})
            years = sorted(r["date_start"][:4] for r in rows)
            print(f"{name}: {len(rows)} stored, dropped {dropped}, years {years[0] if years else '-'}..{years[-1] if years else '-'}; e.g. {[r['title']['en'] for r in rows[:4]]}", flush=True)
        except ProviderError as e:
            status = 1
            print(f"{name}: FAILED {e}", flush=True)
            with engine().begin() as conn:
                conn.execute(text("UPDATE ingestion_runs SET status='failed', finished_at=now(), error=:e WHERE id=:id"), {"e": str(e), "id": run_id})
    return status


if __name__ == "__main__":
    raise SystemExit(main())
