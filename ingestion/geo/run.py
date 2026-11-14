"""Runs the pipeline over the region package's live source pages.

    python ingestion/geo/run.py

Writes data/generated/austria/reconstruction.json (everything, with reasons) and
published.json (only validated features), and publishes only if the evaluation gate passes.
"""
from __future__ import annotations

import html
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).parent))

from shapely.geometry import shape  # noqa: E402

import evaluate  # noqa: E402
import pipeline as P  # noqa: E402

REGION = ROOT / "data/curated/austria"
OUT = ROOT / "data/generated/austria"
CACHE = OUT / "wikidata-cache.json"
BBOX = (8.0, 42.5, 24.0, 52.0)  # the Habsburg lands and neighbours; belongs in region config as packages grow
HEADERS = {"User-Agent": "TimewiseDev/0.1 (spatial extraction)"}
PUBLISH_MIN_PRECISION = 0.9


def get(url: str) -> bytes:
    for attempt in range(5):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=30) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code != 429 or attempt == 4:
                raise
            wait = int(e.headers.get("Retry-After") or 0) or 5 * (attempt + 1)
            print(f"  rate limited, waiting {wait}s")
            time.sleep(min(wait, 60))
    raise RuntimeError("unreachable")


def page_text(url: str) -> str:
    raw = get(urllib.parse.quote(url, safe=":/()%")).decode("utf8", "replace")
    raw = re.sub(r"(?s)<(script|style|table)\b.*?</\1>", " ", raw)
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", raw)))


def wikidata_candidates(name: str, cache: dict) -> list[P.Candidate]:
    if name not in cache:
        time.sleep(1.5)
        q = urllib.parse.urlencode({"action": "wbsearchentities", "format": "json", "language": "en", "limit": 7, "search": name})
        hits = json.loads(get(f"https://www.wikidata.org/w/api.php?{q}")).get("search", [])
        rows = []
        if hits:
            ids = "|".join(h["id"] for h in hits)
            time.sleep(1.5)
            q2 = urllib.parse.urlencode({"action": "wbgetentities", "format": "json", "props": "claims", "ids": ids})
            reply = json.loads(get(f"https://www.wikidata.org/w/api.php?{q2}"))
            if "entities" not in reply:  # throttled replies must not be cached as "no such place"
                raise urllib.error.URLError(f"Wikidata returned no entities: {reply.get('error', {}).get('code')}")
            entities = reply["entities"]
            for h in hits:
                try:
                    c = entities[h["id"]]["claims"]["P625"][0]["mainsnak"]["datavalue"]["value"]
                except (KeyError, IndexError):
                    continue
                rows.append({"qid": h["id"], "label": h.get("label", name), "description": h.get("description", ""), "lat": c["latitude"], "lng": c["longitude"]})
        cache[name] = rows
    return [P.Candidate(**r) for r in cache[name]]


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    collection = json.loads((REGION / "collection.json").read_text("utf8"))
    curated = json.loads((REGION / "geometries.json").read_text("utf8"))["features"]
    cache = json.loads(CACHE.read_text("utf8")) if CACHE.exists() else {}
    snapshots = [(g["validFrom"], g["validTo"], shape(g["geometry"]).buffer(0)) for g in curated if g["derivation"] == "community_digitized"]
    curated_ends = {frozenset(g.get("endpoints", [])) for g in curated if g.get("endpoints")}

    relations: list[P.Relation] = []
    failed = []
    for s in collection["sources"]:
        try:
            found = P.extract_relations(page_text(s["url"]), s["id"])
            relations += found
            print(f"{s['id']}: {len(found)} relations")
        except Exception as e:  # one unreachable provider mustn't stop the run
            failed.append(s["id"])
            print(f"{s['id']}: FAILED {e}")

    # Merge sightings of the same pair across documents before building anything.
    by_pair: dict[frozenset, list[P.Relation]] = defaultdict(list)
    for r in relations:
        if r.kind == "connects" and r.is_route_text:
            by_pair[frozenset((r.subject, r.obj))].append(r)
    skipped = sum(1 for r in relations if r.kind == "connects" and not r.is_route_text)

    features: list[dict] = []
    tally = defaultdict(int)
    for pair, rs in by_pair.items():
        first = rs[0]
        try:
            cands = [P.filter_candidates(wikidata_candidates(n, cache), BBOX) for n in (first.subject, first.obj)]
        except urllib.error.URLError as e:  # lookup unavailable: leave it unresolved and retry on the next run
            print(f"  lookup failed for {first.subject}/{first.obj}: {e}")
            tally["lookup_failed"] += 1
            continue
        finally:
            CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=0), "utf8")
        if not all(cands):
            tally["unresolved"] += 1
            continue
        ends = (cands[0][0], cands[1][0])
        if ends[0].qid == ends[1].qid:
            tally["same_place"] += 1
            continue
        opening_years = sorted({r.year for r in rs if r.year and r.year_is_opening})
        valid_from = f"{opening_years[0]}-01-01" if opening_years else None
        ambiguous = len(cands[0]) > 1 or len(cands[1]) > 1
        fid = "x-" + "-".join(sorted(e.qid for e in ends))
        f = P.route_feature(fid, ends, valid_from)
        f.sources = [{"source_id": r.source_id, "locator": r.locator, "sentence_sha256": r.sentence_sha256, "year": r.year} for r in rs]
        if len(opening_years) > 1:
            f.sources[0]["conflict"] = f"opening years differ: {opening_years}"
        f.alternatives = [
            {"subject": c.qid, "label": c.label, "description": c.description}
            for group in cands for c in group[1:]
        ]
        lengths = [r.stated_length_km for r in rs if r.stated_length_km]
        P.validate_route(f, lengths[0] if lengths else None, snapshots)
        if frozenset(f.places) in curated_ends:
            tally["already_curated"] += 1
            f.status, f.reasons = "duplicate_of_curated", ["this connection is already on the map"]
        else:
            P.route(f, ambiguous, high_impact=False)
        tally[f.status] += 1
        row = P.to_json(f)
        row["names"] = [first.subject, first.obj]
        features.append(row)

    CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=0), "utf8")
    report = evaluate.run_all()
    gate = report["spatial_relation_extraction"]["precision"] >= PUBLISH_MIN_PRECISION

    published = []
    if gate:
        for f in (f for f in features if f["status"] == "validated"):
            published.append(f)

    (OUT / "reconstruction.json").write_text(json.dumps({"failed_sources": failed, "tally": dict(tally), "skipped_non_route": skipped, "features": features}, ensure_ascii=False, indent=1), "utf8")
    (OUT / "published.json").write_text(json.dumps({"gate_passed": gate, "features": published}, ensure_ascii=False, indent=1), "utf8")
    (OUT / "evaluation.json").write_text(json.dumps(report, indent=1), "utf8")

    print(f"\nrelations={len(relations)} route_pairs={len(by_pair)} non_route_skipped={skipped} failed_sources={failed}")
    print("outcomes:", dict(tally))
    print("evaluation:", json.dumps(report))
    print(f"gate={gate} published={len(published)}")
    for f in features:
        print(f"  {f['status']:22} {' - '.join(f['names']):40} {f['valid_from']} {f['reasons'][:2]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
