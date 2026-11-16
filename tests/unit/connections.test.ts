import { describe, expect, it } from "vitest";
import { checkedLinks, contextualLinks } from "../../apps/web/src/lib/connections";
import { formatTime, type RecordData } from "../../apps/web/src/lib/record";
import { currentSection } from "../../apps/web/src/components/SiteHeader";
import type { IndexEvent, RegionRow } from "../../apps/web/src/lib/world-index";

const record = (over: Partial<RecordData> = {}): RecordData => ({
  id: "Q1", label: "Test record", kind: "event", types: [], when: { start: "1848-03-13", precision: 11 }, links: [],
  statements: 0, referenced: 0, missing: [], url: "", ...over,
});
const ev = (i: string, s: string, k: string, l = 10, n = 1): IndexEvent => ({ i, t: `Event ${i}`, s, p: "year", c: "politics", l, k, ct: "europe", n });
const regions: RegionRow[] = [{ id: "austria", label: { en: "Austria" }, continent: "europe" }, { id: "france", label: { en: "France" }, continent: "europe" }];

describe("contextual links", () => {
  const events = [ev("Q1", "1848-03-13", "austria"), ev("Q2", "1849-01-01", "france", 50), ev("Q3", "1900-01-01", "austria"), ev("Q4", "1848-06-01", "france", 99, 12), ev("Q5", "1847-01-01", "austria")];

  it("are never marked documented, and say no relationship is documented", () => {
    const links = contextualLinks(record(), events, regions);
    expect(links.length).toBeGreaterThan(0);
    for (const l of links) expect(l.documented).toBe(false);
    expect(links.find((l) => l.group === "period")?.note).toMatch(/No relationship/);
  });

  it("keep to the period window, skip multi-country events and the record itself", () => {
    const period = contextualLinks(record(), events, regions).filter((l) => l.group === "period").map((l) => l.target);
    expect(period).toContain("Q2");
    expect(period).not.toContain("Q1"); // itself
    expect(period).not.toContain("Q3"); // 52 years later
    expect(period).not.toContain("Q4"); // 12 countries
  });

  it("don't repeat a record already linked by a statement", () => {
    const links = contextualLinks(record({ links: [{ target: "Q2", label: "x", relation: "led to", group: "cause", documented: true }] }), events, regions);
    expect(links.map((l) => l.target)).not.toContain("Q2");
  });

  it("find the same country through the index", () => {
    const country = contextualLinks(record(), events, regions).filter((l) => l.group === "country").map((l) => l.target);
    expect(country).toEqual(["Q3"]); // Q5 is already shown as the same period, so it isn't repeated
  });

  it("add no period links to an undated record", () => {
    expect(contextualLinks(record({ when: {} }), events, regions).filter((l) => l.group === "period")).toEqual([]);
  });
});

describe("checked links", () => {
  it("connect a checked place to its sourced events, and nothing else", () => {
    const graz = checkedLinks("Q13298");
    expect(graz.length).toBeGreaterThan(0);
    for (const l of graz) {
      expect(l.group).toBe("checked");
      expect(l.href).toMatch(/^\/explore\?event=/);
    }
    expect(checkedLinks("Q99999999")).toEqual([]);
  });
});

describe("Wikidata dates", () => {
  it("are shown at their precision", () => {
    expect(formatTime("1848-03-13", 11)).toBe("13 March 1848");
    expect(formatTime("1848-03-00", 10)).toBe("March 1848");
    expect(formatTime("1848-00-00", 9)).toBe("1848");
    expect(formatTime("1840-00-00", 8)).toBe("1840s");
    expect(formatTime("1801-00-00", 7)).toBe("19th century");
    expect(formatTime("-0490-00-00", 9)).toMatch(/490 BC/);
  });
});

describe("navigation", () => {
  it("marks Explore for the explorer", () => {
    expect(currentSection("/connections")).toBe("explore");
  });
});
