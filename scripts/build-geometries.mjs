// Builds data/curated/austria/geometries.json from geometries.raw.json plus live lookups.
// Every feature records provenance. Schematic routes are straight lines between
// looked-up endpoints and are classed as such, so they can't pass as surveyed routes.
import { readFileSync, writeFileSync } from "node:fs";
import { applyRailTracks } from "./apply-rail-tracks.mjs";

const headers = { "User-Agent": "TimewiseDev/0.1 (historical atlas; geometry import)" };
const dir = new URL("../data/curated/austria/", import.meta.url);
const raw = JSON.parse(readFileSync(new URL("geometries.raw.json", dir), "utf8"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const retrieved = raw.retrievedAt;

async function qidCoords(search, expect) {
  let s;
  for (let attempt = 0; attempt < 5 && !s?.search; attempt++) {
    await sleep(2500 * (attempt + 1));
    s = await (await fetch(`https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=en&limit=5&search=${encodeURIComponent(search)}`, { headers })).json();
    if (!s.search) console.log(`  Wikidata retry for ${search}: ${s.error?.code ?? "no results field"}`);
  }
  const hit = s.search?.find((h) => expect.test(h.description ?? ""));
  if (!hit) throw new Error(`no Wikidata match for ${search}`);
  const e = await (await fetch(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims&ids=${hit.id}`, { headers })).json();
  const c = e.entities[hit.id].claims.P625[0].mainsnak.datavalue.value;
  console.log(`${search}: ${hit.id} (${hit.description}) ${c.latitude.toFixed(4)},${c.longitude.toFixed(4)}`);
  return { qid: hit.id, coord: [Math.round(c.longitude * 1e4) / 1e4, Math.round(c.latitude * 1e4) / 1e4] };
}

const gloggnitz = await qidCoords("Gloggnitz", /Austria/);
const murz = await qidCoords("Mürzzuschlag", /Austria|Styria/);
const graz = await qidCoords("Graz", /Austria|Styria/);
const innsbruck = await qidCoords("Innsbruck", /Austria|Tyrol/);
const bolzano = await qidCoords("Bolzano", /Italy|South Tyrol/);

const streets = ["Schottenring", "Universitätsring", "Burgring", "Opernring", "Kärntner Ring", "Schubertring", "Parkring", "Stubenring"];
const lines = [];
for (const street of streets) {
  await sleep(1200);
  const r = await fetch(`https://nominatim.openstreetmap.org/search?street=${encodeURIComponent(street)}&city=Wien&country=Austria&format=json&polygon_geojson=1&limit=40&dedupe=0`, { headers });
  const hits = r.ok ? await r.json() : [];
  // Each street is split into many short ways, so take all of them, not just the first.
  let segments = 0;
  let rejected = 0;
  // The name search also matches same-named streets elsewhere in Vienna, so keep only those around the old city.
  const nearCentre = (line) => line.every(([lng, lat]) => Math.abs(lng - 16.3695) < 0.02 && Math.abs(lat - 48.2085) < 0.014);
  const keep = (line) => { if (nearCentre(line)) { lines.push(line); segments++; } else rejected++; };
  for (const g of hits.map((h) => h.geojson)) {
    if (g?.type === "LineString") keep(g.coordinates);
    if (g?.type === "MultiLineString") g.coordinates.forEach(keep);
  }
  console.log(`${street}: ${r.status} ${segments} segments, ${rejected} rejected as elsewhere`);
}
if (lines.length < streets.length) console.log("WARNING: incomplete Ringstrasse", lines.length);
const round5 = (l) => l.map((c) => c.map((n) => Math.round(n * 1e5) / 1e5));

const basemaps = {
  sourceName: "historical-basemaps (A. Ourednik)",
  sourceUrl: "https://github.com/aourednik/historical-basemaps",
  crs: "EPSG:4326",
  license: "GPL-3.0",
  derivation: "community_digitized",
  accuracy: "Coarse, country-scale outline, further simplified for this map. Not suitable for reading exact border lines.",
  review: "unreviewed",
  retrievedAt: retrieved,
};
const osm = {
  sourceName: "OpenStreetMap, via Nominatim",
  sourceUrl: "https://www.openstreetmap.org/copyright",
  crs: "EPSG:4326",
  license: "ODbL 1.0",
  derivation: "modern_reference",
  review: "unreviewed",
  retrievedAt: retrieved,
};
const schematic = {
  crs: "EPSG:4326",
  license: "Endpoints: Wikidata (CC0)",
  derivation: "schematic",
  accuracy: "A straight line between the two endpoints. It doesn't follow the actual track.",
  review: "unreviewed",
  retrievedAt: retrieved,
};

const boundary = (key, id, name, validFrom, validTo, note, eventIds = []) => ({
  id, name, layer: "boundaries", ...basemaps, validFrom, validTo, snapshotYear: raw.items[key].year, note, eventIds, geometry: raw.items[key].geometry,
});

const same1920and1930 = JSON.stringify(raw.items["1920:Austria"].geometry) === JSON.stringify(raw.items["1930:Austria"].geometry);
console.log("1920 Austria identical to 1930 Austria:", same1920and1930);

const features = [
  boundary("1880:Austria Hungary", "b-ah-1880", "Austria-Hungary (1880 snapshot)", "1880-01-01", "1899-12-31", "A single dated snapshot, kept on screen until the next one. The dataset has nothing for 1867–1879."),
  boundary("1900:Austria Hungary", "b-ah-1900", "Austria-Hungary (1900 snapshot)", "1900-01-01", "1913-12-31", "A single dated snapshot, kept on screen until the next one."),
  boundary("1914:Austro-Hungarian Empire", "b-ah-1914", "Austria-Hungary (1914 snapshot)", "1914-01-01", "1918-11-12", "A snapshot from 1914, shown until the republic's proclamation. Wartime changes aren't represented.", ["sarajevo-1914"]),
  boundary(
    "1920:Austria",
    "b-at-1920",
    "Republic of Austria (1920 snapshot)",
    "1920-01-01",
    "1924-12-31",
    same1920and1930
      ? "The dataset's 1920 and 1930 outlines are identical, so this shape can't show the Burgenland transfer of 1921."
      : "A single dated snapshot.",
    ["saint-germain-1919"],
  ),
  {
    id: "m-burgenland", name: "Burgenland (present-day boundary)", layer: "boundaries", ...osm,
    accuracy: "Present-day state boundary, not the territory as transferred in 1921.",
    validFrom: "1921-01-01", validTo: "1924-12-31",
    note: "Shown for orientation only. Villages were still being exchanged up to 1923, so the boundary of the time differed.",
    osmId: `${raw.items.burgenland.osmType}/${raw.items.burgenland.osmId}`,
    eventIds: ["sopron-1921", "burgenland-adjustments"],
    geometry: raw.items.burgenland.geometry,
  },
  {
    id: "m-ringstrasse", name: "Ringstrasse (present-day streets)", layer: "urban", ...osm,
    accuracy: "Present-day street centrelines, street level. The 19th-century layout isn't captured.",
    validFrom: "1865-05-01", validTo: "1924-12-31",
    note: "Shown from the 1865 opening, using today's streets. It isn't a survey of the 1865 road. The walls themselves aren't in the dataset yet.",
    eventIds: ["ring-decree-1857", "ring-opening-1865"],
    geometry: { type: "MultiLineString", coordinates: lines.map(round5) },
  },
  {
    id: "s-graz", name: "Mürzzuschlag – Graz", layer: "routes", ...schematic, sourceName: "Wikipedia (de): Österreichische Südbahn", sourceId: "dewp-suedbahn", locator: "Mürzzuschlag und Graz",
    validFrom: "1844-10-24", validTo: "1924-12-31", note: "The source gives the section's two ends and its opening date.", eventIds: ["graz-railway-1844"],
    geometry: { type: "LineString", coordinates: [murz.coord, graz.coord] }, endpoints: [murz.qid, graz.qid],
  },
  {
    id: "s-semmering", name: "Gloggnitz – Mürzzuschlag (Semmering)", layer: "routes", ...schematic, sourceName: "Wikipedia (de): Semmeringbahn", sourceId: "dewp-semmering", locator: "Gloggnitz",
    validFrom: "1854-01-01", validTo: "1924-12-31", note: "Shown from 1854, the opening year. The source confirms the year only. The real line curves heavily; this straight line doesn't.", eventIds: ["semmering-1854", "semmering-construction"],
    geometry: { type: "LineString", coordinates: [gloggnitz.coord, murz.coord] }, endpoints: [gloggnitz.qid, murz.qid],
  },
  {
    id: "s-brenner", name: "Innsbruck – Bolzano (Brenner)", layer: "routes", ...schematic, sourceName: "Wikipedia: Brenner Railway", sourceId: "wp-brenner", locator: "Innsbruck",
    validFrom: "1867-08-24", validTo: "1924-12-31", note: "A schematic link across the pass, between the two named cities.", eventIds: ["brenner-1867"],
    geometry: { type: "LineString", coordinates: [innsbruck.coord, bolzano.coord] }, endpoints: [innsbruck.qid, bolzano.qid],
  },
];

writeFileSync(new URL("geometries.json", dir), JSON.stringify({ features: applyRailTracks(features) }, null, 1));
console.log(`${features.length} features, ${JSON.stringify(features).length} chars`);
