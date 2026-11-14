import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Collection, geometryErrors, integrityErrors, Journey, journeyErrors, TemporalGeometry } from "../../packages/historical-schemas/src/index";
import { search } from "../../apps/web/src/lib/search";
import { useAtlas } from "../../apps/web/src/lib/store";

const raw = JSON.parse(readFileSync(new URL("../../data/curated/austria/collection.json", import.meta.url), "utf8"));
const c = Collection.parse(raw);
const sorted = [...c.events].sort((a, b) => a.when.start.localeCompare(b.when.start));

describe("curated collection", () => {
  it("passes referential integrity", () => expect(integrityErrors(c)).toEqual([]));

  it("flags a claim that cites a source that doesn't exist", () => {
    const broken = structuredClone(c);
    broken.claims[0].evidence[0].sourceId = "invented";
    expect(integrityErrors(broken).join()).toContain("unknown source invented");
  });

  it("isn't a single-city dataset", () => {
    expect(new Set(c.events.map((e) => e.placeId)).size).toBeGreaterThanOrEqual(5);
    expect(c.places.some((p) => p.modernCountry !== "AT")).toBe(true);
  });

  it("doesn't claim review that hasn't happened", () => {
    expect(c.claims.every((cl) => cl.review !== "expert_reviewed")).toBe(true);
    expect(c.region.coverage).not.toBe("curated_reviewed");
  });

  it("marks unknown rights as not reproducible", () => {
    for (const s of c.sources.filter((s) => /not yet verified/i.test(s.rights))) expect(s.reproduction).toBe("link_and_paraphrase_only");
  });
});

describe("temporal geometry", () => {
  const features = TemporalGeometry.array().parse(JSON.parse(readFileSync(new URL("../../data/curated/austria/geometries.json", import.meta.url), "utf8")).features);
  const boundariesAt = (date: string) => features.filter((f) => f.layer === "boundaries" && f.derivation !== "modern_reference" && f.validFrom <= date && date <= f.validTo);

  it("links only to real events", () => expect(geometryErrors(features, c)).toEqual([]));

  it("has coordinates in or near central Europe, in lng/lat order", () => {
    const visit = (v: unknown): void => {
      if (typeof (v as number[])[0] === "number") {
        const [lng, lat] = v as number[];
        expect(lng).toBeGreaterThan(5);
        expect(lng).toBeLessThan(35);
        expect(lat).toBeGreaterThan(40);
        expect(lat).toBeLessThan(55);
      } else (v as unknown[]).forEach(visit);
    };
    features.forEach((f) => visit(f.geometry.coordinates));
  });

  it("draws no boundary where the data has none", () => {
    expect(boundariesAt("1850-01-01")).toEqual([]);
    expect(boundariesAt("1870-01-01")).toEqual([]);
    expect(boundariesAt("1919-06-01")).toEqual([]);
    expect(boundariesAt("1914-06-28").map((f) => f.id)).toEqual(["b-ah-1914"]);
  });

  it("never presents a railway line as a surveyed historical route", () => {
    // Today's track (modern_reference) or a straight line (schematic), never a historical survey.
    for (const f of features.filter((f) => f.layer === "routes")) expect(["schematic", "modern_reference"]).toContain(f.derivation);
  });

  it("draws the curated railways along a real track, not a straight line", () => {
    for (const id of ["s-graz", "s-semmering", "s-brenner"]) {
      const f = features.find((g) => g.id === id)!;
      expect(f.derivation).toBe("modern_reference");
      expect(f.license).toContain("OpenStreetMap");
      expect((f.geometry as { coordinates: unknown[] }).coordinates.length).toBeGreaterThan(50);
    }
  });

  it("doesn't show a railway before it opened", () => {
    const brenner = features.find((f) => f.id === "s-brenner")!;
    expect(brenner.validFrom).toBe(c.events.find((e) => e.id === "brenner-1867")!.when.start);
  });
});

describe("journeys", () => {
  const journeys = Journey.array().parse(JSON.parse(readFileSync(new URL("../../data/curated/austria/journeys.json", import.meta.url), "utf8")).journeys);

  it("cites only real claims from each chapter's own events", () => expect(journeyErrors(journeys, c)).toEqual([]));

  it("rejects narrative citing a claim that doesn't exist", () => {
    const broken = structuredClone(journeys);
    broken[0].chapters[0].segments[0].claimIds = ["invented"];
    expect(journeyErrors(broken, c).join()).toContain("unknown claim invented");
  });

  it("rejects narrative citing a claim from another chapter's event", () => {
    const broken = structuredClone(journeys);
    broken[0].chapters[0].segments[0].claimIds = ["c-sop-1"];
    expect(journeyErrors(broken, c).join()).toContain("outside this chapter");
  });

  it("makes no unsupported causal claims in its narrative", () => {
    const text = journeys.flatMap((j) => j.chapters.flatMap((ch) => [ch.summary.en, ...ch.segments.map((s) => s.text.en)])).join(" ");
    expect(text).not.toMatch(/\b(caused|led to|because of|resulted in|as a result|triggered|therefore)\b/i);
  });
});

describe("search", () => {
  it("finds places by historical and local names", () => {
    expect(search(c, "Ödenburg")[0].id).toBe("sopron");
    expect(search(c, "Wien")[0].id).toBe("vienna");
  });
  it("ignores accents", () => expect(search(c, "Koniggratz").map((h) => h.id)).toContain("koniggratz-1866"));
  it("finds events by year", () => expect(search(c, "1867").map((h) => h.id)).toContain("compromise-1867"));
  it("returns nothing rather than a guess", () => expect(search(c, "Byzantine Empire")).toEqual([]));
});

describe("shared state", () => {
  it("keeps date and selection in step", () => {
    const s = useAtlas.getState();
    s.init(sorted, "1844-01-01");
    s.selectEvent("compromise-1867");
    expect(useAtlas.getState().date).toBe("1867-05-29");
    s.scrubTo("1915-01-01");
    expect(useAtlas.getState().selectedId).toBe("sarajevo-1914");
  });
  it("moves the selection off an event hidden by a filter", () => {
    const s = useAtlas.getState();
    s.setThemes([]);
    s.selectEvent("compromise-1867");
    s.setThemes(["railways"]);
    expect(useAtlas.getState().selectedId).toBe("graz-railway-1844");
    s.setThemes([]);
  });
});
