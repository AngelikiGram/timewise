import { beforeEach, describe, expect, it } from "vitest";
import { CHECKED_PATH, checkedLessonSync, ERAS, eraOf, PATHS } from "../../apps/web/src/lib/lessons";
import { recommendedPaths } from "../../apps/web/src/lib/recommend";
import { lessonOrder } from "../../apps/web/src/components/lessons/LessonSide";
import { restoreLinkQuestion } from "../../apps/web/src/components/atlas/ConnectExercise";
import { completeLessonAtlas, readProgress, resetProgress, setInterests } from "../../apps/web/src/lib/progress";

describe("lesson order", () => {
  it("alternates a record with a question about it, and keeps every step", () => {
    const lesson = checkedLessonSync(CHECKED_PATH.lessons[0].id)!;
    const order = lessonOrder(lesson);
    expect(order[0].kind).toBe("intro");
    expect(order[order.length - 1].kind).toBe("summary");
    expect(order.filter((o) => o.kind === "card")).toHaveLength(lesson.cards.length);
    expect(order.filter((o) => o.kind === "act")).toHaveLength(lesson.activities.length);
    // At least one question comes straight after its record, before the next record.
    expect(order.some((o, i) => o.kind === "act" && order[i - 1]?.kind === "card" && order[i + 1]?.kind === "card")).toBe(true);
    // Every activity index appears exactly once.
    expect(new Set(order.flatMap((o) => (o.kind === "act" ? [o.i] : []))).size).toBe(lesson.activities.length);
  });
});

describe("recommendations", () => {
  beforeEach(() => resetProgress());
  it("offer three journeys, starting with the checked one, and follow interests", () => {
    const first = recommendedPaths(readProgress());
    expect(first).toHaveLength(3);
    expect(first[0].path.id).toBe(CHECKED_PATH.id);
    setInterests(["asia"]);
    const asia = recommendedPaths(readProgress());
    expect(asia.some((r) => r.why === "Matches your interests")).toBe(true);
    expect(PATHS.length).toBeGreaterThan(3);
  });
});

describe("eras", () => {
  it("place every year in exactly one era", () => {
    expect(eraOf(1867)!.id).toBe("long-19th");
    expect(eraOf(1914)!.id).toBe("world-wars");
    expect(eraOf(-5000)!.id).toBe(ERAS[0].id);
  });
});

describe("restore a hidden link", () => {
  beforeEach(() => resetProgress());
  it("asks only from stored, sourced links, with the right answer among the options", () => {
    for (const l of CHECKED_PATH.lessons) {
      const lesson = checkedLessonSync(l.id)!;
      // As the player does: records, their places, and the people they name.
      const practised = lesson.cards.flatMap((c) => [c.entity, c.place, ...(c.people ?? []).map((x) => x.entity)]).filter((e): e is NonNullable<typeof e> => !!e);
      completeLessonAtlas(lesson.id, practised, lesson.edges, lesson.extra);
    }
    const { nodes, edges } = readProgress().atlas!;
    const asked = Object.values(edges).map((e) => [e, restoreLinkQuestion(e, nodes, edges)] as const).filter(([, q]) => q);
    expect(asked.length).toBeGreaterThan(0);
    for (const [e, q] of asked) {
      if (q?.kind !== "choice") throw new Error("expected a choice");
      expect(q.options.map((o) => o.id)).toContain(q.answer);
      expect(new Set(q.options.map((o) => o.id)).size).toBe(q.options.length);
      expect(q.explanation).toContain(e.label);
      expect(q.prompt).not.toMatch(/same lesson/);
    }
  });
});
