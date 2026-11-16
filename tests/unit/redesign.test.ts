import { describe, expect, it } from "vitest";
import { CHALLENGES, claim, dailyChallenge, ev, shuffle } from "../../apps/web/src/lib/challenges";
import { dateForm } from "../../apps/web/src/lib/dates";
import { STORIES } from "../../apps/web/src/lib/stories";
import { pickMeanwhile } from "../../apps/web/src/components/Meanwhile";
import { currentSection } from "../../apps/web/src/components/SiteHeader";
import type { IndexEvent } from "../../apps/web/src/lib/world-index";

describe("challenges", () => {
  it("are built only from records in the checked collection", () => {
    for (const c of CHALLENGES) {
      if (c.kind === "order") c.eventIds.forEach((id) => expect(ev(id), `${c.id}: ${id}`).toBeTruthy());
      if (c.kind === "locate" || c.kind === "image") expect(ev(c.eventId)).toBeTruthy();
      if (c.kind === "locate") expect(ev(c.eventId).placeId).toBe(c.options.find((o) => o === ev(c.eventId).placeId));
      if (c.kind === "image") expect(ev(c.eventId).media?.created).toMatch(/^\d{4}/);
      if (c.kind === "match") c.claimIds.forEach((id) => expect(claim(id).evidence.length).toBeGreaterThan(0));
      if (c.kind === "establish") expect(claim(c.claimId)).toBeTruthy();
    }
  });

  it("never start with the answer in order, and shuffle the same way on server and browser", () => {
    const ids = ["a", "b", "c", "d"];
    for (let seed = 1; seed < 50; seed++) expect(shuffle(ids, seed)).not.toEqual(ids);
    expect(shuffle(ids, 7)).toEqual(shuffle(ids, 7));
  });

  it("give everyone the same daily challenge on a given day", () => {
    const a = dailyChallenge(new Date("2026-11-15T08:00:00Z"));
    const b = dailyChallenge(new Date("2026-11-15T22:00:00Z"));
    expect(a.challenge.id).toBe(b.challenge.id);
    expect(a.day).toBe("2026-11-15");
  });
});

describe("stories", () => {
  it("each have a question, a length and chapters", () => {
    for (const s of STORIES) {
      expect(s.question.length).toBeGreaterThan(10);
      expect(s.minutes).toBeGreaterThan(0);
      expect(s.chapters.length).toBeGreaterThan(0);
    }
  });
});

describe("meanwhile, elsewhere", () => {
  const e = (i: string, s: string, ct: string, l = 10, n?: number): IndexEvent => ({ i, t: i, s, p: "year", c: "war", l, k: "x", ct, n });
  const events = [e("near-asia", "1849-01-01", "asia", 50), e("same-europe", "1848-06-01", "europe", 90), e("far-africa", "1870-01-01", "africa", 80), e("asia-2", "1848-01-01", "asia", 40), e("multi", "1848-01-01", "oceania", 99, 20)];
  const picks = pickMeanwhile(events, { id: "x", title: "1848", start: "1848-03-13" }, "europe");
  it("only picks other continents, close in time, one per continent", () => {
    expect(picks.map((p) => p.i)).toEqual(["near-asia"]);
  });
  it("skips events tied to many countries", () => {
    expect(picks.some((p) => p.i === "multi")).toBe(false);
  });
});

describe("dates and navigation", () => {
  it("tells exact, approximate, ranges and processes apart", () => {
    expect(dateForm("1866-07-03", undefined, "day")).toBe("exact");
    expect(dateForm("1854-01-01", undefined, "year")).toBe("approximate");
    expect(dateForm("1848-10-06", "1848-10-31", "day")).toBe("range");
    expect(dateForm("1848-01-01", "1854-12-31", "year")).toBe("process");
  });
  it("keeps old addresses in their new section", () => {
    expect(currentSection("/")).toBe("discover");
    expect(currentSection("/history/europe")).toBe("map");
    expect(currentSection("/explore")).toBe("map");
    expect(currentSection("/journeys/austria-1848-1921")).toBe("stories");
    expect(currentSection("/learn")).toBe("learn");
    expect(currentSection("/challenges/order-rails")).toBe("learn");
    expect(currentSection("/collection")).toBe("collection");
  });
});
