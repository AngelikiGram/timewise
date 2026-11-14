"""Rebuilds a region package from the database, in the same shape as the curated files.

    python -m timewise_api.export austria

The web app is built from this output, so what it displays comes from persisted rows.
"""
import json
import sys

from sqlalchemy import text

from .db import ROOT, engine


def _compact(d: dict) -> dict:
    return {k: v for k, v in d.items() if v is not None}


def _iso(value: str | None) -> str | None:
    """Postgres "0490-09-07 BC" becomes "-0490-09-07": historical numbering, with no year 0."""
    if value and value.endswith(" BC"):
        return "-" + value[:-3]
    return value


def export_region(region_id: str) -> dict:
    with engine().connect() as conn:
        def q(sql: str) -> list[dict]:
            return [dict(r._mapping) for r in conn.execute(text(sql), {"r": region_id})]

        region = q("SELECT * FROM regions WHERE id = :r")
        if not region:
            raise LookupError(f"No region {region_id}. Has it been seeded?")
        region = region[0]
        evidence: dict[str, list] = {}
        for e in q("""SELECT l.claim_id, l.source_id, l.locator, l.passage FROM evidence_links l JOIN sources s ON s.id = l.source_id
                      WHERE s.region_id = :r ORDER BY l.claim_id, l.position"""):
            evidence.setdefault(e["claim_id"], []).append({"sourceId": e["source_id"], "locator": e["locator"], "passage": e["passage"]})
        links: dict[str, list] = {}
        for g in q("SELECT geometry_id, event_id FROM geometry_events ORDER BY geometry_id, event_id"):
            links.setdefault(g["geometry_id"], []).append(g["event_id"])

        collection = {
            "_export": {"seed_sha256": region["seed_sha256"], "seeded_at": region["seeded_at"].isoformat()},
            "region": {"id": region["id"], "label": region["label"], "coverage": region["coverage"], "coverageNote": region["coverage_note"]},
            "themes": region["themes"],
            "periods": region["periods"],
            "investigations": region["investigations"],
            "sources": [
                {"id": s["id"], "provider": s["provider"], "sourceId": s["source_id"], "url": s["url"], "title": s["title"], "creator": s["creator"], "language": s["language"],
                 "recordType": s["record_type"], "rights": s["rights"], "reproduction": s["reproduction"], "attribution": s["attribution"], "retrievedAt": s["retrieved_at"].isoformat()}
                for s in q("SELECT * FROM sources WHERE region_id = :r ORDER BY id")
            ],
            "places": [
                {"id": p["id"], "wikidata": p["wikidata"], "label": p["label"], "names": p["names"], "lat": p["lat"], "lng": p["lng"], "modernCountry": p["modern_country"], "region": p["region"]}
                for p in q("SELECT *, ST_Y(geom) AS lat, ST_X(geom) AS lng FROM places WHERE region_id = :r ORDER BY id")
            ],
            "events": [
                _compact({
                    "id": e["id"], "kind": e["kind"], "chapterId": e["chapter_id"], "placeId": e["place_id"], "noPlaceReason": e["no_place_reason"], "placeNote": e["place_note"],
                    "themes": e["themes"], "people": e["people"], "title": e["title"], "summary": e["summary"], "media": e["media"],
                    "when": _compact({"start": e["date_start"].isoformat(), "end": e["date_end"].isoformat() if e["date_end"] else None, "precision": e["date_precision"], "note": e["date_note"]}),
                })
                for e in q("SELECT * FROM events WHERE region_id = :r ORDER BY date_start, id")
            ],
            "claims": [
                {"id": c["id"], "eventId": c["event_id"], "statement": c["statement"], "support": c["support"], "review": c["review"], "extraction": c["extraction"], "evidence": evidence.get(c["id"], [])}
                for c in q("SELECT c.* FROM claims c JOIN events e ON e.id = c.event_id WHERE e.region_id = :r ORDER BY c.id")
            ],
        }
        features = [
            _compact({
                "id": g["id"], "name": g["name"], "layer": g["layer"], "derivation": g["derivation"], "sourceName": g["source_name"], "sourceUrl": g["source_url"], "sourceId": g["source_id"], "locator": g["locator"],
                "crs": "EPSG:4326", "license": g["license"], "accuracy": g["accuracy"], "review": g["review"], "retrievedAt": g["retrieved_at"].isoformat(), "note": g["note"],
                "validFrom": g["valid_from"].isoformat(), "validTo": g["valid_to"].isoformat(), "snapshotYear": g["snapshot_year"], "endpoints": g["endpoints"], "osmId": g["osm_id"],
                "eventIds": links.get(g["id"], []), "geometry": g["geojson"],
            })
            for g in q("SELECT *, ST_AsGeoJSON(geom, 7)::jsonb AS geojson FROM temporal_geometries WHERE region_id = :r ORDER BY id")
        ]
        journeys = [r["content"] for r in q("SELECT content FROM journeys WHERE region_id = :r ORDER BY id")]
    return {"collection": collection, "geometries": {"features": features}, "journeys": {"journeys": journeys}}


def _outline(geojson: dict, tolerance: float):
    """Simplified present-day outline, plus the frame the atlas opens on.

    The frame covers the largest part and large parts near it, so France opens on France rather
    than on the whole globe because of its overseas departments, and the US on the contiguous states.
    """
    from shapely.geometry import mapping, shape

    geom = shape(geojson)
    parts = list(getattr(geom, "geoms", [geom]))
    main = max(parts, key=lambda g: g.area)
    simple = geom.simplify(tolerance, preserve_topology=True)
    kept = [g for g in getattr(simple, "geoms", [simple]) if g.area >= tolerance ** 2 * 4] or [main.simplify(tolerance)]
    def rounded(c):
        return [[[round(x, 3), round(y, 3)] for x, y in ring] for ring in c]
    polygons = []
    for g in kept:
        m = mapping(g)
        polygons += [rounded(m["coordinates"])] if m["type"] == "Polygon" else [rounded(poly) for poly in m["coordinates"]]
    # Islands near the largest part count too (Java and Sumatra for Indonesia), far territories don't.
    near = [g for g in parts if g.area >= main.area * 0.05 and g.centroid.distance(main.centroid) <= 25]
    w = min(g.bounds[0] for g in near); s = min(g.bounds[1] for g in near)
    e = max(g.bounds[2] for g in near); n = max(g.bounds[3] for g in near)
    return {"type": "MultiPolygon", "coordinates": polygons}, [round(w, 3), round(s, 3), round(e, 3), round(n, 3)]


def write_outlines(with_data: set[str]) -> dict[str, list[float]]:
    """public/data/world-countries.json for the coverage map, and one outline per region with data."""
    configs = ROOT / "data/source-configs/regions"
    world, frames = [], {}
    for path in sorted(configs.glob("*.boundary.geojson")):
        region_id = path.name.removesuffix(".boundary.geojson")
        config = json.loads((configs / f"{region_id}.json").read_text("utf8"))
        geojson = json.loads(path.read_text("utf8"))
        coarse, frame = _outline(geojson, 0.08)
        frames[region_id] = frame
        world.append({"type": "Feature", "properties": {"id": region_id, "name": config["label"]["en"], "iso": config.get("iso", "AT" if region_id == "austria" else None)}, "geometry": coarse})
        if region_id in with_data:
            fine, _ = _outline(geojson, 0.01)
            (ROOT / f"apps/web/public/data/regions/{region_id}.boundary.json").write_text(json.dumps(fine, separators=(",", ":")), "utf8")
    # Greenland, Western Sahara and other territories that aren't one of the sovereign-state configs,
    # so the map has no holes. They carry no id and are drawn as plain land.
    other = ROOT / "data/source-configs/world-other-territories.geojson"
    if other.exists():
        for f in json.loads(other.read_text("utf8"))["features"]:
            world.append({"type": "Feature", "properties": {"name": f["properties"]["name"], "other": True}, "geometry": f["geometry"]})
    (ROOT / "apps/web/public/data/world-countries.json").write_text(json.dumps({"type": "FeatureCollection", "features": world}, separators=(",", ":"), ensure_ascii=False), "utf8")
    return frames


def export_imported() -> dict:
    """Writes each region's imported events for the atlas, plus the list of regions that have any."""
    regions = []
    by_region: dict[str, list[dict]] = {}
    out = ROOT / "apps/web/public/data/regions"
    out.mkdir(parents=True, exist_ok=True)
    with engine().connect() as conn:
        for (region_id,) in conn.execute(text("SELECT DISTINCT region_id FROM imported_events WHERE workflow <> 'rejected' ORDER BY 1")).all():
            boundary_path = ROOT / f"data/source-configs/regions/{region_id}.boundary.geojson"
            boundary = boundary_path.read_text("utf8") if boundary_path.exists() else "null"
            rows = conn.execute(text("""
                SELECT id, title, description, category, date_start::text AS start, date_end::text AS "end", date_precision AS precision, dates_conflict AS conflict,
                       round(ST_X(geom)::numeric, 4)::float8 AS lng, round(ST_Y(geom)::numeric, 4)::float8 AS lat, location_source AS loc, url, sitelinks AS links,
                       CASE WHEN :b = 'null' THEN true ELSE ST_Intersects(geom, ST_SetSRID(ST_GeomFromGeoJSON(:b), 4326)) END AS inside
                FROM imported_events WHERE region_id = :r AND workflow <> 'rejected' ORDER BY date_start, id"""), {"r": region_id, "b": boundary})
            events = [_compact({**r._mapping, "start": _iso(r.start), "end": _iso(r.end)}) for r in rows]
            by_region[region_id] = events
            (out / f"{region_id}.json").write_text(json.dumps({"events": events}, ensure_ascii=False), "utf8")
            config = json.loads((ROOT / f"data/source-configs/regions/{region_id}.json").read_text("utf8"))
            regions.append({"id": region_id, "label": config["label"], "iso": config.get("iso", "AT" if region_id == "austria" else None),
                            "note": config.get("note"), "imported": len(events), "continent": config.get("continent")})
    frames = write_outlines({r["id"] for r in regions})
    for r in regions:
        r["bbox"] = frames.get(r["id"])
        # Curated regions have hand-checked records as well as imports (spec: "Curated and reviewed").
        r["curated"] = (ROOT / f"data/curated/{r['id']}").is_dir()
    regions.sort(key=lambda r: r["label"]["en"])
    listing = json.dumps({"regions": regions}, ensure_ascii=False, indent=1)
    (ROOT / "data/generated/regions.json").write_text(listing, "utf8")
    # The /explore picker reads the same list at runtime.
    (ROOT / "apps/web/public/data/regions.json").write_text(listing, "utf8")
    from .overview import write_overviews
    write_overviews(regions, by_region)
    return {r["id"]: r["imported"] for r in regions}


if __name__ == "__main__":
    if sys.argv[1:] == ["--imported"]:  # only the atlas files; needs no seeded region
        print("imported:", export_imported())
        raise SystemExit(0)
    region_id = sys.argv[1] if len(sys.argv) > 1 else "austria"
    data = export_region(region_id)
    out = ROOT / "data/generated" / region_id
    out.mkdir(parents=True, exist_ok=True)
    (out / "db-collection.json").write_text(json.dumps(data["collection"], ensure_ascii=False, indent=1), "utf8")
    (out / "db-geometries.json").write_text(json.dumps(data["geometries"], ensure_ascii=False), "utf8")
    (out / "db-journeys.json").write_text(json.dumps(data["journeys"], ensure_ascii=False, indent=1), "utf8")
    print("imported:", export_imported())
    print({k: len(v) for k, v in data["collection"].items() if isinstance(v, list)}, "geometries:", len(data["geometries"]["features"]))
