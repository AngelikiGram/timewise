"""Generate map-led stories from the imported records, by fixed rules.

Writes apps/web/public/data/stories/index.json and one file per story. A story is a place (a country or a
continent) in an era, told through its best-documented records in date order, three per chapter.

Rules, stated in every story:
- a record qualifies if it has an English title, a Wikidata description of 20+ characters, coordinates,
  one home country (not a multi-country event), and a date to the year or better;
- country stories use records located inside today's country; continent stories use records from at most
  two per country, so one country can't fill the story;
- the twelve records written about in the most Wikipedia languages are taken, then put in date order;
- a story needs at least six records.

Nothing is written: titles, dates, places and descriptions are Wikidata's. Run from the repository root:
python scripts/story_catalog.py
"""
import json
import shutil
from pathlib import Path

DATA = Path("apps/web/public/data")
OUT = DATA / "stories"
ERAS = [
    ("antiquity", "Antiquity", -3500, 499),
    ("middle-ages", "the Middle Ages", 500, 1499),
    ("early-modern", "1500–1800", 1500, 1799),
    ("long-19th", "1800–1914", 1800, 1913),
    ("world-wars", "1914–1945", 1914, 1945),
    ("since-1945", "since 1945", 1946, 2026),
]
# How each era reads after a place name.
TITLE = {"antiquity": " in Antiquity", "middle-ages": " in the Middle Ages", "early-modern": ", 1500–1800", "long-19th": ", 1800–1914", "world-wars": ", 1914–1945", "since-1945": " since 1945"}
CONTINENTS = {"europe": "Europe", "asia": "Asia", "africa": "Africa", "north_america": "North America", "south_america": "South America", "oceania": "Oceania"}
COUNTRIES = 48
PER_STORY = 12
MIN_STORY = 6
KEEP = ("id", "title", "description", "category", "start", "end", "precision", "lng", "lat", "links", "home", "url", "loc")


def year(iso):
    return -int(iso[1:5]) if iso.startswith("-") else int(iso[:4])


def ok(e):
    return (e.get("title", {}).get("en") and len(e.get("description") or "") >= 20 and e.get("lng") is not None
            and e.get("home") and not e.get("multi") and e.get("precision") in ("day", "month", "year"))


def pick(events, lo, hi, per_country=None):
    chosen, seen_titles, per = [], set(), {}
    for e in sorted((e for e in events if ok(e) and lo <= year(e["start"]) <= hi), key=lambda x: -x["links"]):
        t = e["title"]["en"]
        if t in seen_titles:
            continue
        if per_country and per.get(e["home"], 0) >= per_country:
            continue
        seen_titles.add(t)
        per[e["home"]] = per.get(e["home"], 0) + 1
        chosen.append({k: e[k] for k in KEEP if k in e})
        if len(chosen) == PER_STORY:
            break
    return sorted(chosen, key=lambda x: (year(x["start"]), x["start"]))


def chapters(records):
    out = []
    for i in range(0, len(records), 3):
        part = records[i:i + 3]
        a, b = year(part[0]["start"]), year(part[-1]["start"])
        fmt = lambda y: f"{-y} BC" if y < 0 else str(y)
        out.append({"label": fmt(a) if a == b else f"{fmt(a)}–{fmt(b)}", "records": part})
    return out


def write(story, index):
    (OUT / f"{story['id']}.json").write_text(json.dumps(story, ensure_ascii=False, separators=(",", ":")), "utf-8")
    index.append({k: story[k] for k in ("id", "title", "kind", "region", "regionLabel", "era", "eraLabel", "from", "to", "count")})


if OUT.exists():
    shutil.rmtree(OUT)
OUT.mkdir(parents=True)
index = []
regions = json.loads((DATA / "regions.json").read_text("utf-8"))["regions"]
labels = {r["id"]: r["label"]["en"] for r in regions}

for ct, name in CONTINENTS.items():
    events = json.loads((DATA / f"regions/{ct}.json").read_text("utf-8"))["events"]
    for era, era_label, lo, hi in ERAS:
        recs = pick(events, lo, hi, per_country=2)
        if len(recs) < MIN_STORY:
            continue
        write({
            "id": f"{ct}-{era}", "title": f"{name}{TITLE[era]}", "kind": "continent", "region": ct, "regionLabel": name,
            "era": era, "eraLabel": era_label, "from": lo, "to": hi, "count": len(recs),
            "why": f"The {len(recs)} records from {name} in {era_label} written about in the most Wikipedia languages, at most two per country, in date order.",
            "chapters": chapters(recs),
        }, index)

countries = sorted([r for r in regions if not r.get("kind")], key=lambda r: -(r.get("imported") or 0))[:COUNTRIES]
for r in countries:
    events = [e for e in json.loads((DATA / f"regions/{r['id']}.json").read_text("utf-8"))["events"] if e.get("inside")]
    for era, era_label, lo, hi in ERAS:
        recs = pick(events, lo, hi)
        if len(recs) < MIN_STORY:
            continue
        name = r["label"]["en"]
        write({
            "id": f"{r['id']}-{era}", "title": f"{name}{TITLE[era]}", "kind": "country", "region": r["id"], "regionLabel": name,
            "era": era, "eraLabel": era_label, "from": lo, "to": hi, "count": len(recs),
            "why": f"The {len(recs)} records located inside today's {name} in {era_label} written about in the most Wikipedia languages, in date order. Today's borders are used only to sort records.",
            "chapters": chapters(recs),
        }, index)

(OUT / "index.json").write_text(json.dumps({"stories": index, "labels": {k: v for k, v in labels.items()}}, ensure_ascii=False, separators=(",", ":")), "utf-8")
print(len(index), "stories;", sum(1 for s in index if s["kind"] == "country"), "country,", sum(1 for s in index if s["kind"] == "continent"), "continent")
