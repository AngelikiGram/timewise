// Prints the data-quality figures reported in DEVELOPMENT_STATUS.md.
import { readFileSync } from "node:fs";

const load = (name) => JSON.parse(readFileSync(new URL(`../data/curated/austria/${name}`, import.meta.url), "utf8"));
const c = load("collection.json");
const { features } = load("geometries.json");
const pct = (n, d) => `${n}/${d} (${Math.round((n / d) * 100)}%)`;
const count = (items, key) => Object.entries(items.reduce((acc, i) => ({ ...acc, [key(i)]: (acc[key(i)] ?? 0) + 1 }), {})).map(([k, v]) => `${k}: ${v}`).join(", ");

const providers = new Set(c.sources.map((s) => s.provider.replace(/ \(.*\)$/, "")));
const events = c.events;
const years = events.map((e) => e.when.start.slice(0, 4)).sort();
const withClaimEvidence = events.filter((e) => c.claims.some((cl) => cl.eventId === e.id && cl.evidence.length));
const withShape = events.filter((e) => features.some((f) => f.eventIds.includes(e.id)));
const located = events.filter((e) => e.placeId);
const multiPublisher = events.filter((e) => {
  const ids = c.claims.filter((cl) => cl.eventId === e.id).flatMap((cl) => cl.evidence.map((ev) => ev.sourceId));
  return new Set(ids.map((id) => c.sources.find((s) => s.id === id).provider.replace(/ \(.*\)$/, ""))).size > 1;
});

console.log(`Records: ${events.length} (${count(events, (e) => e.kind ?? "event")})`);
console.log(`Claims: ${c.claims.length} | Places: ${c.places.length} | Geometries: ${features.length} (${count(features, (f) => f.derivation)})`);
console.log(`Source pages: ${c.sources.length} | Independent publishers: ${providers.size} (${[...providers].join(", ")})`);
console.log(`Source types: ${count(c.sources, (s) => s.recordType)}`);
console.log(`Temporal coverage: ${years[0]} to ${years[years.length - 1]}`);
console.log(`Countries: ${count(c.places, (p) => p.modernCountry)}`);
console.log(`Themes: ${count(events, (e) => e.themes[0])}`);
console.log(`With a usable location: ${pct(located.length, events.length)}`);
console.log(`With a line or area shape: ${pct(withShape.length, events.length)}`);
console.log(`With a paraphrased, located passage: ${pct(withClaimEvidence.length, events.length)}`);
console.log(`With verbatim original passage stored: ${pct(0, events.length)}`);
console.log(`With more than one publisher: ${pct(multiPublisher.length, events.length)}`);
console.log(`With media: ${pct(events.filter((e) => e.media).length, events.length)}`);
console.log(`Claims reviewed by a historian: ${pct(c.claims.filter((cl) => cl.review === "expert_reviewed").length, c.claims.length)}`);
