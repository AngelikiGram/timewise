// Where the reader has been across the four ways in, for this visit: a short trail with a way back, and the
// last thing, year and life seen, so each mode's tab opens where the reader left it.
export type Stop = { href: string; label: string; mode: "thing" | "year" | "life" | "interests" };
const KEY = "tw-trail-v1";

export function readTrail(): Stop[] {
  try { return JSON.parse(sessionStorage.getItem(KEY) ?? "[]") as Stop[]; } catch { return []; }
}

/** Record a stop; returning to the previous stop steps back instead of growing the trail. */
export function visit(stop: Stop): Stop[] {
  let t = readTrail();
  if (t[t.length - 1]?.href === stop.href) t[t.length - 1] = stop;
  else if (t[t.length - 2]?.href === stop.href) t = t.slice(0, -1);
  else t = [...t, stop].slice(-12);
  try { sessionStorage.setItem(KEY, JSON.stringify(t)); } catch { /* private mode: no trail */ }
  return t;
}

/** The last stop of each mode, for tabs that reopen where the reader was. */
export const lastOf = (t: Stop[], mode: Stop["mode"]) => [...t].reverse().find((s) => s.mode === mode);
