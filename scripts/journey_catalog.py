"""Which generated journeys have enough records to build honestly.

Writes apps/web/src/lib/journey-catalog.json. The rules mirror pickEvents() in apps/web/src/lib/lessons.ts:
a record qualifies if it has an English title, a Wikidata description of 20+ characters, a single home
country, coordinates, and a date to the year or better (AD). A lesson needs four qualifying records:
from four different countries for region and topic journeys, or inside the country for place journeys.
Run from the repository root after the data export: python scripts/journey_catalog.py
"""
import json
from pathlib import Path

DATA = Path("apps/web/public/data")
CENTURIES = [15, 16, 17, 18, 19]
CONTINENTS = ["europe", "asia", "africa", "north_america", "south_america", "oceania"]
TOPICS = ["war", "politics", "culture", "state"]
PLACES = 24  # the countries with the most imported records


def ok(e):
    return (e.get("title", {}).get("en") and len(e.get("description") or "") >= 20 and e.get("home") and not e.get("multi")
            and e.get("lng") is not None and e.get("precision") in ("day", "month", "year") and not e["start"].startswith("-"))


def century(e):
    return int(e["start"][:4]) // 100


def enough(events, distinct_home):
    seen_home, seen_desc, seen_title, n = set(), set(), set(), 0
    for e in sorted(events, key=lambda x: -x["links"]):
        if (distinct_home and e["home"] in seen_home) or e["description"] in seen_desc or e["title"]["en"] in seen_title:
            continue
        seen_home.add(e["home"]); seen_desc.add(e["description"]); seen_title.add(e["title"]["en"]); n += 1
        if n == 4:
            return True
    return False


out = {"region": {}, "topic": {}, "place": {}}
for ct in CONTINENTS:
    ev = [e for e in json.loads((DATA / f"regions/{ct}.json").read_text("utf-8"))["events"] if ok(e)]
    out["region"][ct] = [c for c in CENTURIES if enough([e for e in ev if century(e) == c], True)]
    for t in TOPICS:
        cs = [c for c in CENTURIES if enough([e for e in ev if century(e) == c and e["category"] == t], True)]
        if len(cs) >= 2:
            out["topic"][f"{t}-{ct}"] = cs
regions = json.loads((DATA / "regions.json").read_text("utf-8"))["regions"]
countries = sorted([r for r in regions if not r.get("kind")], key=lambda r: -(r.get("imported") or 0))[:PLACES]
for r in countries:
    ev = [e for e in json.loads((DATA / f"regions/{r['id']}.json").read_text("utf-8"))["events"] if ok(e) and e.get("inside")]
    cs = [c for c in CENTURIES + [20] if enough([e for e in ev if century(e) == c], False)]
    if len(cs) >= 2:
        out["place"][r["id"]] = {"label": r["label"]["en"], "centuries": cs}
Path("apps/web/src/lib/journey-catalog.json").write_text(json.dumps(out, indent=1), "utf-8")
print({k: len(v) for k, v in out.items()}, sum(len(v) for v in out["region"].values()))
