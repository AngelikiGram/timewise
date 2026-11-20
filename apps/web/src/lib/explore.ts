// The small connected collection behind the four ways in: follow a thing, explore a year, follow a life,
// follow your interests. Built from Wikidata by scripts/explore_collection.py; every fact carries the URL
// of the statement it came from.
import data from "@data/generated/explore.json";

export type Credit = { url: string; page?: string; artist?: string; license?: string };
export type Sourced = { id: string; label: string; source: string };
export type LifeEvent = { year: number | null; date: string; place: string | null; placeId: string | null; point: [number, number] | null; source: string };
export type Person = {
  id: string; label: string; description?: string | null; evidence: string;
  born?: LifeEvent; died?: LifeEvent; image?: Credit;
  occupations?: Sourced[]; movements?: Sourced[]; memberOf?: Sourced[]; fields?: Sourced[];
};
export type Work = { id: string; label: string; year: number | null; point: [number, number] | null; place: string | null; links: number; people: { id: string; role: string; source: string }[]; image?: Credit };
export type TopicItem = { id: string; label: string; year: number; point: [number, number] | null; place: string | null; country?: string | null; source: string; people?: string[] };
export type Topic = { id: string; qid: string; label: string; description?: string | null; kind: "style" | "class" | "field"; evidence: string; items: TopicItem[]; yearSource: string; /** Looked up live: the rest still loading, or cut short because Wikidata took too long. */ partial?: "loading" | "cut" };
export type PersonLink = { from: string; to: string; label: string; source: string };

const D = data as unknown as { built: string; people: Person[]; links: PersonLink[]; works: Work[]; topics: Topic[] };
export const PEOPLE = D.people;
export const WORKS = D.works;
export const TOPICS = D.topics;
export const PERSON_LINKS = D.links;
export const BUILT = D.built;

export const personById = (id: string) => PEOPLE.find((p) => p.id === id);
export const topicById = (id: string) => TOPICS.find((t) => t.id === id);
export const worksOf = (id: string) => WORKS.filter((w) => w.people.some((x) => x.id === id)).sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999));
export const linksOf = (id: string) => PERSON_LINKS.filter((l) => l.from === id || l.to === id);
export const wd = (qid: string) => `https://www.wikidata.org/wiki/${qid}`;

/** What a topic counts, said plainly. */
export const TOPIC_NOUN: Record<Topic["kind"], [string, string]> = { style: ["building", "buildings"], class: ["place", "places"], field: ["person", "people"] };
/** What a topic item's year means. */
export const TOPIC_YEAR: Record<Topic["kind"], string> = { style: "built or begun", class: "founded", field: "born" };

/** The people of the collection alive in a year, with their age that year. */
export function aliveIn(year: number) {
  return PEOPLE.flatMap((p) => {
    const b = p.born?.year, d = p.died?.year;
    if (b == null || b > year || (d != null && d < year)) return [];
    return [{ person: p, age: year - b }];
  });
}

/** Topics a person belongs to: their works are among its items, they are one of its items, or one names them. */
export function topicsOf(id: string) {
  const mine = new Set(worksOf(id).map((w) => w.id));
  return TOPICS.filter((t) => t.items.some((i) => i.id === id || mine.has(i.id) || i.people?.includes(id)));
}

/** People of the collection a topic touches, by the same rule. */
export function peopleOf(t: Topic) {
  return PEOPLE.filter((p) => topicsOf(p.id).some((x) => x.id === t.id));
}

/** Co-workers: named together on one work, each by their own statement. */
export function sharedWorks(id: string) {
  const out: { person: Person; work: Work }[] = [];
  for (const w of worksOf(id)) for (const x of w.people) if (x.id !== id) { const p = personById(x.id); if (p && !out.some((o) => o.person.id === p.id)) out.push({ person: p, work: w }); }
  return out;
}

/** Counts per decade, for a small histogram. */
export function decades(years: number[]) {
  const m = new Map<number, number>();
  for (const y of years) { const d = Math.floor(y / 10) * 10; m.set(d, (m.get(d) ?? 0) + 1); }
  return [...m.entries()].sort((a, b) => a[0] - b[0]);
}

/** Interest ids for the modes, kept with the reader's other interests. */
export const interestOf = { topic: (id: string) => `topic:${id}`, person: (id: string) => `person:${id}`, year: (y: number) => `year:${y}` };

/** Journeys across the modes that follow from the reader's interests: a thing, a life, a year. */
export function suggestFor(interests: string[], names: Record<string, string> = {}) {
  const out: { href: string; mode: "thing" | "life" | "year"; title: string; why: string }[] = [];
  const add = (x: (typeof out)[number]) => { if (!out.some((o) => o.href === x.href)) out.push(x); };
  for (const i of interests) {
    const [kind, id] = i.split(":");
    if (kind === "topic") {
      const t = topicById(id);
      // Looked up live: no prebuilt links to follow, but it can be opened again.
      if (!t) { if (/^Q\d+$/.test(id)) add({ href: `/explore/thing?q=${id}`, mode: "thing", title: `Follow ${names[i] ?? id}`, why: "You saved this" }); continue; }
      add({ href: `/explore/thing?id=${t.id}`, mode: "thing", title: `Follow ${t.label.toLowerCase()}`, why: "You saved this" });
      for (const p of peopleOf(t).slice(0, 2)) add({ href: `/explore/life?id=${p.id}`, mode: "life", title: p.label, why: `Linked to ${t.label.toLowerCase()}` });
      const peak = decades(t.items.map((x) => x.year)).sort((a, b) => b[1] - a[1])[0];
      if (peak) add({ href: `/explore/year?y=${peak[0] + 5}`, mode: "year", title: `The year ${peak[0] + 5}`, why: `The busiest decade for ${t.label.toLowerCase()}` });
    }
    if (kind === "person") {
      const p = personById(id);
      if (!p) { if (/^Q\d+$/.test(id)) add({ href: `/explore/life?q=${id}`, mode: "life", title: names[i] ?? id, why: "You saved this" }); continue; }
      add({ href: `/explore/life?id=${p.id}`, mode: "life", title: p.label, why: "You saved this" });
      for (const t of topicsOf(p.id)) add({ href: `/explore/thing?id=${t.id}`, mode: "thing", title: `Follow ${t.label.toLowerCase()}`, why: `${p.label} is part of it` });
      for (const l of linksOf(p.id)) { const o = personById(l.from === p.id ? l.to : l.from); if (o) add({ href: `/explore/life?id=${o.id}`, mode: "life", title: o.label, why: `${l.from === p.id ? `${p.label}: ${l.label}` : `${o.label}: ${l.label}`} ${l.from === p.id ? o.label : p.label}` }); }
    }
    if (kind === "year") {
      const y = Number(id);
      add({ href: `/explore/year?y=${y}`, mode: "year", title: `The year ${y}`, why: "You saved this" });
      for (const { person } of aliveIn(y).slice(0, 2)) add({ href: `/explore/life?id=${person.id}`, mode: "life", title: person.label, why: `Alive in ${y}` });
    }
  }
  return out;
}

/** Commons' artist field, tidied: no stray "=", no name said twice. */
export function artistOf(a?: string) {
  if (!a) return "";
  let s = a.replace(/^=+/, "").replace(/\s+/g, " ").trim();
  const m = s.match(/^(.{3,}?)\1/);
  if (m) s = s.slice(m[1].length);
  return s.length > 60 ? `${s.slice(0, 59)}…` : s;
}
