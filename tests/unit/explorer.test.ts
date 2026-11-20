import { describe, expect, it } from "vitest";
import { explorerBadges, explorerXp, level, type Explorer } from "../../apps/web/src/lib/explorer";
import { yearOfIso } from "../../apps/web/src/lib/live";

const empty: Explorer = { lives: {}, things: {}, years: {}, stories: {}, surprises: 0, lookups: 0, wholeLives: [], names: {}, places: {}, why: {}, timeline: { rounds: 0, perfect: 0, streak: 0, best: 0 }, facts: { answered: 0, right: 0 } };

describe("explorer XP and badges", () => {
  it("starts at level 1 with nothing earned", () => {
    expect(level(explorerXp(empty)).n).toBe(1);
    expect(explorerBadges(empty).every((b) => !b.earned && b.have === 0)).toBe(true);
  });
  it("earns badges for what was opened, and levels up", () => {
    const lives = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`Q${i}`, { label: `P${i}`, at: "2026-01-01", born: [100, 1200, 1700, 1850, 1920, 1960][i % 6] }]));
    const e = { ...empty, lives, surprises: 1 };
    const got = explorerBadges(e).filter((b) => b.earned).map((b) => b.id);
    expect(got).toEqual(expect.arrayContaining(["life1", "life10", "eras", "surp1"]));
    expect(level(explorerXp(e)).n).toBeGreaterThan(1);
  });
});

describe("live Wikidata dates", () => {
  it("reads years, BC included", () => {
    expect(yearOfIso("+1756-01-27T00:00:00Z")).toBe(1756);
    expect(yearOfIso("-0490-09-07T00:00:00Z")).toBe(-490);
    expect(yearOfIso(undefined)).toBeNull();
  });
});

import { lifeCards, storyCards } from "../../apps/web/src/lib/memory";

describe("story memory questions", () => {
  const from = { kind: "story" as const, title: "T", href: "/x" };
  it("asks about a story's own records, with the right answer among the options", () => {
    const cards = storyCards([{ id: "Q1", title: "A", year: 1800 }, { id: "Q2", title: "B", year: 1810 }, { id: "Q3", title: "C", year: 1820 }, { id: "Q4", title: "D", year: 1830 }], from);
    expect(cards.length).toBeGreaterThan(1);
    for (const c of cards) { expect(c.options).toContain(c.answer); expect(new Set(c.options).size).toBe(c.options.length); }
  });
  it("asks when a person was born, and how old they were", () => {
    const cards = lifeCards({ id: "Q9", label: "X", born: 1850 }, [{ id: "m", year: 1880, label: "Did something", source: "s" }], { ...from, kind: "life" });
    expect(cards.find((c) => c.id === "born:Q9")?.answer).toBe("1850");
    expect(cards.find((c) => c.id.startsWith("age:"))?.answer).toBe("30");
  });
});
