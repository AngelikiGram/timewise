"""Loads a region package into the database. Safe to re-run: rows are upserted by ID.

    python -m timewise_api.seed austria
"""
import hashlib
import json
import sys

from sqlalchemy import text
from sqlalchemy.engine import Connection

from .db import ROOT, engine


def _upsert(conn: Connection, table: str, row: dict, casts: dict[str, str] | None = None, key: str = "id") -> None:
    casts = casts or {}
    cols = list(row)
    values = ", ".join(casts.get(c, ":{}").format(c) for c in cols)
    updates = ", ".join(f"{c} = EXCLUDED.{c}" for c in cols if c not in key.split(","))
    conn.execute(text(f"INSERT INTO {table} ({', '.join(cols)}) VALUES ({values}) ON CONFLICT ({key}) DO UPDATE SET {updates}"), row)


J = "CAST(:{} AS jsonb)"


def seed(region_id: str) -> dict:
    folder = ROOT / "data/curated" / region_id
    raw = (folder / "collection.json").read_bytes()
    c = json.loads(raw)
    features = json.loads((folder / "geometries.json").read_text("utf8"))["features"]
    dump = lambda v: json.dumps(v, ensure_ascii=False)

    with engine().begin() as conn:
        _upsert(conn, "regions", {
            "id": c["region"]["id"], "label": dump(c["region"]["label"]), "coverage": c["region"]["coverage"], "coverage_note": c["region"]["coverageNote"],
            "themes": dump(c["themes"]), "periods": dump(c["periods"]), "investigations": dump(c["investigations"]), "seed_sha256": hashlib.sha256(raw).hexdigest(),
        }, {k: J for k in ("label", "themes", "periods", "investigations")})
        for s in c["sources"]:
            _upsert(conn, "sources", {
                "id": s["id"], "region_id": region_id, "provider": s["provider"], "source_id": s["sourceId"], "url": s["url"], "title": s["title"], "creator": s["creator"],
                "language": s["language"], "record_type": s["recordType"], "rights": s["rights"], "reproduction": s["reproduction"], "attribution": s["attribution"], "retrieved_at": s["retrievedAt"],
            })
        for p in c["places"]:
            _upsert(conn, "places", {
                "id": p["id"], "region_id": region_id, "wikidata": p["wikidata"], "label": dump(p["label"]), "names": dump(p["names"]), "modern_country": p["modernCountry"], "region": p["region"],
                "geom": json.dumps({"type": "Point", "coordinates": [p["lng"], p["lat"]]}),
            }, {"label": J, "names": J, "geom": "ST_SetSRID(ST_GeomFromGeoJSON(:{}), 4326)"})
        for e in c["events"]:
            w = e["when"]
            _upsert(conn, "events", {
                "id": e["id"], "region_id": region_id, "kind": e.get("kind", "event"), "title": dump(e["title"]), "summary": dump(e["summary"]),
                "date_start": w["start"], "date_end": w.get("end"), "date_precision": w["precision"], "date_note": w.get("note"),
                "place_id": e.get("placeId"), "no_place_reason": e.get("noPlaceReason"), "place_note": e.get("placeNote"),
                "themes": e["themes"], "chapter_id": e["chapterId"], "people": e.get("people", []), "media": dump(e["media"]) if e.get("media") else None,
            }, {"title": J, "summary": J, "media": J})
        for cl in c["claims"]:
            _upsert(conn, "claims", {"id": cl["id"], "event_id": cl["eventId"], "statement": dump(cl["statement"]), "support": cl["support"], "review": cl["review"], "extraction": cl["extraction"]}, {"statement": J})
            conn.execute(text("DELETE FROM evidence_links WHERE claim_id = :id"), {"id": cl["id"]})
            for i, ev in enumerate(cl["evidence"]):
                conn.execute(text("INSERT INTO evidence_links (claim_id, source_id, locator, passage, position) VALUES (:c, :s, :l, :p, :i)"), {"c": cl["id"], "s": ev["sourceId"], "l": ev["locator"], "p": ev["passage"], "i": i})
        for f in features:
            _upsert(conn, "temporal_geometries", {
                "id": f["id"], "region_id": region_id, "name": f["name"], "layer": f["layer"], "derivation": f["derivation"], "source_name": f["sourceName"], "source_url": f.get("sourceUrl"),
                "source_id": f.get("sourceId"), "locator": f.get("locator"), "license": f["license"], "accuracy": f["accuracy"], "review": f["review"], "retrieved_at": f["retrievedAt"], "note": f["note"],
                "valid_from": f["validFrom"], "valid_to": f["validTo"], "snapshot_year": f.get("snapshotYear"), "endpoints": f.get("endpoints"), "osm_id": f.get("osmId"), "geom": json.dumps(f["geometry"]),
            }, {"geom": "ST_SetSRID(ST_GeomFromGeoJSON(:{}), 4326)"})
            conn.execute(text("DELETE FROM geometry_events WHERE geometry_id = :id"), {"id": f["id"]})
            for event_id in f["eventIds"]:
                conn.execute(text("INSERT INTO geometry_events (geometry_id, event_id) VALUES (:g, :e)"), {"g": f["id"], "e": event_id})
        journeys = json.loads((folder / "journeys.json").read_text("utf8"))["journeys"]
        for j in journeys:
            _upsert(conn, "journeys", {"id": j["id"], "region_id": region_id, "content": dump(j)}, {"content": J})
    return {"journeys": len(journeys), "sources": len(c["sources"]), "places": len(c["places"]), "events": len(c["events"]), "claims": len(c["claims"]), "geometries": len(features)}


if __name__ == "__main__":
    print(seed(sys.argv[1] if len(sys.argv) > 1 else "austria"))
