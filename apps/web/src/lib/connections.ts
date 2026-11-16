// Links that TIMEWISE adds to a Wikidata record from its own data:
// - checked: events in the hand-checked collection that took place at this place (each has sourced claims)
// - contextual: events from the world index in the same period or the same country. A shared date or
//   country is a coincidence of time or place, not a documented relationship, and is labelled that way.
import { collection, formatWhen } from "./collection";
import { yearOf } from "./dates";
import type { Link, RecordData } from "./record";
import { yearOfIso } from "./record";
import type { IndexEvent, RegionRow } from "./world-index";

/** How far apart two records may be and still share a period: wider where dates are known less precisely. */
export function periodWindow(y: number) {
  if (y < 500) return 25;
  if (y < 1500) return 10;
  if (y < 1800) return 5;
  return 2;
}

export function checkedLinks(qid: string): Link[] {
  const place = collection.places.find((p) => p.wikidata === qid);
  if (!place) return [];
  return collection.events
    .filter((e) => e.placeId === place.id)
    .map((e) => ({
      target: `checked:${e.id}`,
      label: e.title.en,
      description: formatWhen(e.when),
      relation: "took place here",
      group: "checked" as const,
      documented: true,
      href: `/explore?event=${e.id}`,
      note: "From the hand-checked TIMEWISE collection, where every claim cites a source.",
    }));
}

export function contextualLinks(record: RecordData, events: IndexEvent[], regions: RegionRow[], limit = 4): Link[] {
  const taken = new Set([record.id, ...record.links.map((l) => l.target)]);
  const y = yearOfIso(record.when.start);
  const self = events.find((e) => e.i === record.id);
  const countryLabel = record.links.find((l) => l.prop === "P17")?.label;
  const home = self?.k ?? regions.find((r) => r.label.en === countryLabel)?.id;
  const continent = self?.ct ?? regions.find((r) => r.id === home)?.continent ?? undefined;
  const out: Link[] = [];

  if (y !== undefined) {
    const w = periodWindow(y);
    const period = events
      .filter((e) => !taken.has(e.i) && (e.n ?? 1) < 5 && Math.abs(yearOf(e.s) - y) <= w && (!continent || e.ct === continent))
      .sort((a, b) => b.l - a.l)
      .slice(0, limit);
    for (const e of period) {
      taken.add(e.i);
      out.push({
        target: e.i,
        label: e.t,
        relation: "same period",
        group: "period",
        documented: false,
        note: `Both are dated within ${w} years of each other${continent ? ", on the same continent" : ""}. No relationship between them is documented here.`,
      });
    }
  }
  if (home) {
    const near = events
      .filter((e) => !taken.has(e.i) && e.k === home && (e.n ?? 1) < 5)
      .sort((a, b) => (y === undefined ? b.l - a.l : Math.abs(yearOf(a.s) - y) - Math.abs(yearOf(b.s) - y)))
      .slice(0, limit);
    const name = regions.find((r) => r.id === home)?.label.en ?? home;
    for (const e of near) {
      out.push({
        target: e.i,
        label: e.t,
        relation: `same country`,
        group: "country",
        documented: false,
        note: `Both are filed under ${name} in the TIMEWISE world index${y !== undefined ? ", and this is among the closest in date" : ""}. That alone doesn't connect them.`,
      });
    }
  }
  return out;
}
