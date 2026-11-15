"""Continent and world overviews built from the per-country imports.

Writes:
- data/generated/overview.json: counts by century and category, by country and by era, the
  best-documented events of each era, and the longest-documented historical states. The overview
  pages are generated from it.
- apps/web/public/data/regions/<continent>.json and .boundary.json: a merged event list and outline,
  so the country atlas can show a whole continent.

An event filed under several countries is counted once per continent. "Best documented" means
articles in the most Wikipedia languages, which says how widely a topic is written about, not how
important it was.
"""
from __future__ import annotations

import json
import re
import sys
from collections import Counter, defaultdict

from .db import ROOT

CONTINENTS = {
    "europe": ("Europe", [-25, 34, 45, 71]),
    "asia": ("Asia", [25, -11, 150, 56]),
    "africa": ("Africa", [-20, -36, 52, 38]),
    "north_america": ("North America", [-130, 7, -55, 60]),
    "south_america": ("South America", [-82, -56, -34, 13]),
    "oceania": ("Oceania", [110, -48, 180, 0]),
}
ERAS = [("Antiquity", None, 500), ("Middle Ages", 500, 1500), ("Early modern", 1500, 1800),
        ("The long 19th century", 1800, 1914), ("World wars", 1914, 1945), ("Since 1945", 1945, None)]
# The continent map gets the best-documented events only, so the page stays quick to load.
MAP_LIMIT = 6000
# Wikidata ties some events to many countries (participants, a war's theatres, a state's successors).
# From this many on, an event is shown as "Multiple regions", never as one country's.
MULTI = 5
# From this many on, its single coordinate says little about where it happened, so it isn't pinned.
NO_PIN = 15
INSTITUTION = re.compile(r"(?i)univers|college|colegio|school|academ|institut|museum|museo|mus[eé]e|galler|librar|abbey|monaster|convent|priory|cloister|kloster|stift|hochschule|polytechn|seminar|[eé]cole|technikon|facult|cent(?:re|er)\b|training|madras|medersa|madrasa|mosque|cathedral|church|temple")
DATED = {"politics", "war", "disaster", "health"}
LEADING_YEAR = re.compile(r"^(\d{3,4})(?:s)? ")
TRAILING_YEAR = re.compile(r"\b(?:of|in) (\d{3,4})$")


def year(iso: str) -> int:
    return -int(iso[1:5]) if iso.startswith("-") else int(iso[:4])


def century(y: int) -> int:
    return (y // 100) * 100


def slim(e: dict) -> dict:
    keep = ("id", "title", "description", "category", "start", "end", "precision", "url", "links", "country", "nc", "lng", "lat", "titleYear", "incept")
    return {k: e[k] for k in keep if k in e}


def summarise(events: list[dict], countries: list[dict]) -> dict:
    by_century: dict[int, Counter] = defaultdict(Counter)
    for e in events:
        by_century[century(year(e["start"]))][e["category"]] += 1
    eras = []
    for label, start, end in ERAS:
        inside = [e for e in events if (start is None or year(e["start"]) >= start) and (end is None or year(e["start"]) < end)]
        top = sorted(inside, key=lambda e: -e.get("links", 0))[:8]
        eras.append({"label": label, "from": start, "to": end, "count": len(inside), "categories": dict(Counter(e["category"] for e in inside)),
                     "top": [slim(e) for e in sorted(top, key=lambda e: year(e["start"]))]})
    states = sorted((e for e in events if e["category"] == "state" and e.get("end")), key=lambda e: -e.get("links", 0))[:30]
    years = [year(e["start"]) for e in events]
    return {
        "events": len(events),
        "located": sum(1 for e in events if "lng" in e),
        "earliest": min(years) if years else None,
        "categories": dict(Counter(e["category"] for e in events)),
        "byCentury": [{"century": c, "counts": dict(by_century[c])} for c in sorted(by_century)],
        "countryList": sorted(countries, key=lambda c: -c["count"]),
        "eras": eras,
        "states": [slim(e) for e in sorted(states, key=lambda e: year(e["start"]))],
    }


def outline(country_ids: list[str]) -> dict | None:
    from shapely.geometry import mapping, shape
    from shapely.ops import unary_union

    shapes = []
    for rid in country_ids:
        path = ROOT / f"data/source-configs/regions/{rid}.boundary.geojson"
        if path.exists():
            shapes.append(shape(json.loads(path.read_text("utf8"))).simplify(0.05, preserve_topology=True).buffer(0))
    if not shapes:
        return None
    merged = unary_union(shapes).simplify(0.05, preserve_topology=True)
    m = mapping(merged)
    rnd = lambda ring: [[round(x, 3), round(y, 3)] for x, y in ring]
    polys = [m["coordinates"]] if m["type"] == "Polygon" else m["coordinates"]
    return {"type": "MultiPolygon", "coordinates": [[rnd(r) for r in p] for p in polys]}


def relabel(e: dict) -> None:
    """Wording that fits the record. The importer titled every dated inception "Founding of ...",
    which reads wrongly for a constitution: its inception is the date it was adopted."""
    title = e["title"].get("en") or ""
    if not title.startswith("Founding of "):
        return
    name = title[len("Founding of "):]
    if e["category"] == "politics" and "onstitution" in name:
        e["title"]["en"] = f"{name} adopted"
    elif e["category"] == "culture" and not INSTITUTION.search(name):
        # A museum record that is really a building, a camp or an object: its inception is when the
        # thing itself came into being, not a founding. Show the name and say what the date is.
        e["title"]["en"] = name
        e["incept"] = True


def title_year(e: dict) -> None:
    """Flags a record whose name gives a different year from its recorded date, such as an election
    named "1988" but dated 1998. One of the two is wrong, and the reader should be told."""
    title = e["title"].get("en") or ""
    m = LEADING_YEAR.match(title) or TRAILING_YEAR.search(title)
    # Only dated happenings: "945 Madison Avenue" is an address and "228 Incident" a day (28 February).
    if not m or e["start"].startswith("-") or e["category"] not in DATED or " Incident" in title:
        e.pop("titleYear", None)
        return
    named, start = int(m.group(1)), year(e["start"])
    end = year(e["end"]) if e.get("end") else start
    decade = title[len(m.group(1))] == "s" if m.re is LEADING_YEAR else False
    lo, hi = (named, named + 9) if decade else (named - 1, named + 1)
    if hi < start or lo > end:
        e["titleYear"] = named
    else:
        e.pop("titleYear", None)


def attribute(regions: list[dict], by_region: dict[str, list[dict]]) -> None:
    """Works out which country an event belongs to, in place.

    An event is imported once for every country Wikidata ties it to, so the Second World War arrives
    69 times. Each copy gets nc (how many countries it was filed under) and home: the one country
    whose present-day outline contains its point, if exactly one does. From MULTI countries up it is
    "multi" and never labelled as one country's."""
    filed: dict[str, list[str]] = defaultdict(list)
    inside: dict[str, list[str]] = defaultdict(list)
    for r in regions:
        for e in by_region.get(r["id"], []):
            filed[e["id"]].append(r["id"])
            if e.get("inside"):
                inside[e["id"]].append(r["id"])
    for r in regions:
        for e in by_region.get(r["id"], []):
            for k in ("nc", "home", "multi", "nopin", "incept"):
                e.pop(k, None)
            n = len(filed[e["id"]])
            homes = inside[e["id"]]
            if n > 1:
                e["nc"] = n
            if len(homes) == 1:
                e["home"] = homes[0]
            elif n == 1:
                e["home"] = r["id"]
            if n >= MULTI:
                e["multi"] = True
            if n >= NO_PIN:
                e["nopin"] = True
            relabel(e)
            title_year(e)


def merge(regions: list[dict], by_region: dict[str, list[dict]]) -> list[dict]:
    """One row per event, inside if it lies inside any of these countries. Its country is its home,
    or none when it belongs to several (attribute() must have run)."""
    merged: dict[str, dict] = {}
    for r in regions:
        for e in by_region.get(r["id"], []):
            if e["id"] in merged:
                merged[e["id"]]["inside"] = merged[e["id"]].get("inside", False) or e.get("inside", False)
            else:
                row = {**e}
                row.pop("country", None)
                if e.get("home") and not e.get("multi"):
                    row["country"] = e["home"]
                merged[e["id"]] = row
    return sorted(merged.values(), key=lambda e: (year(e["start"]), e["start"]))


def write_overviews(regions: list[dict], by_region: dict[str, list[dict]]) -> None:
    out = ROOT / "apps/web/public/data/regions"
    continents, listing = [], []
    for cid, (label, frame) in CONTINENTS.items():
        members = [r for r in regions if r.get("continent") == cid]
        events = merge(members, by_region)
        countries = [{"id": r["id"], "label": r["label"]["en"], "count": r["imported"]} for r in members]
        continents.append({"id": cid, "label": label, "countries": len(members), **summarise(events, countries)})
        shown = sorted(sorted(events, key=lambda e: -e.get("links", 0))[:MAP_LIMIT], key=lambda e: (year(e["start"]), e["start"]))
        (out / f"{cid}.json").write_text(json.dumps({"events": shown, "total": len(events)}, ensure_ascii=False), "utf8")
        shape = outline([r["id"] for r in members])
        if shape:
            (out / f"{cid}.boundary.json").write_text(json.dumps(shape, separators=(",", ":")), "utf8")
        listing.append({"id": cid, "label": {"en": label}, "kind": "continent", "imported": len(events), "bbox": frame,
                        "note": f"Today's {len(members)} countries of {label}. Events are those Wikidata ties to one of them."})
    world = merge(regions, by_region)
    countries = [{"id": r["id"], "label": r["label"]["en"], "count": r["imported"], "continent": r.get("continent")} for r in regions]
    overview = {"world": {"id": "world", "label": "The world", "countries": len(regions), **summarise(world, countries)}, "continents": continents}
    (ROOT / "data/generated/overview.json").write_text(json.dumps(overview, ensure_ascii=False), "utf8")
    (ROOT / "data/generated/continents.json").write_text(json.dumps({"continents": listing}, ensure_ascii=False, indent=1), "utf8")
    write_world(regions, by_region)
    write_index(regions, by_region)
    print("overview:", {c["id"]: c["events"] for c in continents}, "world:", overview["world"]["events"])


# The index for site-wide search and "Meanwhile, elsewhere": the best-documented events of each
# continent, plus every multi-country event, in short keys to keep the file small.
INDEX_PER_CONTINENT = 2000


def write_index(regions: list[dict], by_region: dict[str, list[dict]]) -> None:
    continent_of = {r["id"]: r.get("continent") for r in regions}
    rows: dict[str, dict] = {}
    for cid in CONTINENTS:
        members = [r for r in regions if r.get("continent") == cid]
        for e in sorted(merge(members, by_region), key=lambda e: -e.get("links", 0))[:INDEX_PER_CONTINENT]:
            if e["id"] in rows:
                continue
            home = e.get("country")
            row = {"i": e["id"], "t": e["title"].get("en") or e["title"].get("de") or e["id"], "s": e["start"], "p": e["precision"], "c": e["category"], "l": e.get("links", 0)}
            if e.get("end"):
                row["e"] = e["end"]
            if home:
                row["k"] = home
                row["ct"] = continent_of.get(home)
            if e.get("nc"):
                row["n"] = e["nc"]
            if e.get("incept"):
                row["x"] = 1
            rows[e["id"]] = row
    out = sorted(rows.values(), key=lambda r: -r["l"])
    (ROOT / "apps/web/public/data/index.json").write_text(json.dumps({"events": out}, ensure_ascii=False, separators=(",", ":")), "utf8")
    print("index:", len(out), "events")


def write_world(regions: list[dict], by_region: dict[str, list[dict]]) -> None:
    """The world map: the best-documented events anywhere, like a continent file."""
    events = merge(regions, by_region)
    shown = sorted(sorted(events, key=lambda e: -e.get("links", 0))[:MAP_LIMIT], key=lambda e: (year(e["start"]), e["start"]))
    (ROOT / "apps/web/public/data/regions/world.json").write_text(json.dumps({"events": shown, "total": len(events)}, ensure_ascii=False), "utf8")


def rebuild_from_files() -> None:
    """Re-runs attribution and the overviews from the exported country files, without the database.

        .venv/Scripts/python -m timewise_api.overview   (from apps/api)
    """
    out = ROOT / "apps/web/public/data/regions"
    regions = json.loads((ROOT / "data/generated/regions.json").read_text("utf8"))["regions"]
    by_region = {r["id"]: json.loads((out / f"{r['id']}.json").read_text("utf8"))["events"] for r in regions}
    attribute(regions, by_region)
    for rid, events in by_region.items():
        (out / f"{rid}.json").write_text(json.dumps({"events": events}, ensure_ascii=False), "utf8")
    write_overviews(regions, by_region)
    multi = sum(1 for es in by_region.values() for e in es if e.get("multi"))
    flagged = {e["id"] for es in by_region.values() for e in es if e.get("titleYear")}
    print(f"multi-country copies: {multi}; records whose name gives another year: {len(flagged)}")


if __name__ == "__main__":
    sys.exit(rebuild_from_files())
