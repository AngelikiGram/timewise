import { describe, expect, it } from "vitest";
import { CHECKED_PATH, checkedLessonSync, pickEvents, PATHS } from "../../apps/web/src/lib/lessons";
import { collection, claimById } from "../../apps/web/src/lib/collection";

describe("the checked path", () => {
  const lessons = CHECKED_PATH.lessons.map((l) => checkedLessonSync(l.id)!);

  it("has a lesson for every chapter, each with records and questions", () => {
    expect(lessons).toHaveLength(collection.investigations[0].chapters.length);
    for (const l of lessons) {
      expect(l.cards.length).toBeGreaterThan(0);
      expect(l.activities.length).toBeGreaterThanOrEqual(3);
      expect(l.review).toBe("source_checked");
    }
  });

  it("only uses curated events and sourced claims", () => {
    const events = new Set(collection.events.map((e) => e.id));
    const claimTexts = new Set(collection.claims.map((c) => c.statement.en));
    for (const l of lessons) {
      for (const c of l.cards) {
        expect(events.has(c.id)).toBe(true);
        for (const cl of c.claims) {
          expect(claimTexts.has(cl.text)).toBe(true);
          expect(cl.sources.length).toBeGreaterThan(0);
        }
      }
    }
    expect(claimById.size).toBeGreaterThan(0);
  });

  it("gives every question an answer among its options, an explanation and a source", () => {
    for (const l of lessons) {
      for (const a of l.activities) {
        expect(a.explanation.length).toBeGreaterThan(10);
        expect(a.sources.length).toBeGreaterThan(0);
        if (a.kind === "choice") expect(a.options.map((o) => o.id)).toContain(a.answer);
        if (a.kind === "order") {
          const starts = a.items.map((i) => collection.events.find((e) => e.id === i.id)!.when.start);
          expect([...starts].sort()).toEqual(starts);
        }
      }
    }
  });

  it("asks no cause-and-consequence question, because the collection records none, and says so", () => {
    for (const l of lessons) {
      expect(l.activities.some((a) => a.skill === "cause")).toBe(false);
      expect(l.gaps.join(" ")).toMatch(/causes and effects/);
    }
  });
});

describe("imported lessons", () => {
  const ev = (id: string, start: string, home: string, links: number, extra: object = {}) => ({
    id, title: { en: `Event ${id}` }, description: `A long enough description of ${id}`, category: "war", start, precision: "year" as const, lng: 1, lat: 1, links, home, url: "", ...extra,
  });
  it("pick four well-documented events of the century, each from a different country", () => {
    const events = [
      ev("Q1", "1810-01-01", "france", 90), ev("Q2", "1820-01-01", "france", 80), ev("Q3", "1830-01-01", "spain", 70),
      ev("Q4", "1840-01-01", "italy", 60), ev("Q5", "1850-01-01", "austria", 50), ev("Q6", "1750-01-01", "poland", 99),
      ev("Q7", "1860-01-01", "germany", 95, { multi: true }), ev("Q8", "1870-01-01", "russia", 94, { precision: "century" }),
    ];
    expect(pickEvents(events, 18).map((e) => e.id)).toEqual(["Q1", "Q3", "Q4", "Q5"]);
  });
  it("are labelled as imported in every region and period path", () => {
    for (const p of PATHS.filter((x) => x.kind !== "question")) expect(p.review).toBe("imported");
  });
});
