// The site-wide index of imported events (public/data/index.json): the best-documented events of each
// continent, written by apps/api/timewise_api/overview.py. Loaded once, on demand, and shared by search
// and "Meanwhile, elsewhere".
import { asset } from "./paths";

export type IndexEvent = {
  i: string; // Wikidata QID
  t: string; // title
  s: string; // start, "-0490-09-07" for BC
  e?: string; // end
  p: "day" | "month" | "year" | "decade" | "century";
  c: string; // category
  l: number; // Wikipedia language editions
  k?: string; // home country, when the event belongs to one
  ct?: string; // that country's continent
  n?: number; // number of countries Wikidata ties it to
  x?: 1; // dated from its inception, not a founding
};

export type RegionRow = { id: string; label: { en: string }; kind?: string; continent?: string | null; imported?: number };

let events: Promise<IndexEvent[]> | null = null;
let regions: Promise<RegionRow[]> | null = null;

export function loadIndex(): Promise<IndexEvent[]> {
  events ??= fetch(asset("/data/index.json"))
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`index ${r.status}`))))
    .then((d: { events: IndexEvent[] }) => d.events)
    .catch((e) => {
      events = null; // let a later attempt retry
      throw e;
    });
  return events;
}

export function loadRegions(): Promise<RegionRow[]> {
  regions ??= Promise.all([
    fetch(asset("/data/regions.json")).then((r) => r.json() as Promise<{ regions: RegionRow[] }>),
  ])
    .then(([r]) => r.regions)
    .catch((e) => {
      regions = null;
      throw e;
    });
  return regions;
}

/** Where an imported event opens: its home country's atlas, or the world map for a multi-country one. */
export const atlasHref = (e: Pick<IndexEvent, "i" | "k" | "n">) => (e.k && (e.n ?? 1) < 5 ? `/atlas/${e.k}?event=${e.i}` : `/atlas?event=${e.i}`);

export const CONTINENT_LABELS: Record<string, string> = {
  europe: "Europe",
  asia: "Asia",
  africa: "Africa",
  north_america: "North America",
  south_america: "South America",
  oceania: "Oceania",
};
