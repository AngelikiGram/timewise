"""Quantitative evaluation against data/eval/spatial_gold.json.

The gold set is small and written by the developer, so these numbers show the rules
behave as designed. They are not a benchmark on real archival text.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from shapely.geometry import box, shape  # noqa: E402

import pipeline as P  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]


def key(kind: str, subject: str, obj: str | None) -> tuple:
    return (kind, frozenset((subject, obj))) if kind == "connects" else (kind, subject, obj)


def run_all() -> dict:
    gold = json.loads((ROOT / "data/eval/spatial_gold.json").read_text("utf8"))
    tp = fp = fn = 0
    year_ok = year_total = 0
    for item in gold["relations"]:
        found = [r for r in P.extract_relations(item["text"]) if r.kind != "connects" or r.is_route_text]
        got = {key(r.kind, r.subject, r.obj): r for r in found}
        want = {key(w["kind"], w["subject"], w.get("object")): w for w in item["expected"]}
        tp += len(got.keys() & want.keys())
        fp += len(got.keys() - want.keys())
        fn += len(want.keys() - got.keys())
        for k in got.keys() & want.keys():
            if "year" in want[k]:
                year_total += 1
                year_ok += got[k].year == want[k]["year"]
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0

    errors = []
    within = 0
    for item in gold["locations"]:
        r = next(x for x in P.extract_relations(item["text"]) if x.kind == "offset")
        anchor = item["anchor_lnglat"]
        point = P.destination(anchor[0], anchor[1], r.bearing, r.distance_km)
        err = P.haversine_km(point, tuple(item["true_lnglat"]))
        errors.append(err)
        within += err <= P.offset_uncertainty_km(r.distance_km)

    curated = json.loads((ROOT / "data/curated/austria/geometries.json").read_text("utf8"))["features"]
    published_path = ROOT / "data/generated/austria/published.json"
    published = json.loads(published_path.read_text("utf8"))["features"] if published_path.exists() else []
    shapes = [shape(f["geometry"]) for f in curated + published]
    valid = sum(s.is_valid for s in shapes)

    return {
        "gold_set": "developer-written, not archival",
        "spatial_relation_extraction": {"precision": round(precision, 3), "recall": round(recall, 3), "tp": tp, "fp": fp, "fn": fn},
        "temporal_correctness": {"correct_years": year_ok, "total": year_total},
        "location_accuracy": {"n": len(errors), "mean_error_km": round(sum(errors) / len(errors), 1), "within_stated_uncertainty": f"{within}/{len(errors)}"},
        "topology_consistency": {"valid_geometries": valid, "total": len(shapes)},
        "boundary_overlap": {"status": "not_measured", "reason": "no polygons are reconstructed yet", "iou_self_check": P.iou(box(0, 0, 2, 2), box(1, 0, 3, 2))},
    }


if __name__ == "__main__":
    print(json.dumps(run_all(), indent=1))
