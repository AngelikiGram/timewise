import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { areTwins, dedupe, isImportOf, stackedWith } from "../../apps/web/src/lib/dedupe";
import { collection } from "../../apps/web/src/lib/collection";

const austria = JSON.parse(readFileSync("apps/web/public/data/regions/austria.json", "utf-8")).events as { id: string; title: { en?: string }; start: string; lng?: number; lat?: number; links: number }[];
const checked = collection.events.map((e) => {
  const p = collection.places.find((x) => x.id === e.placeId);
  return { id: e.id, title: { en: e.title.en }, start: e.when.start, lng: p?.lng, lat: p?.lat, checked: true };
});

describe("deduplication", () => {
  it("merges Wikidata twins and keeps the merged record as provenance", () => {
    const a = { id: "Q1", title: { en: "Battle of X" }, start: "1200-01-01", lng: 10, lat: 47, links: 3 };
    const b = { id: "Q2", title: { en: "Battle of X" }, start: "1200-01-01", lng: 10.001, lat: 47, links: 9 };
    expect(areTwins(a, b)).toBe(true);
    const out = dedupe([a, b]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("Q2"); // the better-documented one stays on screen
    expect(out[0].also).toEqual([{ id: "Q1", title: "Battle of X", source: "wikidata" }]);
  });

  it("keeps distinct events that only share a place", () => {
    const a = { id: "Q1", title: { en: "Congress of Vienna" }, start: "1814-09-18", lng: 16.37, lat: 48.2, links: 50 };
    const b = { id: "Q2", title: { en: "Vienna Uprising" }, start: "1848-10-06", lng: 16.37, lat: 48.2, links: 20 };
    expect(dedupe([a, b])).toHaveLength(2);
    expect(stackedWith(a, [a, b]).map((x) => x.id)).toEqual(["Q2"]);
  });

  it("finds no duplicates left in the Austria atlas after merging", () => {
    const out = dedupe([...checked, ...austria]);
    const seen = new Map<string, string>();
    for (const e of out) {
      if (e.lng === undefined) continue;
      const key = `${(e.title.en ?? "").toLowerCase()}|${e.start}|${e.lng.toFixed(2)}|${e.lat!.toFixed(2)}`;
      expect(seen.has(key), `${key} appears twice`).toBe(false);
      seen.set(key, e.id);
    }
    expect(out.length).toBeLessThan(checked.length + austria.length);
  });

  it("attaches imported records of checked events to the checked event", () => {
    const out = dedupe([...checked, ...austria]);
    const merged = out.filter((e) => "checked" in e && e.checked && e.also?.length);
    // Print what matched, for review: every pair must be the same event.
    for (const m of merged) for (const a of m.also!) console.log(`checked ${m.title.en} <- ${a.id} ${a.title}`);
    expect(merged.length).toBeGreaterThan(0);
    expect(isImportOf(checked.find((c) => c.id === "graz-railway-1844")!, { id: "Qx", title: { en: "Battle of Graz" }, start: "1844-01-01", lng: 15.4, lat: 47.07 })).toBe(false);
  });
});
