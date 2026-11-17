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
# Every country gets a path, staged by era. A stage needs four qualifying records inside the country.
ERAS = [("antiquity", -3500, 499), ("middle-ages", 500, 1499), ("early-modern", 1500, 1799), ("long-19th", 1800, 1913), ("world-wars", 1914, 1945), ("since-1945", 1946, 2026)]


def ok(e):
    return (e.get("title", {}).get("en") and len(e.get("description") or "") >= 20 and e.get("home") and not e.get("multi")
            and e.get("lng") is not None and e.get("precision") in ("day", "month", "year") and not e["start"].startswith("-"))


def place_ok(e):
    # Place paths may reach into antiquity, where dates are often given to the decade.
    return (e.get("title", {}).get("en") and len(e.get("description") or "") >= 20 and e.get("home") and not e.get("multi")
            and e.get("lng") is not None and e.get("precision") in ("day", "month", "year", "decade") and e.get("inside"))


def year(e):
    return -int(e["start"][1:5]) if e["start"].startswith("-") else int(e["start"][:4])


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
for r in sorted([r for r in regions if not r.get("kind")], key=lambda r: r["label"]["en"]):
    ev = [e for e in json.loads((DATA / f"regions/{r['id']}.json").read_text("utf-8"))["events"] if place_ok(e)]
    eras = [name for name, lo, hi in ERAS if enough([e for e in ev if lo <= year(e) <= hi], False)]
    if eras:
        out["place"][r["id"]] = {"label": r["label"]["en"], "continent": r.get("continent"), "eras": eras}
Path("apps/web/src/lib/journey-catalog.json").write_text(json.dumps(out, indent=1), "utf-8")
print({k: len(v) for k, v in out.items()}, sum(len(v) for v in out["region"].values()))
