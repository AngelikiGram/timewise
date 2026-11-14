// One-off import of geometry into data/curated/austria/geometries.raw.json.
// Records where each shape came from; nothing here is drawn by hand.
import { writeFileSync } from "node:fs";

const headers = { "User-Agent": "TimewiseDev/0.1 (historical atlas; geometry import)" };
const BASE = "https://raw.githubusercontent.com/aourednik/historical-basemaps/master/geojson";

// Douglas-Peucker: the source files are far denser than this map's zoom range needs.
function simplify(points, tolerance) {
  if (points.length < 3) return points;
  const [ax, ay] = points[0];
  const [bx, by] = points[points.length - 1];
  let worst = 0, index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i];
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy) || 1e-12;
    const d = Math.abs(dy * px - dx * py + bx * ay - by * ax) / len;
    if (d > worst) { worst = d; index = i; }
  }
  if (worst <= tolerance) return [points[0], points[points.length - 1]];
  return [...simplify(points.slice(0, index + 1), tolerance).slice(0, -1), ...simplify(points.slice(index), tolerance)];
}
const round = (c) => c.map((n) => Math.round(n * 1e4) / 1e4);
// A closed ring has identical endpoints, so simplify it as two open halves.
const ring = (r, t) => {
  const mid = Math.floor(r.length / 2);
  const out = [...simplify(r.slice(0, mid + 1), t).slice(0, -1), ...simplify(r.slice(mid), t)].map(round);
  return out.length >= 4 ? out : null;
};
const simplifyGeom = (g, t) => {
  if (g.type === "Polygon") return { type: "Polygon", coordinates: g.coordinates.map((r) => ring(r, t)).filter(Boolean) };
  if (g.type === "MultiPolygon")
    return { type: "MultiPolygon", coordinates: g.coordinates.map((p) => p.map((r) => ring(r, t)).filter(Boolean)).filter((p) => p.length) };
  return g;
};

const out = { retrievedAt: new Date().toISOString().slice(0, 10), items: {} };

for (const year of [1880, 1900, 1914, 1920, 1930]) {
  const res = await fetch(`${BASE}/world_${year}.geojson`, { headers });
  console.log(`world_${year}: HTTP ${res.status}`);
  if (!res.ok) continue;
  const j = await res.json();
  const hits = j.features.filter((f) => /austria|hungar|habsburg/i.test(`${f.properties.NAME} ${f.properties.SUBJECTO} ${f.properties.PARTOF}`));
  for (const f of hits) {
    const { NAME, SUBJECTO, PARTOF, BORDERPRECISION } = f.properties;
    const geometry = simplifyGeom(f.geometry, 0.01);
    const key = `${year}:${NAME}`;
    out.items[key] = { year, name: NAME, subjecto: SUBJECTO, partof: PARTOF, borderPrecision: BORDERPRECISION, geometry };
    console.log(`  ${key} subj=${SUBJECTO} prec=${BORDERPRECISION} type=${geometry.type} chars=${JSON.stringify(geometry).length}`);
  }
}

const license = await fetch("https://api.github.com/repos/aourednik/historical-basemaps/license", { headers }).then((r) => r.json()).catch(() => null);
console.log("basemaps licence:", license?.license?.spdx_id ?? "unknown");

// Present-day Ringstrasse carriageways, from OpenStreetMap.
const names = "Schottenring|Universitätsring|Burgring|Opernring|Kärntner Ring|Schubertring|Parkring|Stubenring";
const q = `[out:json][timeout:40];way["highway"]["name"~"^(${names})$"](around:2500,48.2083,16.3725);out geom;`;
let ov = null;
for (const host of ["https://overpass.kumi.systems/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://overpass-api.de/api/interpreter"]) {
  try {
    ov = await fetch(host, { method: "POST", headers: { ...headers, "Content-Type": "application/x-www-form-urlencoded" }, body: `data=${encodeURIComponent(q)}`, signal: AbortSignal.timeout(45000) });
    console.log("overpass ring:", host, "HTTP", ov.status);
    if (ov.ok) break;
  } catch (e) {
    console.log("overpass ring:", host, "failed:", e.cause?.code ?? e.message);
    ov = null;
  }
}
if (ov?.ok) {
  const j = await ov.json();
  const seen = new Set();
  const lines = [];
  // Divided carriageways return two ways; one per street name and direction is enough at this zoom.
  for (const w of j.elements.filter((e) => e.tags.highway === "primary" || e.tags.highway === "secondary" || e.tags.highway === "tertiary")) {
    const key = w.id;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(simplify(w.geometry.map((p) => [p.lon, p.lat]), 0.00005).map((c) => c.map((n) => Math.round(n * 1e5) / 1e5)));
  }
  out.items.ring = { name: "Ringstrasse", geometry: { type: "MultiLineString", coordinates: lines } };
  console.log(`  ring ways=${lines.length} streets=${[...new Set(j.elements.map((e) => e.tags.name))].join(", ")}`);
}

// Present-day state boundary of Burgenland.
const nom = await fetch("https://nominatim.openstreetmap.org/search?state=Burgenland&country=Austria&format=json&polygon_geojson=1&limit=1", { headers, signal: AbortSignal.timeout(30000) }).catch((e) => {
  console.log("nominatim failed:", e.cause?.code ?? e.message);
  return null;
});
console.log("nominatim burgenland: HTTP", nom?.status);
if (nom?.ok) {
  const [hit] = await nom.json();
  if (hit) {
    out.items.burgenland = { name: hit.display_name, osmType: hit.osm_type, osmId: hit.osm_id, geometry: simplifyGeom(hit.geojson, 0.003) };
    console.log(`  ${hit.display_name} osm=${hit.osm_type}/${hit.osm_id} ${hit.geojson.type}`);
  }
}

writeFileSync(new URL("../data/curated/austria/geometries.raw.json", import.meta.url), JSON.stringify(out));
console.log("size", JSON.stringify(out).length);
