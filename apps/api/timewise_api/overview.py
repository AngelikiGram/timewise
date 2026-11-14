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


def year(iso: str) -> int:
    return -int(iso[1:5]) if iso.startswith("-") else int(iso[:4])


def century(y: int) -> int:
    return (y // 100) * 100


def slim(e: dict) -> dict:
    keep = ("id", "title", "description", "category", "start", "end", "precision", "url", "links", "country", "lng", "lat")
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


def merge(regions: list[dict], by_region: dict[str, list[dict]]) -> list[dict]:
    """One row per event, inside if it lies inside any of these countries, tagged with the first country."""
    merged: dict[str, dict] = {}
    for r in regions:
        for e in by_region.get(r["id"], []):
            if e["id"] in merged:
                merged[e["id"]]["inside"] = merged[e["id"]].get("inside", False) or e.get("inside", False)
            else:
                merged[e["id"]] = {**e, "country": r["id"]}
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
    print("overview:", {c["id"]: c["events"] for c in continents}, "world:", overview["world"]["events"])
