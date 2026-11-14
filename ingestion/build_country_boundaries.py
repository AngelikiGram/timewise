"""Writes <region>.boundary.geojson for each generated region config from Natural Earth outlines.

    .venv\\Scripts\\python ingestion/build_country_boundaries.py path/to/ne_50m_admin_0_countries.geojson

Natural Earth 1:50m admin-0 countries, v5.1.2, public domain:
https://github.com/nvkelso/natural-earth-vector/blob/v5.1.2/geojson/ne_50m_admin_0_countries.geojson
These are present-day outlines at small scale. They only decide whether an imported event lies
inside today's country, which is what the atlas's location filter shows. They aren't historical borders.
Existing boundary files (Austria's) are never overwritten.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REGIONS = ROOT / "data/source-configs/regions"


def main() -> int:
    ne = json.loads(Path(sys.argv[1]).read_text("utf8"))
    by_iso: dict[str, list[dict]] = {}
    for f in ne["features"]:
        p = f["properties"]
        for iso in {p.get("ISO_A2_EH"), p.get("ISO_A2")} - {None, "-99"}:
            by_iso.setdefault(iso, []).append(f)
    written, missing = 0, []
    for path in sorted(REGIONS.glob("*.json")):
        if path.name.endswith(".boundary.geojson"):
            continue
        config = json.loads(path.read_text("utf8"))
        out = REGIONS / f"{config['id']}.boundary.geojson"
        if out.exists() or "iso" not in config:
            continue
        features = by_iso.get(config["iso"])
        if not features:
            missing.append(config["id"])
            continue
        polygons = []
        for f in features:
            g = f["geometry"]
            polygons += [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
        geometry = {"type": "MultiPolygon", "coordinates": [[[[round(x, 4), round(y, 4)] for x, y in ring] for ring in poly] for poly in polygons]}
        out.write_text(json.dumps(geometry, separators=(",", ":")), "utf8")
        written += 1
    print(f"wrote {written} boundaries; no Natural Earth outline for: {missing or 'none'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
