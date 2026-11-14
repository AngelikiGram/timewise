// Re-checks every claim's locator phrase against the live source page.
// A miss means the citation can no longer be trusted, so it fails the run.
import { readFileSync } from "node:fs";

const collection = JSON.parse(readFileSync(new URL("../data/curated/austria/collection.json", import.meta.url), "utf8"));
const headers = { "User-Agent": "TimewiseDev/0.1 (citation verification)" };
const clean = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");

const pages = new Map();
for (const s of collection.sources) {
  const res = await fetch(s.url, { headers, signal: AbortSignal.timeout(30000) });
  pages.set(s.id, res.ok ? clean(await res.text()) : null);
  if (!res.ok) console.log(`UNREACHABLE ${s.id} (HTTP ${res.status})`);
}

let failures = 0;
let checked = 0;
for (const claim of collection.claims) {
  for (const ev of claim.evidence) {
    checked++;
    if (!pages.get(ev.sourceId)?.includes(ev.locator)) {
      failures++;
      console.log(`MISSING ${claim.id}: "${ev.locator}" not found in ${ev.sourceId}`);
    }
  }
}
// Schematic routes are drawn from places a source names, so check those names too.
const { features } = JSON.parse(readFileSync(new URL("../data/curated/austria/geometries.json", import.meta.url), "utf8"));
for (const f of features.filter((f) => f.sourceId)) {
  checked++;
  if (!pages.get(f.sourceId)?.includes(f.locator)) {
    failures++;
    console.log(`MISSING ${f.id}: "${f.locator}" not found in ${f.sourceId}`);
  }
}
console.log(`${checked - failures}/${checked} citations found on their source pages`);
process.exit(failures ? 1 : 0);
