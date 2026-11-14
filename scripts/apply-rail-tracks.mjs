// Replaces the straight-line railway sections in geometries.json with today's track from OpenStreetMap,
// fetched by scripts/fetch_rail_tracks.py. build-geometries.mjs calls this too, so a rebuild keeps the tracks.
// The dating source (sourceId, locator) stays: OpenStreetMap supplies the shape, not the opening date.
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const dir = new URL("../data/curated/austria/", import.meta.url);

const NOTES = {
  "s-graz": "The source gives the section's two ends and its opening date. The line runs by way of Bruck an der Mur.",
  "s-semmering": "Shown from 1854, the opening year. The source confirms the year only. The mountain line with its viaducts and tunnels is still the running line today.",
  "s-brenner": "Shown from the 1867 opening. The Brenner Base Tunnel is still being built, so today's track is the 1867 mountain line in most places.",
};

export function applyRailTracks(features) {
  const file = new URL("rail-tracks.json", dir);
  if (!existsSync(file)) return features;
  const { tracks, retrievedAt } = JSON.parse(readFileSync(file, "utf8"));
  return features.map((f) => {
    const t = tracks[f.id];
    if (!t) return f;
    const dating = f.sourceName.split(" (track); ").pop().replace(/ \(dates\)$/, "");
    return {
      ...f,
      sourceName: `OpenStreetMap (track); ${dating} (dates)`,
      sourceUrl: "https://www.openstreetmap.org/copyright",
      license: "Track: ODbL 1.0, © OpenStreetMap contributors. Endpoints: Wikidata (CC0)",
      derivation: "modern_reference",
      accuracy: `Today's running track, about ${t.lengthKm} km, simplified to within about 15 m. Where the line was later realigned, it differs from the line as built.`,
      retrievedAt,
      note: NOTES[f.id] ?? f.note,
      osmId: t.osmWays.map((w) => `way/${w}`).join(","),
      geometry: { type: "LineString", coordinates: t.coordinates },
    };
  });
}

if (import.meta.url === `file:///${process.argv[1].replaceAll("\\", "/")}`) {
  const path = new URL("geometries.json", dir);
  const { features } = JSON.parse(readFileSync(path, "utf8"));
  const next = applyRailTracks(features);
  writeFileSync(path, JSON.stringify({ features: next }, null, 1));
  console.log(next.filter((f) => f.layer === "routes").map((f) => `${f.id}: ${f.derivation}, ${f.geometry.coordinates.length} points`).join("\n"));
}
