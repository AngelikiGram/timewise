import overview from "@data/generated/overview.json";
import type { OverviewData, OverviewEvent } from "@/components/Overview";

type Country = { id: string; label: string; count: number; continent?: string };
type Raw = Omit<OverviewData, "countries"> & { countries: number | Country[]; countryList?: Country[] };

// Older exports stored the country list under "countries"; newer ones under "countryList".
const list = (r: Raw): Country[] => r.countryList ?? (Array.isArray(r.countries) ? r.countries : []);
const normal = (r: Raw): OverviewData => ({ ...r, countries: list(r).length } as OverviewData);

const world = overview.world as unknown as Raw;
const continents = overview.continents as unknown as Raw[];
const continentOf = new Map(continents.flatMap((c) => list(c).map((x) => [x.id, c.id] as const)));
const allCountries = list(world).map((c) => ({ ...c, continent: c.continent ?? continentOf.get(c.id) }));

export const tabs = [{ id: "world", label: "World", href: "/history" }, ...continents.map((c) => ({ id: c.id, label: c.label, href: `/history/${c.id}` }))];
export const continentIds = continents.map((c) => c.id);

export function worldView() {
  return { data: normal(world), countries: allCountries };
}

export function continentView(id: string) {
  const c = continents.find((x) => x.id === id);
  return c ? { data: normal(c), countries: list(c) } : null;
}

/** An event opens in the atlas of the country it was imported for. */
export const atlasFor = (e: OverviewEvent) => (e.country ? `/atlas/${e.country}?event=${e.id}` : "/atlas");
