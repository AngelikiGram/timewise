"""Repairs self-intersections that simplifying a shape can introduce. Run after build-geometries.mjs."""
import json
from pathlib import Path

from shapely.geometry import mapping, shape
from shapely.validation import explain_validity

path = Path(__file__).resolve().parents[2] / "data/curated/austria/geometries.json"
data = json.loads(path.read_text("utf8"))
for f in data["features"]:
    s = shape(f["geometry"])
    if not s.is_valid:
        print(f"repairing {f['id']}: {explain_validity(s)}")
        fixed = s.buffer(0)
        assert fixed.is_valid and fixed.geom_type in ("Polygon", "MultiPolygon")
        print(f"  area change: {abs(fixed.area - s.area) / s.area:.2%}")
        f["geometry"] = json.loads(json.dumps(mapping(fixed)))
path.write_text(json.dumps(data, indent=1), "utf8")
