// One display entry per historical event, without losing the records behind it.
//
// Two kinds of duplicate reach the maps:
// 1. Wikidata twins: two items for the same event (same title, same date, same spot). Wikidata has these.
// 2. A hand-checked TIMEWISE event and its imported Wikidata record, which share no identifier.
//
// Merging keeps one entry on screen and lists every merged record under `also`, with its source, so
// provenance stays visible. Records that merely share a place are NOT merged: they stay separate and are
// offered as a list where they overlap on the map.

export type Mergeable = {
  id: string;
  title: { en?: string; de?: string };
  start: string;
  lng?: number;
  lat?: number;
  links?: number;
  checked?: boolean;
};
export type MergedRef = { id: string; title: string; source: "wikidata" | "checked" };
export type Merged<T> = T & { also?: MergedRef[] };

export const fold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const titleOf = (e: Mergeable) => e.title.en ?? e.title.de ?? "";

export function km(a: Mergeable, b: Mergeable): number {
  if (a.lng === undefined || b.lng === undefined || a.lat === undefined || b.lat === undefined) return Infinity;
  const r = Math.PI / 180;
  const x = (b.lng - a.lng) * r * Math.cos(((a.lat + b.lat) / 2) * r);
  return Math.sqrt(x * x + ((b.lat - a.lat) * r) ** 2) * 6371;
}

// Words that say what kind of event it was, not which one: sharing them isn't evidence of a match.
const GENERIC = new Set([
  "battle", "siege", "treaty", "peace", "war", "wars", "revolution", "uprising", "railway", "railroad", "line", "opening",
  "founding", "foundation", "assassination", "election", "elections", "plebiscite", "referendum", "festival", "program", "programme",
  "compromise", "republic", "state", "first", "second", "third", "great", "the", "of", "in", "at", "and", "from", "southern", "northern",
  "reaches", "opens", "over", "across", "building", "vienna", "austria", "austrian", "empire", "kingdom", "city",
]);
const tokens = (s: string) => new Set(fold(s).split(" ").filter((w) => w.length >= 5 && !GENERIC.has(w)));

/** Same title, same date, and the same spot (or both unlocated). */
export function areTwins(a: Mergeable, b: Mergeable): boolean {
  if (a.checked || b.checked) return false;
  if (a.start !== b.start || fold(titleOf(a)) !== fold(titleOf(b)) || !fold(titleOf(a))) return false;
  const d = km(a, b);
  return d <= 1 || (a.lng === undefined && b.lng === undefined);
}

/** A checked event and an imported record of it: same year, within 30 km, and a distinctive word in common. */
export function isImportOf(checked: Mergeable, imported: Mergeable): boolean {
  if (!checked.checked || imported.checked) return false;
  if (checked.start.slice(0, 4) !== imported.start.slice(0, 4)) return false;
  if (km(checked, imported) > 30) return false;
  const a = tokens(titleOf(checked));
  return [...tokens(titleOf(imported))].some((w) => a.has(w));
}

export function dedupe<T extends Mergeable>(items: T[]): Merged<T>[] {
  const out: Merged<T>[] = [];
  const byKey = new Map<string, Merged<T>[]>();
  const checked = items.filter((i) => i.checked).map((i) => ({ ...i }) as Merged<T>);
  out.push(...checked);
  for (const item of items) {
    if (item.checked) continue;
    const host = checked.find((c) => isImportOf(c, item));
    if (host) {
      (host.also ??= []).push({ id: item.id, title: titleOf(item), source: "wikidata" });
      continue;
    }
    const key = `${item.start}|${fold(titleOf(item))}`;
    const same = byKey.get(key) ?? [];
    const twin = same.find((s) => areTwins(s, item));
    if (twin) {
      // Keep the better-documented record on screen; the other is listed under it.
      if ((item.links ?? 0) > (twin.links ?? 0)) {
        const keep = { ...item, also: [...(twin.also ?? []), { id: twin.id, title: titleOf(twin), source: "wikidata" as const }] } as Merged<T>;
        out[out.indexOf(twin)] = keep;
        same[same.indexOf(twin)] = keep;
      } else (twin.also ??= []).push({ id: item.id, title: titleOf(item), source: "wikidata" });
      continue;
    }
    const entry = { ...item } as Merged<T>;
    out.push(entry);
    same.push(entry);
    byKey.set(key, same);
  }
  return out;
}

/** Records drawn at (nearly) the same point: distinct events that should be offered as a list, not hidden. */
export function stackedWith<T extends Mergeable>(item: T, items: T[], meters = 50): T[] {
  return items.filter((o) => o.id !== item.id && km(item, o) * 1000 <= meters);
}
