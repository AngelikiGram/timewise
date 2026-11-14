"""Fetches today's track for the curated railway sections from OpenStreetMap.

    .venv/Scripts/python scripts/fetch_rail_tracks.py

The curated routes were straight lines between two endpoints ("schematic"). This downloads the
running-line rail ways (no sidings or yards) in a corridor around each section from the Overpass
API, and takes the shortest connected path between the rail points nearest the two endpoints.

The result is today's track, not a survey of the line as built. For these three sections the
present main line still follows the 19th-century route in most places: neither the Semmering
nor the Brenner base tunnel is open, and lines under construction aren't tagged railway=rail.
Output: data/curated/austria/rail-tracks.json, which scripts/build-geometries.mjs reads.
OpenStreetMap data is ODbL 1.0, © OpenStreetMap contributors.
"""
from __future__ import annotations

import heapq
import json
import math
import time
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

from shapely.geometry import LineString

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data/curated/austria/rail-tracks.json"
OVERPASS = "https://overpass-api.de/api/interpreter"
HEADERS = {"User-Agent": "TimewiseDev/0.1 (historical atlas; rail geometry import)"}

geometries = json.loads((ROOT / "data/curated/austria/geometries.json").read_text("utf8"))["features"]
# Section id -> how far to widen the endpoints' box, in degrees: enough for the line's detours.
SECTIONS = {"s-graz": 0.3, "s-semmering": 0.12, "s-brenner": 0.4}


def endpoints(feature_id: str) -> list[tuple[float, float]]:
    f = next(f for f in geometries if f["id"] == feature_id)
    coords = f.get("schematicEndpoints") or f["geometry"]["coordinates"]
    return [tuple(coords[0]), tuple(coords[-1])]


def overpass(bbox: tuple[float, float, float, float]) -> dict:
    s, w, n, e = bbox
    query = f'[out:json][timeout:180];way["railway"="rail"][!"service"]({s},{w},{n},{e});out body;>;out skel qt;'
    for attempt in range(4):
        try:
            req = urllib.request.Request(OVERPASS, data=urllib.parse.urlencode({"data": query}).encode(), headers=HEADERS)
            with urllib.request.urlopen(req, timeout=240) as r:
                return json.load(r)
        except Exception as e:  # Overpass is busy at times; back off and retry.
            print(f"  Overpass attempt {attempt + 1} failed: {e}")
            time.sleep(20 * (attempt + 1))
    raise SystemExit("Overpass unavailable")


def metres(a: tuple[float, float], b: tuple[float, float]) -> float:
    x = math.radians(b[0] - a[0]) * math.cos(math.radians((a[1] + b[1]) / 2))
    y = math.radians(b[1] - a[1])
    return 6371000 * math.hypot(x, y)


def track(feature_id: str, pad: float) -> dict:
    (a, b) = endpoints(feature_id)
    bbox = (min(a[1], b[1]) - pad, min(a[0], b[0]) - pad, max(a[1], b[1]) + pad, max(a[0], b[0]) + pad)
    data = overpass(bbox)
    nodes = {el["id"]: (el["lon"], el["lat"]) for el in data["elements"] if el["type"] == "node"}
    ways = [el for el in data["elements"] if el["type"] == "way"]
    graph: dict[int, list[tuple[int, float, int]]] = {}
    for w in ways:
        for u, v in zip(w["nodes"], w["nodes"][1:]):
            if u in nodes and v in nodes:
                d = metres(nodes[u], nodes[v])
                graph.setdefault(u, []).append((v, d, w["id"]))
                graph.setdefault(v, []).append((u, d, w["id"]))
    # Snap both ends onto the largest connected network, not an isolated piece of track.
    seen: set[int] = set()
    network: set[int] = set()
    for root in graph:
        if root in seen:
            continue
        part, stack = {root}, [root]
        while stack:
            for v, _, _ in graph[stack.pop()]:
                if v not in part:
                    part.add(v)
                    stack.append(v)
        seen |= part
        if len(part) > len(network):
            network = part
    start = min(network, key=lambda n: metres(nodes[n], a))
    goal = min(network, key=lambda n: metres(nodes[n], b))
    dist, prev = {start: 0.0}, {}
    queue = [(0.0, start)]
    while queue:
        d, u = heapq.heappop(queue)
        if u == goal:
            break
        if d > dist[u]:
            continue
        for v, w, way in graph[u]:
            if d + w < dist.get(v, math.inf):
                dist[v], prev[v] = d + w, (u, way)
                heapq.heappush(queue, (d + w, v))
    if goal not in dist:
        raise SystemExit(f"{feature_id}: no connected track between the endpoints")
    path, used, n = [goal], set(), goal
    while n != start:
        n, way = prev[n]
        path.append(n)
        used.add(way)
    path.reverse()
    line = LineString([nodes[n] for n in path]).simplify(0.00015)
    coords = [[round(x, 5), round(y, 5)] for x, y in line.coords]
    gaps = (metres(nodes[start], a), metres(nodes[goal], b))
    print(f"{feature_id}: {len(ways)} ways in corridor, path {dist[goal] / 1000:.1f} km over {len(used)} ways, "
          f"{len(coords)} points; straight line {metres(a, b) / 1000:.1f} km; ends {gaps[0]:.0f} m and {gaps[1]:.0f} m from the endpoints")
    return {"coordinates": coords, "lengthKm": round(dist[goal] / 1000, 1), "osmWays": sorted(used), "schematicEndpoints": [list(a), list(b)]}


def main() -> None:
    out = {"retrievedAt": date.today().isoformat(), "source": "OpenStreetMap via Overpass API", "license": "ODbL 1.0", "tracks": {}}
    for i, (feature_id, pad) in enumerate(SECTIONS.items()):
        if i:
            time.sleep(10)  # Overpass asks for a pause between heavy queries.
        out["tracks"][feature_id] = track(feature_id, pad)
    OUT.write_text(json.dumps(out, indent=1), "utf8")
    print(f"wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
