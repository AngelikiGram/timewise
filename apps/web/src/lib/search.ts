import type { Collection } from "@timewise/historical-schemas";

export type SearchHit = { kind: "investigation" | "event" | "place" | "theme"; id: string; label: string; detail: string; href: string };

/** Case- and accent-insensitive, so "konigratz" and "wien" both work. */
export const fold = (s: string) =>
  s.toLocaleLowerCase("en").normalize("NFD").replace(/\p{M}/gu, "").replace(/ß/g, "ss");

const STOP = new Set(["the", "a", "an", "of", "in", "and", "did", "how", "what", "why", "when", "was", "were", "to", "der", "die", "das", "von", "change", "between"]);

function score(queryTerms: string[], haystack: string, title: string): number {
  let total = 0;
  for (const term of queryTerms) {
    if (title.startsWith(term)) total += 6;
    else if (title.includes(term)) total += 4;
    else if (haystack.includes(term)) total += 1;
    else if (!/^\d+$/.test(term)) total -= 1;
  }
  return total;
}

export function search(c: Collection, query: string, limit = 7): SearchHit[] {
  const raw = fold(query).trim();
  if (raw.length < 2) return [];
  const terms = raw.split(/[^\p{L}\p{N}]+/u).filter((t) => t.length > 1 && !STOP.has(t));
  if (!terms.length) return [];

  const placeName = new Map(c.places.map((p) => [p.id, p.names.map((n) => n.name).concat(p.label.en).join(" ")]));
  const scored: (SearchHit & { s: number })[] = [];
  const add = (hit: SearchHit, title: string, body: string, bonus = 0) => {
    const s = score(terms, fold(`${title} ${body}`), fold(title));
    if (s > 0) scored.push({ ...hit, s: s + bonus });
  };

  for (const i of c.investigations)
    add({ kind: "investigation", id: i.id, label: i.question.en, detail: "Investigation", href: `/explore?investigation=${i.id}` }, i.question.en, i.intro.en, 1);
  for (const e of c.events)
    add(
      { kind: "event", id: e.id, label: e.title.en, detail: `${e.when.start.slice(0, 4)} · ${c.places.find((p) => p.id === e.placeId)?.label.en ?? "No single location"}`, href: `/explore?event=${e.id}` },
      e.title.en,
      `${e.summary.en} ${e.placeId ? placeName.get(e.placeId) : ""} ${e.people.join(" ")} ${e.when.start.slice(0, 4)}`,
    );
  for (const p of c.places) {
    const first = c.events.filter((e) => e.placeId === p.id).sort((a, b) => a.when.start.localeCompare(b.when.start))[0];
    if (first)
      add({ kind: "place", id: p.id, label: p.label.en, detail: p.names.map((n) => n.name).filter((n) => n !== p.label.en).join(", ") || p.region, href: `/explore?event=${first.id}` }, placeName.get(p.id)!, p.region);
  }
  for (const t of c.themes)
    add({ kind: "theme", id: t.id, label: t.label.en, detail: "Theme", href: `/explore?theme=${t.id}` }, t.label.en, "");

  return scored.sort((a, b) => b.s - a.s).slice(0, limit).map(({ s: _s, ...hit }) => hit);
}
