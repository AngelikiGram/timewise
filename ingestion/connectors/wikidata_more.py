"""Fills gaps the class-and-country search misses, then hides filler by recorded rules.

    python ingestion/connectors/wikidata_more.py austria

Major events are often filed under other states or none (the Thirty Years' War has no single
country), so this adds wars the region's states fought in, and the region's named landmarks.
The rules only set workflow = 'rejected', so they can be changed and nothing is deleted.
"""
from __future__ import annotations

import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(Path(__file__).parent), str(ROOT / "apps/api")]

from sqlalchemy import text  # noqa: E402
from timewise_api.db import engine  # noqa: E402
from wikidata_events import WikidataEvents, normalize  # noqa: E402

FIELDS = """?i ?en ?de ?desc ?time ?precision ?end ?coord ?placeCoord ?links"""
TAIL = """
  ?n wikibase:timeValue ?time ; wikibase:timePrecision ?precision .
  ?i wikibase:sitelinks ?links .
  OPTIONAL { ?i rdfs:label ?en FILTER(LANG(?en) = "en") }
  OPTIONAL { ?i rdfs:label ?de FILTER(LANG(?de) = "de") }
  OPTIONAL { ?i schema:description ?desc FILTER(LANG(?desc) = "en") }
  OPTIONAL { ?i wdt:P582 ?end }
  OPTIONAL { ?i wdt:P625 ?coord }
  OPTIONAL { ?i wdt:P276/wdt:P625 ?placeCoord }
"""
DATES = "{ ?i p:P585/psv:P585 ?n } UNION { ?i p:P580/psv:P580 ?n }"
WARISH = re.compile(r"\b(war|battle|siege|revolt|rebellion|uprising)\b", re.I)


def resolve(names: list[str]) -> dict[str, str]:
    """A name lookup is a candidate, so each match is printed for checking."""
    found = {}
    for name in names:
        for attempt in range(5):
            time.sleep(3 * (attempt + 1))
            url = "https://www.wikidata.org/w/api.php?" + urllib.parse.urlencode({"action": "wbsearchentities", "format": "json", "language": "en", "limit": 1, "search": name})
            try:
                hits = json.load(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "TimewiseDev/0.1 (history atlas)"}), timeout=30))["search"]
                break
            except urllib.error.HTTPError as e:
                if e.code != 429:
                    raise
                hits = []
        if hits:
            found[hits[0]["id"]] = name
            print(f"  {name} -> {hits[0]['id']} ({hits[0].get('description', '')[:70]})", flush=True)
        else:
            print(f"  {name} -> NOT FOUND", flush=True)
    return found


UPSERT = text("""
    INSERT INTO imported_events (id, region_id, provider, title, description, category, date_start, date_end, date_precision, dates_conflict, geom, location_source, sitelinks, url)
    VALUES (:id, :r, 'wikidata', CAST(:title AS jsonb), :description, :category, CAST(:date_start AS date), CAST(:date_end AS date), :date_precision, :dates_conflict,
            CASE WHEN CAST(:lng AS float8) IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint(:lng, :lat), 4326) END, :location_source, :sitelinks, :url)
    ON CONFLICT (region_id, id) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description, date_start = EXCLUDED.date_start, date_end = EXCLUDED.date_end,
      date_precision = EXCLUDED.date_precision, dates_conflict = EXCLUDED.dates_conflict, geom = EXCLUDED.geom, location_source = EXCLUDED.location_source,
      sitelinks = EXCLUDED.sitelinks, category = EXCLUDED.category, workflow = 'imported', retrieved_at = current_date""")


def store(rows: list[dict], region_id: str) -> None:
    with engine().begin() as conn:
        for r in rows:
            conn.execute(UPSERT, {**r, "r": region_id, "title": json.dumps(r["title"], ensure_ascii=False)})


# The filler rules. Each hides rows from the atlas and reports how many.
RULES = {
    "dated in the future": "date_start > current_date",
    "local election": "title->>'en' ~* '(local election|municipal|Gemeinderat|Bürgermeister|Gemeinde)'",
    "party or internal vote": "title->>'en' ~* '(Parteivorsitz|Bundesparteitag|Betriebsrat|chamber of)'",
    "minor election": "title->>'en' ~* '(election|wahl)' AND sitelinks < 3",
    "minor museum": "title->>'en' ~* '^Founding of .*(museum|gallery|galerie|collection|sammlung)' AND sitelinks < 3",
    "founding of a very recent minor institution": "title->>'en' ~ '^Founding of ' AND date_start >= '1990-01-01' AND sitelinks < 5",
}


def apply_rules(region_id: str) -> dict:
    counts = {}
    with engine().begin() as conn:
        for name, condition in RULES.items():
            counts[name] = conn.execute(text(f"UPDATE imported_events SET workflow = 'rejected' WHERE region_id = :r AND workflow = 'imported' AND ({condition})"), {"r": region_id}).rowcount
        # The label's "#section" is an article link fragment, not part of the name.
        conn.execute(text("""UPDATE imported_events SET title = jsonb_set(title, '{en}', to_jsonb(split_part(title->>'en', '#', 2))) WHERE region_id = :r AND title->>'en' LIKE '%#%'"""), {"r": region_id})
    return counts


def main() -> int:
    region_id = sys.argv[1] if len(sys.argv) > 1 else "austria"
    region = json.loads((ROOT / f"data/source-configs/regions/{region_id}.json").read_text("utf8"))
    states = " ".join(f"wd:{s}" for s in region["wikidata_states"])
    client = WikidataEvents()

    q = f"SELECT {FIELDS} WHERE {{ VALUES ?state {{ {states} }} ?i wdt:P710 ?state . {{ VALUES ?class {{ wd:Q198 wd:Q178561 wd:Q188055 }} ?i wdt:P31/wdt:P279* ?class }} {DATES} {TAIL} }}"
    rows, dropped = normalize(client.search(q).records, "war", "war")
    store(rows, region_id)
    print(f"wars with these states as participants: {len(rows)} stored, dropped {dropped}", flush=True)

    if not region.get("landmarks"):
        print("landmarks: none in this config", flush=True)
        return finish(region_id)
    print("landmarks:", flush=True)
    landmarks = resolve(region["landmarks"])
    values = " ".join(f"wd:{q}" for q in landmarks)
    q = f"SELECT {FIELDS} WHERE {{ VALUES ?i {{ {values} }} {DATES} {TAIL} }}"
    rows, dropped = normalize(client.search(q).records, "landmark", "politics")
    for r in rows:
        if WARISH.search(r["title"]["en"]):
            r["category"] = "war"
    store(rows, region_id)
    print(f"landmarks: {len(rows)} stored of {len(landmarks)}, dropped {dropped}", flush=True)
    print("missing date or label:", [landmarks[q] for q in landmarks if q not in {r['id'] for r in rows}], flush=True)
    return finish(region_id)


def finish(region_id: str) -> int:
    print("rules:", apply_rules(region_id), flush=True)
    with engine().connect() as conn:
        print("by workflow:", dict(conn.execute(text("SELECT workflow, count(*) FROM imported_events WHERE region_id = :r GROUP BY 1"), {"r": region_id}).all()), flush=True)
        print("kept by century:", [(int(c), n) for c, n in conn.execute(text("SELECT floor(extract(year from date_start)/100)*100 c, count(*) FROM imported_events WHERE region_id = :r AND workflow = 'imported' GROUP BY 1 ORDER BY 1"), {"r": region_id}).all()], flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
