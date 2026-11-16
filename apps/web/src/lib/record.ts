// Records and their connections, for the network explorer.
//
// A record is any Wikidata item: an event, a person, a place, an invention or an idea. It is read live
// from Wikidata (CC0) when opened, with a Wikipedia summary (CC BY-SA 4.0, attributed) and a Commons
// image (each with its own licence). Nothing here is written by TIMEWISE or generated.
//
// Two kinds of link, never mixed:
// - documented: a Wikidata statement says so ("has cause", "participant", "inventor"…). Each keeps the
//   property it came from, the statement's link, and how many references Wikidata gives for it.
// - contextual: TIMEWISE noticed a shared period or country in its own index. That is not a relationship,
//   and is labelled as such.
import { formatYear } from "./dates";

export type Kind = "event" | "person" | "place" | "invention" | "idea";
export const KIND_LABEL: Record<Kind, string> = { event: "Event", person: "Person", place: "Place", invention: "Invention or discovery", idea: "Idea, work or thing" };

export type Group = "cause" | "sequence" | "parts" | "people" | "places" | "ideas" | "period" | "country" | "checked";
export const GROUPS: Record<Group, { label: string; documented: boolean }> = {
  cause: { label: "Causes and effects", documented: true },
  sequence: { label: "Before and after", documented: true },
  parts: { label: "Part of, and parts", documented: true },
  people: { label: "People and groups", documented: true },
  places: { label: "Places", documented: true },
  ideas: { label: "Ideas, works and inventions", documented: true },
  checked: { label: "Checked TIMEWISE events here", documented: true },
  period: { label: "Same period", documented: false },
  country: { label: "Same country", documented: false },
};

export type Link = {
  target: string;
  label: string;
  description?: string;
  /** Why the two are connected, read from this record's point of view: "led to", "participant". */
  relation: string;
  group: Group;
  documented: boolean;
  /** The Wikidata property, and on whose page the statement sits. */
  prop?: string;
  statementOn?: string;
  references?: number;
  /** Where the link opens, when it isn't another Wikidata record. */
  href?: string;
  note?: string;
};

export type When = { start?: string; end?: string; precision?: number; text?: string };
export type RecordData = {
  id: string;
  label: string;
  description?: string;
  kind: Kind;
  types: string[];
  when: When;
  coord?: [number, number];
  country?: string;
  summary?: { text: string; url: string; title: string };
  image?: { url: string; page: string; artist?: string; license?: string };
  links: Link[];
  /** How much Wikidata holds about it, to show gaps honestly. */
  statements: number;
  referenced: number;
  missing: string[];
  url: string;
};

/** Extra facts for linked records, loaded after the network is drawn. */
export type NodeFacts = { year?: number; coord?: [number, number]; country?: string; human?: boolean };

const API = "https://www.wikidata.org/w/api.php";
const MAX_PER_PROP = 6;

// [property, relation as read from this record, group]
const FORWARD: [string, string, Group][] = [
  ["P828", "caused by", "cause"], ["P1478", "immediate cause", "cause"], ["P1542", "led to", "cause"],
  ["P155", "follows", "sequence"], ["P1365", "replaces", "sequence"], ["P156", "followed by", "sequence"], ["P1366", "replaced by", "sequence"],
  ["P361", "part of", "parts"], ["P527", "has part", "parts"], ["P793", "significant event", "parts"],
  ["P710", "participant", "people"], ["P1346", "winner", "people"], ["P112", "founded by", "people"], ["P61", "discoverer or inventor", "people"],
  ["P170", "creator", "people"], ["P50", "author", "people"], ["P488", "chairperson", "people"], ["P35", "head of state", "people"],
  ["P737", "influenced by", "people"], ["P1066", "student of", "people"], ["P463", "member of", "people"], ["P1344", "took part in", "parts"],
  ["P276", "location", "places"], ["P131", "located in", "places"], ["P17", "country", "places"], ["P19", "born in", "places"],
  ["P20", "died in", "places"], ["P159", "headquarters", "places"], ["P36", "capital", "places"], ["P69", "educated at", "places"],
  ["P800", "notable work", "ideas"], ["P101", "field of work", "ideas"], ["P135", "movement", "ideas"], ["P144", "based on", "ideas"],
  ["P941", "inspired by", "ideas"], ["P2283", "uses", "ideas"], ["P366", "used for", "ideas"], ["P921", "main subject", "ideas"],
  ["P138", "named after", "ideas"], ["P279", "a kind of", "ideas"],
];
// Statements on other records that point here: [property, relation as read from this record, group].
const REVERSE: [string, string, Group][] = [
  ["P828", "led to", "cause"], ["P1542", "caused by", "cause"], ["P361", "has part", "parts"],
  ["P710", "took part in", "parts"], ["P61", "discovered or invented", "ideas"], ["P50", "wrote", "ideas"], ["P737", "influenced", "people"],
];

type Snak = { datavalue?: { value: unknown; type: string } };
type Claim = { mainsnak: Snak; references?: unknown[]; rank?: string };
type Entity = {
  claims?: Record<string, Claim[]>;
  sitelinks?: Record<string, { title: string }>;
  labels?: Record<string, { value: string }>;
  descriptions?: Record<string, { value: string }>;
  missing?: string;
};

const qs = (p: Record<string, string>) => new URLSearchParams({ format: "json", origin: "*", ...p }).toString();
async function json<T>(url: string, signal?: AbortSignal): Promise<T> {
  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error(`${r.status} from ${new URL(url).host}`);
  return r.json() as Promise<T>;
}
const strip = (html?: string) => html?.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() || undefined;
export const isQid = (s: string | null | undefined): s is string => !!s && /^Q\d+$/.test(s);

export async function labelsFor(ids: string[], signal?: AbortSignal) {
  const out: Record<string, { label: string; description?: string }> = {};
  for (let i = 0; i < ids.length; i += 50) {
    const res = await json<{ entities: Record<string, Entity> }>(
      `${API}?${qs({ action: "wbgetentities", ids: ids.slice(i, i + 50).join("|"), props: "labels|descriptions", languages: "en|de|fr", languagefallback: "1" })}`,
      signal,
    );
    for (const [id, e] of Object.entries(res.entities)) {
      const label = e.labels?.en?.value ?? e.labels?.de?.value ?? e.labels?.fr?.value;
      if (label) out[id] = { label, description: e.descriptions?.en?.value };
    }
  }
  return out;
}

/** Wikidata time values carry a precision: 9 year, 10 month, 11 day; 8 decade, 7 century. */
function timeOf(claims: Record<string, Claim[]>, props: string[]): { time: string; precision: number } | undefined {
  for (const p of props) {
    const v = claims[p]?.find((c) => c.rank !== "deprecated")?.mainsnak.datavalue;
    if (v?.type === "time") {
      const { time, precision } = v.value as { time: string; precision: number };
      return { time: time.replace(/^\+/, "").slice(0, time.startsWith("-") ? 11 : 10), precision };
    }
  }
  return undefined;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export function formatTime(iso: string, precision = 9): string {
  const bc = iso.startsWith("-");
  const [y, m, d] = iso.replace(/^-/, "").split("-").map(Number);
  const year = bc ? -y : y;
  if (precision <= 7) {
    const c = Math.ceil(Math.abs(year) / 100);
    return `${c}${c % 10 === 1 && c !== 11 ? "st" : c % 10 === 2 && c !== 12 ? "nd" : c % 10 === 3 && c !== 13 ? "rd" : "th"} century${bc ? " BC" : ""}`;
  }
  if (precision === 8) return `${formatYear(Math.floor(year / 10) * 10)}s`;
  if (precision === 9 || !m) return formatYear(year);
  if (precision === 10) return `${MONTHS[m - 1]} ${formatYear(year)}`;
  return `${d} ${MONTHS[m - 1]} ${formatYear(year)}`;
}
export const yearOfIso = (iso?: string) => (iso ? (iso.startsWith("-") ? -Number(iso.slice(1, 5)) : Number(iso.slice(0, 4))) : undefined);

function kindOf(claims: Record<string, Claim[]>, hasDate: boolean): Kind {
  const ids = (p: string) => (claims[p] ?? []).map((c) => (c.mainsnak.datavalue?.value as { id?: string } | undefined)?.id);
  if (ids("P31").includes("Q5")) return "person";
  if (claims.P61 || claims.P575) return "invention";
  if (claims.P625 && !hasDate) return "place";
  if (hasDate && (claims.P585 || claims.P580 || claims.P710 || claims.P828 || claims.P1542)) return "event";
  return claims.P625 ? "place" : "idea";
}

async function reverseLinks(qid: string, signal?: AbortSignal): Promise<{ id: string; prop: string; relation: string; group: Group }[]> {
  const found = await Promise.allSettled(
    REVERSE.map(async ([prop, relation, group]) => {
      const r = await json<{ query?: { search: { title: string }[] } }>(
        `${API}?${qs({ action: "query", list: "search", srsearch: `haswbstatement:${prop}=${qid}`, srlimit: String(MAX_PER_PROP), srnamespace: "0" })}`,
        signal,
      );
      return (r.query?.search ?? []).map((s) => ({ id: s.title, prop, relation, group }));
    }),
  );
  return found.flatMap((f) => (f.status === "fulfilled" ? f.value : []));
}

/** Read one record and its documented links from Wikidata. Contextual links are added by the caller. */
export async function fetchRecord(qid: string, signal?: AbortSignal): Promise<RecordData> {
  const [res, reverse] = await Promise.all([
    json<{ entities: Record<string, Entity> }>(
      `${API}?${qs({ action: "wbgetentities", ids: qid, props: "claims|labels|descriptions|sitelinks", languages: "en|de|fr", languagefallback: "1", sitefilter: "enwiki" })}`,
      signal,
    ),
    reverseLinks(qid, signal).catch(() => []),
  ]);
  const e = res.entities[qid];
  if (!e || e.missing !== undefined) throw new Error(`Wikidata has no record ${qid}`);
  const claims = e.claims ?? {};
  const itemClaims = (prop: string) =>
    (claims[prop] ?? [])
      .filter((c) => c.rank !== "deprecated" && c.mainsnak.datavalue?.type === "wikibase-entityid")
      .map((c) => ({ id: (c.mainsnak.datavalue!.value as { id: string }).id, references: c.references?.length ?? 0 }))
      .filter((c) => c.id.startsWith("Q"));

  const raw: Omit<Link, "label">[] = [];
  const seen = new Set<string>([qid]);
  for (const [prop, relation, group] of FORWARD) {
    for (const c of itemClaims(prop).slice(0, MAX_PER_PROP)) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      raw.push({ target: c.id, relation, group, documented: true, prop, statementOn: qid, references: c.references });
    }
  }
  for (const r of reverse) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    raw.push({ target: r.id, relation: r.relation, group: r.group, documented: true, prop: r.prop, statementOn: r.id });
  }
  const typeIds = itemClaims("P31").slice(0, 3).map((c) => c.id);
  const labels = await labelsFor([...new Set([...raw.map((l) => l.target), ...typeIds])], signal);
  const links: Link[] = raw.filter((l) => labels[l.target]).map((l) => ({ ...l, label: labels[l.target].label, description: labels[l.target].description }));

  const start = timeOf(claims, ["P585", "P580", "P571", "P569", "P575", "P577", "P1191"]);
  const end = timeOf(claims, ["P582", "P576", "P570"]);
  const coordValue = claims.P625?.[0]?.mainsnak.datavalue?.value as { latitude: number; longitude: number } | undefined;
  const kind = kindOf(claims, !!start);
  const when: When = start
    ? { start: start.time, end: end?.time, precision: start.precision, text: end && end.time !== start.time ? `${formatTime(start.time, start.precision)} – ${formatTime(end.time, end.precision)}` : formatTime(start.time, start.precision) }
    : {};

  const all = Object.values(claims).flat();
  const missing: string[] = [];
  if (!start) missing.push("No date in Wikidata");
  if (!coordValue && kind !== "idea") missing.push("No coordinates in Wikidata");
  if (!links.length) missing.push("No documented links to other records");

  const title = e.sitelinks?.enwiki?.title;
  const label = e.labels?.en?.value ?? e.labels?.de?.value ?? e.labels?.fr?.value ?? qid;
  const [summary, image] = await Promise.allSettled([
    title ? json<{ extract?: string; content_urls?: { desktop: { page: string } } }>(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replaceAll(" ", "_"))}`, signal) : Promise.reject(),
    (async () => {
      const file = claims.P18?.[0]?.mainsnak.datavalue?.value as string | undefined;
      if (!file) return undefined;
      const r = await json<{ query: { pages: Record<string, { imageinfo?: { thumburl: string; descriptionurl: string; extmetadata?: Record<string, { value: string }> }[] }> } }>(
        `https://commons.wikimedia.org/w/api.php?${qs({ action: "query", titles: `File:${file}`, prop: "imageinfo", iiprop: "url|extmetadata", iiurlwidth: "640" })}`,
        signal,
      );
      const info = Object.values(r.query.pages)[0]?.imageinfo?.[0];
      if (!info) return undefined;
      const meta = info.extmetadata ?? {};
      return { url: info.thumburl, page: info.descriptionurl, artist: strip(meta.Artist?.value)?.slice(0, 80), license: strip(meta.LicenseShortName?.value) };
    })(),
  ]);
  if (summary.status !== "fulfilled" || !summary.value.extract) missing.push("No Wikipedia summary in English");
  if (image.status !== "fulfilled" || !image.value) missing.push("No openly licensed image");

  return {
    id: qid,
    label,
    description: e.descriptions?.en?.value,
    kind,
    types: typeIds.map((t) => labels[t]?.label).filter(Boolean) as string[],
    when,
    coord: coordValue ? [coordValue.longitude, coordValue.latitude] : undefined,
    summary: summary.status === "fulfilled" && summary.value.extract && title ? { text: summary.value.extract, url: summary.value.content_urls?.desktop.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`, title } : undefined,
    image: image.status === "fulfilled" ? image.value : undefined,
    links,
    statements: all.length,
    referenced: all.filter((c) => c.references?.length).length,
    missing,
    url: `https://www.wikidata.org/wiki/${qid}`,
  };
}

/** Year, place and type of the linked records, in one query to the Wikidata Query Service. */
export async function fetchNodeFacts(ids: string[], signal?: AbortSignal): Promise<Record<string, NodeFacts>> {
  if (!ids.length) return {};
  const query = `SELECT ?item (MIN(?d) AS ?date) (SAMPLE(?c) AS ?coord) (SAMPLE(?cl) AS ?country) (MAX(?h) AS ?human) WHERE {
  VALUES ?item { ${ids.map((i) => `wd:${i}`).join(" ")} }
  OPTIONAL { ?item wdt:P585|wdt:P580|wdt:P571|wdt:P569|wdt:P575|wdt:P577 ?d }
  OPTIONAL { ?item wdt:P625 ?c }
  OPTIONAL { ?item wdt:P17 ?cn . ?cn rdfs:label ?cl FILTER(LANG(?cl) = "en") }
  BIND(EXISTS { ?item wdt:P31 wd:Q5 } AS ?h)
} GROUP BY ?item`;
  const r = await json<{ results: { bindings: Record<string, { value: string }>[] } }>(
    `https://query.wikidata.org/sparql?${new URLSearchParams({ query, format: "json" })}`,
    signal,
  );
  const out: Record<string, NodeFacts> = {};
  for (const b of r.results.bindings) {
    const id = b.item.value.split("/").pop()!;
    const point = b.coord?.value.match(/Point\(([-\d.]+) ([-\d.]+)\)/);
    const d = b.date?.value;
    out[id] = {
      year: d ? (d.startsWith("-") ? -Number(d.slice(1, 5)) : Number(d.slice(0, 4))) : undefined,
      coord: point ? [Number(point[1]), Number(point[2])] : undefined,
      country: b.country?.value,
      human: b.human?.value === "true",
    };
  }
  return out;
}

export type SearchResult = { id: string; label: string; description?: string };
/** Live search across all of Wikidata: people, places, inventions and ideas as well as events. */
export async function searchWikidata(q: string, signal?: AbortSignal): Promise<SearchResult[]> {
  const r = await json<{ search: { id: string; label?: string; description?: string; display?: { label?: { value: string } } }[] }>(
    `${API}?${qs({ action: "wbsearchentities", search: q, language: "en", uselang: "en", type: "item", limit: "8" })}`,
    signal,
  );
  return r.search.map((s) => ({ id: s.id, label: s.display?.label?.value ?? s.label ?? s.id, description: s.description }));
}

export const statementUrl = (l: Link) => (l.statementOn && l.prop ? `https://www.wikidata.org/wiki/${l.statementOn}#${l.prop}` : undefined);
export const propertyUrl = (prop: string) => `https://www.wikidata.org/wiki/Property:${prop}`;
