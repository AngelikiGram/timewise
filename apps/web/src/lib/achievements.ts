// Streaks, daily goals and badges, computed from the reader's own saved progress. Nothing here is
// punitive: a missed day ends a streak but takes nothing away, and the best streak is always kept.
import type { Progress } from "./progress";

const DAY = 86400000;
export const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Consecutive days with learning, ending today or yesterday (so it isn't "lost" before today's lesson). */
export function streaks(days: string[], today = new Date()): { current: number; best: number } {
  const set = new Set(days);
  let current = 0;
  let d = new Date(today);
  if (!set.has(isoDay(d))) d = new Date(d.getTime() - DAY);
  while (set.has(isoDay(d))) { current++; d = new Date(d.getTime() - DAY); }
  const sorted = [...set].sort();
  let best = 0, run = 0, prev: number | null = null;
  for (const day of sorted) {
    const t = Date.parse(`${day}T12:00:00`);
    run = prev !== null && Math.round((t - prev) / DAY) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = t;
  }
  return { current, best: Math.max(best, current) };
}

export function lessonsOn(p: Progress, day = isoDay(new Date())): number {
  return p.results.filter((r) => r.id.startsWith("lesson:") && isoDay(new Date(r.at)) === day).length;
}

export function accuracy(p: Progress): { ok: number; total: number } {
  return { ok: p.skills.filter((s) => s.ok).length, total: p.skills.length };
}

export type Badge = { id: string; label: string; help: string; earned: boolean };
/** Badges for things actually done, each with what earns it. */
export function badges(p: Progress, pathsDone: number): Badge[] {
  const lessons = Object.values(p.lessons).filter((l) => l.finished).length;
  const { best } = streaks(p.days);
  const correct = p.skills.filter((s) => s.ok).length;
  const places = new Set(Object.values(p.lessons).filter((l) => l.finished && l.pathId.startsWith("place-")).map((l) => l.pathId)).size;
  const reviewed = p.skills.length >= 1 && p.mistakes.length === 0 && p.skills.some((s) => !s.ok);
  return [
    { id: "first", label: "First lesson", help: "Finish a lesson.", earned: lessons >= 1 },
    { id: "five", label: "Five lessons", help: "Finish five lessons.", earned: lessons >= 5 },
    { id: "path", label: "Path complete", help: "Finish every lesson of a path.", earned: pathsDone >= 1 },
    { id: "streak3", label: "Three days", help: "Learn on three days in a row.", earned: best >= 3 },
    { id: "streak7", label: "A week", help: "Learn on seven days in a row.", earned: best >= 7 },
    { id: "places", label: "Traveller", help: "Finish lessons in three countries' paths.", earned: places >= 3 },
    { id: "sharp", label: "Twenty right", help: "Answer twenty questions correctly.", earned: correct >= 20 },
    { id: "review", label: "Clean slate", help: "Clear every question waiting for review.", earned: reviewed },
  ];
}
