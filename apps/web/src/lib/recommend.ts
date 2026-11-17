import { CHECKED_PATH, PATHS, PLACE_PATHS, type PathDef } from "./lessons";
import type { Progress } from "./progress";
import { CONTINENT_LABELS } from "./world-index";

export type Recommendation = { path: PathDef; why: string };

/** Whether a journey matches a chosen interest: a theme in its id, its place, or its place's continent. */
export const matchesInterest = (x: PathDef, i: string) =>
  x.id.includes(`-${i}-`) || x.id.endsWith(`-${i}`) || x.id === `place-${i}` || (i in CONTINENT_LABELS && PLACE_PATHS[x.id.replace("place-", "")]?.continent === i);

/**
 * Three journeys to start with, instead of the whole catalogue: one already started, the hand-checked one,
 * and ones that match the reader's interests, in that order. Finished journeys are left out.
 */
export function recommendedPaths(p: Progress, n = 3): Recommendation[] {
  const done = (x: PathDef) => x.lessons.every((l) => p.lessons[l.id]?.finished);
  const out: Recommendation[] = [];
  const add = (x: PathDef | undefined, why: string) => { if (x && !done(x) && !out.some((r) => r.path.id === x.id) && out.length < n) out.push({ path: x, why }); };
  const started = Object.values(p.lessons).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((l) => PATHS.find((x) => x.id === l.pathId));
  add(started[0], "You started this");
  add(CHECKED_PATH, "Checked by hand against its sources");
  const interests = p.interests ?? [];
  for (const i of interests) add(PATHS.find((x) => !done(x) && !out.some((r) => r.path.id === x.id) && matchesInterest(x, i)), "Matches your interests");
  // Without interests, offer different ways in: a question, then a period.
  for (const kind of ["question", "period", "topic"] as const) add(PATHS.find((x) => x.kind === kind && x.review !== "source_checked"), { question: "Starts from a question", period: "Follows one period", topic: "Follows one topic" }[kind]);
  return out;
}
