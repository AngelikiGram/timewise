import { beforeEach, describe, expect, it } from "vitest";
import { streaks } from "../../apps/web/src/lib/achievements";
import { personId, checkedEventId } from "../../apps/web/src/lib/entities";
import { CHECKED_PATH, checkedLessonSync } from "../../apps/web/src/lib/lessons";
import { completeLessonAtlas, dueReviews, encounterEntities, exploreEntity, logAnswer, readProgress, resetProgress } from "../../apps/web/src/lib/progress";

describe("identities", () => {
  it("link a name only when it was resolved, never by name alone", () => {
    expect(personId("Karl Renner")).toBe("Q11726");
    expect(personId("Franz Ferdinand")).toBeUndefined();
    expect(personId("Theodor von Latour")).toBeUndefined();
    expect(personId("Somebody Else")).toBeUndefined();
  });
  it("give checked events their Wikidata twin where one is known", () => {
    expect(checkedEventId("koniggratz-1866")).toBe("Q154942");
    expect(checkedEventId("graz-railway-1844")).toBe("tw:graz-railway-1844");
  });
});

describe("lesson edges", () => {
  it("each have a precise label and a source, and no edge stands for sharing a lesson", () => {
    for (const l of CHECKED_PATH.lessons.map((x) => checkedLessonSync(x.id)!)) {
      for (const e of l.edges) {
        expect(e.label.length).toBeGreaterThan(3);
        expect(e.source.label.length).toBeGreaterThan(0);
        expect(e.label).not.toMatch(/same lesson/);
      }
    }
  });
  it("leave unresolved people as plain names", () => {
    const end = checkedLessonSync("austria-end")!;
    const ff = end.cards.flatMap((c) => c.people ?? []).find((x) => x.name === "Franz Ferdinand");
    expect(ff).toBeDefined();
    expect(ff!.entity).toBeUndefined();
  });
});

describe("the personal atlas", () => {
  beforeEach(() => resetProgress());

  it("keeps encountered, explored and practised apart", () => {
    const e = { id: "Q1", label: "An event", type: "event" as const };
    encounterEntities("l1", [e]);
    let n = readProgress().atlas!.nodes.Q1;
    expect(n.encountered).toBeDefined();
    expect(n.explored).toBeUndefined();
    expect(n.practised).toBeUndefined();
    exploreEntity(e);
    n = readProgress().atlas!.nodes.Q1;
    expect(n.explored).toBeDefined();
    expect(n.practised).toBeUndefined();
  });

  it("extends one node when an entity returns in another lesson, and reports the link", () => {
    const renner = { id: "Q11726", label: "Karl Renner", type: "person" as const };
    const a = completeLessonAtlas("lesson-a", [renner], []);
    expect(a.newByType.person).toBe(1);
    const b = completeLessonAtlas("lesson-b", [renner], []);
    expect(b.newByType.person).toBeUndefined();
    expect(b.earlier.map((x) => x.id)).toEqual(["Q11726"]);
    const nodes = readProgress().atlas!.nodes;
    expect(Object.keys(nodes)).toEqual(["Q11726"]);
    expect(nodes.Q11726.lessons).toEqual(["lesson-a", "lesson-b"]);
  });

  it("stores an edge once, with its source, however often it is learned", () => {
    const edge = { from: "Q1", to: "Q2", label: "took place in", source: { label: "src", url: "https://example.org" } };
    expect(completeLessonAtlas("x", [], [edge]).newEdges).toBe(1);
    expect(completeLessonAtlas("y", [], [edge]).newEdges).toBe(0);
    const stored = Object.values(readProgress().atlas!.edges);
    expect(stored).toHaveLength(1);
    expect(stored[0].lessons).toEqual(["x", "y"]);
  });
});

describe("review", () => {
  beforeEach(() => resetProgress());
  it("spaces a question out after a right answer, and brings a wrong one back now", () => {
    const q = { prompt: "Q?", correct: "A", activity: { kind: "choice" } };
    logAnswer("l", "chronology", false, q);
    expect(dueReviews(readProgress())).toHaveLength(1);
    logAnswer("l", "chronology", true, q, true);
    expect(dueReviews(readProgress())).toHaveLength(0);
    expect(readProgress().mistakes).toHaveLength(1);
    expect(readProgress().reviewLog).toEqual({ ok: 1, total: 1 });
  });
});

describe("streaks", () => {
  it("count consecutive days, keep the best, and don't end before today's lesson", () => {
    const today = new Date("2026-11-17T10:00:00");
    expect(streaks(["2026-11-15", "2026-11-16"], today)).toEqual({ current: 2, best: 2 });
    expect(streaks(["2026-11-10", "2026-11-11", "2026-11-12", "2026-11-17"], today)).toEqual({ current: 1, best: 3 });
    expect(streaks([], today)).toEqual({ current: 0, best: 0 });
  });
});
