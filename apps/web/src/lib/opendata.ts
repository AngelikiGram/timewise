// Open historical datasets beyond Wikidata, all asked from the reader's browser and kept in the shared cache:
// - Europeana: 50+ million items from European archives, libraries and museums, each with its rights statement.
// - Open Library (Internet Archive): books on a subject, to read further.
// - Wikimedia Commons: freely licensed photographs taken near a place, with author and licence.
// - Our World in Data: population estimates for the world and each country, back to 10,000 BC (HYDE, Gapminder, UN).
// Each result links to where it came from. Images are shown only where their rights allow reuse.
import { cachedJson, cachedText } from "./cache";

// ---------------------------------------------------------------------------------------------- Europeana

/** Europeana's public demonstration key; set NEXT_PUBLIC_EUROPEANA_KEY for your own (free) key. */
const EUROPEANA_KEY = process.env.NEXT_PUBLIC_EUROPEANA_KEY || "api2demo";
export type ArchiveItem = { id: string; title: string; provider: string; country?: string; year?: string; type: string; preview?: string; link: string; rights: string; reusable: boolean };
/** Open licences only: public domain, CC0, CC BY, CC BY-SA. "NonCommercial" and "NoDerivs" are not reuse. */
export const reusable = (rights: string) => /publicdomain|creativecommons\.org\/licenses\/(by|by-sa)\//i.test(rights) && !/-nc|-nd/i.test(rights);
export const rightsLabel = (r: string) => {
  const m = r.match(/creativecommons\.org\/(?:licenses|publicdomain)\/([a-z-]+)/i);
  if (m) return m[1] === "zero" ? "CC0" : m[1] === "mark" ? "Public domain" : `CC ${m[1].toUpperCase()}`;
  const rs = r.match(/rightsstatements\.org\/vocab\/([A-Za-z]+(?:-[A-Za-z]+)?)/)?.[1] ?? "";
  const names: Record<string, string> = { InC: "In copyright", "InC-EDU": "In copyright, education use", "NoC-NC": "No copyright, non-commercial use", "NoC-OKLR": "No copyright, other legal limits", CNE: "Copyright not evaluated" };
  return names[rs] ?? "See the rights statement";
};

export async function europeana(query: string, signal?: AbortSignal, rows = 12): Promise<{ total: number; items: ArchiveItem[] }> {
  type R = { totalResults?: number; items?: { id: string; title?: string[]; dataProvider?: string[]; country?: string[]; year?: string[]; type?: string; edmPreview?: string[]; guid?: string; rights?: string[] }[] };
  const url = (open: boolean) => `https://api.europeana.eu/record/v2/search.json?wskey=${EUROPEANA_KEY}&query=${encodeURIComponent(query)}&rows=${rows}&media=true&thumbnail=true&profile=standard${open ? "&reusability=open" : ""}`;
  // Openly licensed items first, since only those can be shown here; then the rest, as links.
  const [open, all] = await Promise.all([cachedJson<R>(url(true), signal).catch(() => ({} as R)), cachedJson<R>(url(false), signal)]);
  const seen = new Set<string>();
  const list = [...(open.items ?? []), ...(all.items ?? [])].filter((x) => !seen.has(x.id) && seen.add(x.id)).slice(0, rows);
  return {
    total: all.totalResults ?? 0,
    items: list.map((x) => {
      const rights = x.rights?.[0] ?? "";
      return { id: x.id, title: x.title?.[0] ?? "Untitled", provider: x.dataProvider?.[0] ?? "Europeana", country: x.country?.[0], year: x.year?.[0], type: x.type ?? "", preview: x.edmPreview?.[0], link: x.guid?.split("?")[0] ?? `https://www.europeana.eu/item${x.id}`, rights, reusable: reusable(rights) };
    }),
  };
}

// ---------------------------------------------------------------------------------------------- Open Library

export type Book = { key: string; title: string; authors: string[]; year?: number; link: string };
export async function openLibrary(query: string, signal?: AbortSignal, limit = 8): Promise<Book[]> {
  type R = { docs?: { key: string; title: string; author_name?: string[]; first_publish_year?: number }[] };
  const d = await cachedJson<R>(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=${limit}&fields=key,title,author_name,first_publish_year`, signal);
  return (d.docs ?? []).map((b) => ({ key: b.key, title: b.title, authors: (b.author_name ?? []).slice(0, 2), year: b.first_publish_year, link: `https://openlibrary.org${b.key}` }));
}

// ---------------------------------------------------------------------------------------------- Commons

export type Photo = { title: string; thumb: string; page: string; artist?: string; license?: string; date?: string };
const strip = (h?: string) => h?.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() || undefined;
/** Freely licensed photographs taken within `radius` metres of a point. */
export async function commonsNear(lat: number, lng: number, signal?: AbortSignal, radius = 6000): Promise<Photo[]> {
  type R = { query?: { pages?: Record<string, { title: string; index?: number; imageinfo?: { thumburl: string; descriptionurl: string; extmetadata?: Record<string, { value: string }> }[] }> } };
  const url = `https://commons.wikimedia.org/w/api.php?origin=*&format=json&action=query&generator=geosearch&ggscoord=${lat}|${lng}&ggsradius=${radius}&ggsnamespace=6&ggslimit=24&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=360`;
  const d = await cachedJson<R>(url, signal);
  return Object.values(d.query?.pages ?? {}).sort((a, b) => (a.index ?? 0) - (b.index ?? 0)).flatMap((p) => {
    const i = p.imageinfo?.[0];
    if (!i?.thumburl || /\.(svg|pdf|tif|ogg|webm)$/i.test(p.title)) return [];
    const m = i.extmetadata ?? {};
    return [{ title: p.title.replace(/^File:/, "").replace(/\.[a-z]+$/i, ""), thumb: i.thumburl, page: i.descriptionurl, artist: strip(m.Artist?.value)?.slice(0, 60), license: strip(m.LicenseShortName?.value), date: strip(m.DateTimeOriginal?.value)?.slice(0, 10) }];
  }).slice(0, 16);
}

// ---------------------------------------------------------------------------------------------- Our World in Data

/** Population estimates for an OWID entity code (OWID_WRL for the world, AUT for Austria…), by year. */
export async function population(code = "OWID_WRL", signal?: AbortSignal): Promise<[number, number][]> {
  const csv = await cachedText(`https://ourworldindata.org/grapher/population.csv?country=${code}&csvType=filtered`, signal);
  return csv.trim().split("\n").slice(1).map((l) => l.split(",")).map((c) => [Number(c[c.length - 2]), Number(c[c.length - 1])] as [number, number]).filter(([y, n]) => Number.isFinite(y) && Number.isFinite(n) && n > 0);
}
/** The estimate for a year, between the two nearest data points. */
export function populationAt(series: [number, number][], year: number): number | null {
  if (!series.length || year < series[0][0] || year > series[series.length - 1][0]) return null;
  for (let i = 1; i < series.length; i++) {
    const [y1, n1] = series[i - 1], [y2, n2] = series[i];
    if (year >= y1 && year <= y2) return y2 === y1 ? n1 : n1 + ((n2 - n1) * (year - y1)) / (y2 - y1);
  }
  return null;
}
export const people = (n: number) => (n >= 1e9 ? `${(n / 1e9).toFixed(n >= 1e10 ? 0 : 2)} billion` : n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e8 ? 0 : 1)} million` : n >= 1e3 ? `${Math.round(n / 1e3)} thousand` : String(Math.round(n)));
export const OWID_SOURCE = "https://ourworldindata.org/grapher/population";
