import { describe, expect, it } from "vitest";
import { aliveIn, PEOPLE, PERSON_LINKS, peopleOf, suggestFor, TOPICS, topicsOf, WORKS, worksOf } from "../../apps/web/src/lib/explore";

describe("the explore collection", () => {
  it("has a source for every fact it shows", () => {
    for (const p of PEOPLE) {
      expect(p.id).toMatch(/^Q\d+$/);
      expect(p.born?.source).toMatch(/^https:\/\/www\.wikidata\.org\/wiki\/Q\d+#P569$/);
      for (const x of [...(p.occupations ?? []), ...(p.movements ?? []), ...(p.memberOf ?? [])]) expect(x.source).toContain(p.id);
      if (p.image) expect(p.image.license).toBeTruthy();
    }
    for (const w of WORKS) for (const x of w.people) expect(x.source).toMatch(/#P(84|170|800)$/);
    for (const l of PERSON_LINKS) expect(l.source).toMatch(/^https:\/\/www\.wikidata\.org\/wiki\/Q\d+#P\d+$/);
    for (const t of TOPICS) for (const i of t.items) expect(i.source).toMatch(/#P\d+$/);
  });

  it("found the right people", () => {
    const id = (n: string) => PEOPLE.find((p) => p.label === n)?.id;
    expect(id("Sigmund Freud")).toBe("Q9215");
    expect(id("Gustav Klimt")).toBe("Q34661");
  });

  it("never dates a building before its style existed", () => {
    const t = TOPICS.find((x) => x.kind === "style")! as (typeof TOPICS)[number] & { styleStart?: number };
    if (t.styleStart != null) expect(Math.min(...t.items.map((i) => i.year))).toBeGreaterThanOrEqual(t.styleStart);
  });

  it("connects the modes: a life leads to things, a thing to lives, a year to both", () => {
    const wagner = PEOPLE.find((p) => p.label === "Otto Wagner")!;
    expect(worksOf(wagner.id).length).toBeGreaterThan(3);
    const style = topicsOf(wagner.id);
    expect(style.length).toBeGreaterThan(0);
    expect(peopleOf(style[0]).some((p) => p.id === wagner.id)).toBe(true);
    expect(aliveIn(1900).some((a) => a.person.id === wagner.id && a.age === 1900 - wagner.born!.year!)).toBe(true);
  });

  it("suggests journeys across the modes from interests", () => {
    const s = suggestFor([`topic:${TOPICS[0].id}`]);
    expect(new Set(s.map((x) => x.mode))).toEqual(new Set(["thing", "life", "year"]));
    expect(suggestFor([])).toEqual([]);
  });
});
