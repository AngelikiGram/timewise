// Live lookups on Wikidata, made in the reader's browser when they ask for a person, a thing or an event that
// isn't in the prebuilt collection. The rules are the build scripts' rules: every fact keeps the statement it
// came from, nothing is written by hand, a match says how it was made, and when Wikidata has nothing the page
// says so. Wikidata is CC0. Images are linked to their Commons page, where the licence is.
import { cached, cachedJson, until } from "./cache";
import type { Credit, LifeEvent, Person, Topic, TopicItem, Work } from "./explore";

const API = "https://www.wikidata.org/w/api.php";
const SPARQL = "https://query.wikidata.org/sparql";
const COMMONS = "https://commons.wikimedia.org/w/api.php";
export const wdUrl = (qid: string, prop?: string) => `https://www.wikidata.org/wiki/${qid}${prop ? `#${prop}` : ""}`;

const params = (p: Record<string, string>) => new URLSearchParams({ format: "json", origin: "*", ...p }).toString();

/** Every Wikidata API call goes through the shared cache: asked once, kept for a week. */
const getJson = <T,>(url: string, signal?: AbortSignal): Promise<T> => cachedJson<T>(url, signal);

export type Binding = Record<string, { value: string } | undefined>;
export function sparql(query: string, signal?: AbortSignal): Promise<Binding[]> {
  return until(cached(`sparql:${query}`, async () => {
    const r = await fetch(`${SPARQL}?format=json&query=${encodeURIComponent(query)}`, { headers: { Accept: "application/sparql-results+json" } });
    if (r.status === 429) throw new Error("Wikidata's query service is busy. Try again in a minute.");
    if (r.status === 500 || r.status === 504) throw new Error("That question was too big for Wikidata's query service. Try something narrower.");
    if (!r.ok) throw new Error(`Wikidata's query service answered ${r.status}.`);
    return ((await r.json()) as { results: { bindings: Binding[] } }).results.bindings;
  }), signal);
}

export const v = (b: Binding, k: string) => b[k]?.value;
export const qidOf = (uri?: string) => uri?.match(/Q\d+$/)?.[0];
/** "1756-01-27T00:00:00Z" or "+1756-01-27T00:00:00Z" or "-0490-..." to a year. */
export const yearOfIso = (s?: string | null) => {
  if (!s) return null;
  const m = s.match(/^([+-]?)(\d{1,6})-/);
  if (!m) return null;
  const y = Number(m[2]);
  return m[1] === "-" ? -y : y;
};
export const pointOf = (wkt?: string): [number, number] | null => {
  const m = wkt?.match(/Point\(([-\d.eE]+) ([-\d.eE]+)\)/);
  return m ? [Number(Number(m[1]).toFixed(4)), Number(Number(m[2]).toFixed(4))] : null;
};
/** A Commons file (by name or Special:FilePath URL) as a thumbnail with a link to its page, where the licence is. */
export function commonsImage(file?: string, width = 400): Credit | undefined {
  if (!file) return undefined;
  const name = decodeURIComponent(file.replace(/^https?:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\//, "")).replaceAll("_", " ");
  return { url: `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(name)}?width=${width}`, page: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(name.replaceAll(" ", "_"))}` };
}

/** Author and licence of one Commons file, read from Commons. */
async function credit(file: string, signal?: AbortSignal): Promise<Credit | undefined> {
  type R = { query: { pages: Record<string, { imageinfo?: { thumburl: string; descriptionurl: string; extmetadata?: Record<string, { value: string }> }[] }> } };
  const res = await getJson<R>(`${COMMONS}?${params({ action: "query", titles: `File:${file}`, prop: "imageinfo", iiprop: "url|extmetadata", iiurlwidth: "500" })}`, signal);
  const info = Object.values(res.query.pages)[0]?.imageinfo?.[0];
  if (!info) return undefined;
  const strip = (h?: string) => h?.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() || undefined;
  return { url: info.thumburl, page: info.descriptionurl, artist: strip(info.extmetadata?.Artist?.value)?.slice(0, 80), license: strip(info.extmetadata?.LicenseShortName?.value) };
}

// ---------------------------------------------------------------------------------------------- Search

export type Hit = { id: string; label: string; description?: string };

/** Anything on Wikidata by name, best match first. */
export async function searchEntities(text: string, signal?: AbortSignal, limit = 10): Promise<Hit[]> {
  if (text.trim().length < 2) return [];
  const d = await getJson<{ search: { id: string; label?: string; description?: string; display?: { label?: { value: string } } }[] }>(
    `${API}?${params({ action: "wbsearchentities", search: text, language: "en", uselang: "en", type: "item", limit: String(limit) })}`, signal);
  return d.search.map((x) => ({ id: x.id, label: x.display?.label?.value ?? x.label ?? x.id, description: x.description }));
}

/** Items matching a full-text search with statement filters (CirrusSearch), labelled. */
async function cirrus(expr: string, signal?: AbortSignal, limit = 10, random = false): Promise<Hit[]> {
  // A random draw must not come from the cache, or it would draw the same person every time.
  const url = `${API}?${params({ action: "query", list: "search", srsearch: expr, srnamespace: "0", srlimit: String(limit), srprop: "", ...(random ? { srsort: "random" } : {}) })}`;
  type R = { query: { search: { title: string }[] } };
  const d: R = random ? await fetch(url, { signal }).then((r) => r.json() as Promise<R>) : await getJson<R>(url, signal);
  const ids = d.query.search.map((x) => x.title).filter((x) => /^Q\d+$/.test(x));
  if (!ids.length) return [];
  const e = await getJson<{ entities: Record<string, { labels?: Record<string, { value: string }>; descriptions?: Record<string, { value: string }> }> }>(
    `${API}?${params({ action: "wbgetentities", ids: ids.join("|"), props: "labels|descriptions", languages: "en|de|fr|mul", languagefallback: "1" })}`, signal);
  return ids.map((id) => ({ id, label: e.entities[id]?.labels?.en?.value ?? Object.values(e.entities[id]?.labels ?? {})[0]?.value ?? id, description: e.entities[id]?.descriptions?.en?.value }));
}

/** People only: humans on Wikidata whose name matches. */
export const searchPeople = (text: string, signal?: AbortSignal) => (text.trim().length < 2 ? Promise.resolve([]) : cirrus(`${text.replace(/[":]/g, " ")} haswbstatement:P31=Q5`, signal));

/** Anyone at all: a random human on Wikidata with a portrait, a birth date and a birthplace. */
export async function randomPerson(signal?: AbortSignal): Promise<Hit | undefined> {
  const hits = await cirrus("haswbstatement:P31=Q5 haswbstatement:P18 haswbstatement:P569 haswbstatement:P19 haswbstatement:P106", signal, 1, true);
  return hits[0];
}

/**
 * A person by name, checked the way the build script checks: a human with that name, born in the expected
 * years, and the one with the most Wikipedia articles if several fit.
 */
export async function resolvePerson(name: string, from: number, to: number, signal?: AbortSignal): Promise<{ id: string; evidence: string } | undefined> {
  const hits = await cirrus(`${name.replace(/[":]/g, " ")} haswbstatement:P31=Q5`, signal, 8);
  if (!hits.length) return undefined;
  const rows = await sparql(`SELECT ?p ?sl WHERE { VALUES ?p { ${hits.map((h) => `wd:${h.id}`).join(" ")} } ?p wdt:P569 ?b; wikibase:sitelinks ?sl. FILTER(YEAR(?b) >= ${from} && YEAR(?b) <= ${to}) } ORDER BY DESC(?sl) LIMIT 1`, signal);
  const id = qidOf(v(rows[0] ?? {}, "p"));
  return id ? { id, evidence: `The human matching "${name}" born ${from === to ? from : `${from}–${to}`} with the most sitelinks` } : undefined;
}

// ---------------------------------------------------------------------------------------------- Lives

/** One moment of a life, with what it is, when, where if known, and the statement it comes from. */
export type MomentKind = "life" | "work" | "study" | "job" | "office" | "award" | "family" | "home" | "event";
export type Moment = { id: string; year: number; end?: number | null; label: string; kind: MomentKind; point?: [number, number] | null; place?: string | null; source: string; href?: string; external?: boolean };
/** `relation` reads "<this person> <relation> <other>"; `sentence`, when given, says the whole link instead. */
export type Related = { id: string; label: string; relation: string; sentence?: string; born?: number | null; died?: number | null; source: string; image?: Credit };
export type LifeData = { person: Person; works: Work[]; related: Related[]; moments: Moment[]; live: boolean };

type Snak = { datavalue?: { value: unknown; type: string } };
type Claim = { mainsnak: Snak; qualifiers?: Record<string, Snak[]>; rank?: string };
type Entity = { id: string; labels?: Record<string, { value: string }>; descriptions?: Record<string, { value: string }>; claims?: Record<string, Claim[]>; sitelinks?: Record<string, unknown> };

const itemOf = (s?: Snak) => (s?.datavalue?.type === "wikibase-entityid" ? (s.datavalue.value as { id: string }).id : undefined);
const timeOf = (s?: Snak) => (s?.datavalue?.type === "time" ? (s.datavalue.value as { time: string }).time : undefined);
const strOf = (s?: Snak) => (s?.datavalue?.type === "string" ? (s.datavalue.value as string) : undefined);
const qualYear = (c: Claim, ...props: string[]) => { for (const p of props) { const y = yearOfIso(timeOf(c.qualifiers?.[p]?.[0])); if (y != null) return y; } return null; };

// Statements that put a dated moment in a life. Years come from the statement's own qualifiers.
const MOMENTS: { prop: string; kind: MomentKind; say: (x: string) => string }[] = [
  { prop: "P69", kind: "study", say: (x) => `Studies at ${x}` },
  { prop: "P108", kind: "job", say: (x) => `Works for ${x}` },
  { prop: "P39", kind: "office", say: (x) => `Becomes ${x}` },
  { prop: "P166", kind: "award", say: (x) => `Receives the ${x}` },
  { prop: "P1411", kind: "award", say: (x) => `Nominated for the ${x}` },
  { prop: "P26", kind: "family", say: (x) => `Marries ${x}` },
  { prop: "P451", kind: "family", say: (x) => `Partner of ${x}` },
  { prop: "P551", kind: "home", say: (x) => `Lives in ${x}` },
  { prop: "P937", kind: "home", say: (x) => `Works in ${x}` },
  { prop: "P463", kind: "job", say: (x) => `Joins ${x}` },
  { prop: "P54", kind: "job", say: (x) => `Plays for ${x}` },
  { prop: "P102", kind: "office", say: (x) => `Joins the ${x}` },
  { prop: "P793", kind: "event", say: (x) => x },
  { prop: "P607", kind: "event", say: (x) => `Takes part in the ${x}` },
];
// Relations to other people, read as "<this person> <relation> <other>".
const RELATIONS: Record<string, string> = {
  P26: "was married to", P451: "was the partner of", P22: "was the child of", P25: "was the child of", P40: "was the parent of",
  P3373: "was a sibling of", P1066: "was a student of", P802: "was the teacher of", P185: "was the doctoral supervisor of", P184: "was a doctoral student of",
  P737: "was influenced by", P1327: "worked alongside", P3342: "was linked to", P1038: "was a relative of",
};
const WORK_ROLES: [string, string][] = [["P84", "architect"], ["P50", "author"], ["P86", "composer"], ["P170", "creator"], ["P57", "director"], ["P61", "discoverer or inventor"], ["P112", "founder"], ["P87", "librettist"], ["P58", "screenwriter"]];

async function entity(qid: string, signal?: AbortSignal): Promise<Entity> {
  const d = await getJson<{ entities: Record<string, Entity> }>(`${API}?${params({ action: "wbgetentities", ids: qid, props: "labels|descriptions|claims|sitelinks", languages: "en|de|fr|mul", languagefallback: "1" })}`, signal);
  const e = d.entities[qid];
  if (!e || "missing" in e) throw new Error("Wikidata has no item with that id.");
  return e;
}
const labelOf = (e: Entity) => e.labels?.en?.value ?? Object.values(e.labels ?? {})[0]?.value ?? e.id;

type Info = { label: string; description?: string; point: [number, number] | null; born: number | null; died: number | null; image?: string };
/** Labels, coordinates, life years and an image for many items at once. */
async function info(ids: string[], signal?: AbortSignal): Promise<Map<string, Info>> {
  const out = new Map<string, Info>();
  const uniq = [...new Set(ids)].filter((x) => /^Q\d+$/.test(x));
  for (let k = 0; k < uniq.length; k += 120) {
    const rows = await sparql(`SELECT ?x ?xLabel ?xDescription ?c ?b ?d ?img WHERE { VALUES ?x { ${uniq.slice(k, k + 120).map((i) => `wd:${i}`).join(" ")} }
      OPTIONAL { ?x wdt:P625 ?c } OPTIONAL { ?x wdt:P569 ?b } OPTIONAL { ?x wdt:P570 ?d } OPTIONAL { ?x wdt:P18 ?img }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en,de,fr,es,it,mul". } }`, signal);
    for (const r of rows) {
      const id = qidOf(v(r, "x"));
      if (!id || out.has(id)) continue;
      out.set(id, { label: v(r, "xLabel") ?? id, description: v(r, "xDescription"), point: pointOf(v(r, "c")), born: yearOfIso(v(r, "b")), died: yearOfIso(v(r, "d")), image: v(r, "img") });
    }
  }
  return out;
}

/** A person's works: things Wikidata says they made, wrote, designed or founded, best documented first. */
async function worksFor(qid: string, signal?: AbortSignal): Promise<Work[]> {
  // The query service is slow when a UNION is followed by shared patterns, so each branch carries its own
  // sitelinks, and the best-documented 60 are picked before anything else is looked up.
  const roles = WORK_ROLES.map(([p, role]) => `(wdt:${p} "${role}" "${p}")`).join(" ");
  const rows = await sparql(`SELECT ?w ?wLabel ?role ?prop ?d ?c ?placeLabel ?img ?sl WHERE {
    { SELECT ?w ?role ?prop ?sl WHERE {
      { VALUES (?p ?role ?prop) { ${roles} } ?w ?p wd:${qid}. ?w wikibase:sitelinks ?sl. }
      UNION { wd:${qid} wdt:P800 ?w. ?w wikibase:sitelinks ?sl. BIND("notable work" AS ?role) BIND("P800" AS ?prop) }
    } ORDER BY DESC(?sl) LIMIT 60 }
    OPTIONAL { ?w wdt:P577 ?d1 } OPTIONAL { ?w wdt:P571 ?d2 } BIND(COALESCE(?d1, ?d2) AS ?d)
    OPTIONAL { ?w wdt:P625 ?c } OPTIONAL { ?w wdt:P276|wdt:P131 ?place } OPTIONAL { ?w wdt:P18 ?img }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en,de,fr,es,it,mul". } }`, signal);
  const works = new Map<string, Work>();
  for (const r of rows) {
    const id = qidOf(v(r, "w"));
    if (!id || id === qid) continue;
    const label = v(r, "wLabel") ?? id;
    if (/^Q\d+$/.test(label)) continue; // no name in any language we read
    const prop = v(r, "prop")!;
    const w = works.get(id) ?? { id, label, year: null, point: null, place: null, links: Number(v(r, "sl") ?? 0), people: [], image: undefined };
    const y = yearOfIso(v(r, "d"));
    if (y != null && (w.year == null || y < w.year)) w.year = y;
    w.point ??= pointOf(v(r, "c"));
    w.place ??= v(r, "placeLabel") ?? null;
    w.image ??= commonsImage(v(r, "img"), 160);
    if (!w.people.some((x) => x.role === v(r, "role"))) w.people.push({ id: qid, role: v(r, "role")!, source: prop === "P800" ? wdUrl(qid, "P800") : wdUrl(id, prop) });
    works.set(id, w);
  }
  return [...works.values()].sort((a, b) => b.links - a.links).slice(0, 30).sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999));
}

/** Everything the life page needs about one person, read from Wikidata now. */
export async function loadLife(qid: string, signal?: AbortSignal): Promise<LifeData> {
  const e = await entity(qid, signal);
  const c = e.claims ?? {};
  const isHuman = (c.P31 ?? []).some((x) => itemOf(x.mainsnak) === "Q5");
  if (!isHuman) throw new Error(`${labelOf(e)} isn't a person on Wikidata. Try "Follow a thing" or a story instead.`);
  const first = (p: string) => (c[p] ?? []).find((x) => x.rank === "preferred") ?? c[p]?.[0];
  const ids = new Set<string>();
  const want = (id?: string) => { if (id) ids.add(id); return id; };
  const bornPlace = want(itemOf(first("P19")?.mainsnak));
  const diedPlace = want(itemOf(first("P20")?.mainsnak));
  const lists = (p: string) => (c[p] ?? []).map((x) => want(itemOf(x.mainsnak))).filter((x): x is string => !!x).slice(0, 8);
  const occ = lists("P106"), mov = lists("P135"), mem = lists("P463"), fld = lists("P101");
  const rel: { id: string; prop: string }[] = [];
  for (const p of Object.keys(RELATIONS)) for (const x of (c[p] ?? []).slice(0, 8)) { const id = want(itemOf(x.mainsnak)); if (id && id !== qid) rel.push({ id, prop: p }); }
  const raw: { prop: string; kind: MomentKind; say: (x: string) => string; id: string; y: number | null; end: number | null }[] = [];
  for (const m of MOMENTS) for (const x of (c[m.prop] ?? []).slice(0, 25)) {
    const id = want(itemOf(x.mainsnak));
    if (!id) continue;
    raw.push({ ...m, id, y: qualYear(x, "P585", "P580"), end: qualYear(x, "P582") });
  }
  const [about, works, portrait] = await Promise.all([
    info([...ids], signal),
    worksFor(qid, signal).catch(() => [] as Work[]),
    (async () => { const f = strOf(first("P18")?.mainsnak); return f ? credit(f, signal).catch(() => commonsImage(f)) : undefined; })(),
  ]);
  const name = (id?: string) => (id ? about.get(id)?.label ?? id : null);
  const life = (prop: "P569" | "P570", place?: string): LifeEvent | undefined => {
    const t = timeOf(first(prop)?.mainsnak);
    const y = yearOfIso(t);
    if (y == null) return undefined;
    const precision = (first(prop)?.mainsnak.datavalue?.value as { precision?: number } | undefined)?.precision ?? 9;
    return { year: y, date: precision >= 11 && t ? t.replace(/^\+/, "").slice(0, 10) : "", place: name(place), placeId: place ?? null, point: place ? about.get(place)?.point ?? null : null, source: wdUrl(qid, prop) };
  };
  const sourced = (xs: string[], p: string) => xs.map((id) => ({ id, label: name(id)!, source: wdUrl(qid, p) })).filter((x) => !/^Q\d+$/.test(x.label));
  const person: Person = {
    id: qid, label: labelOf(e), description: e.descriptions?.en?.value ?? null, evidence: "Opened from Wikidata by its id",
    born: life("P569", bornPlace), died: life("P570", diedPlace), image: portrait,
    occupations: sourced(occ, "P106"), movements: sourced(mov, "P135"), memberOf: sourced(mem, "P463"), fields: sourced(fld, "P101"),
  };
  // Children are dated by their own birth; other relations have no year of their own.
  const related: Related[] = [];
  for (const r of rel) {
    const o = about.get(r.id);
    if (!o || /^Q\d+$/.test(o.label) || related.some((x) => x.id === r.id)) continue;
    related.push({ id: r.id, label: o.label, relation: RELATIONS[r.prop], born: o.born, died: o.died, source: wdUrl(qid, r.prop), image: commonsImage(o.image, 120) });
  }
  const moments: Moment[] = [];
  for (const m of raw) {
    const o = about.get(m.id);
    const y = m.y;
    if (y == null || !o || /^Q\d+$/.test(o.label)) continue;
    moments.push({ id: `${m.prop}-${m.id}-${y}`, year: y, end: m.end, label: m.say(o.label), kind: m.kind, point: o.point, place: m.kind === "home" ? o.label : null, source: wdUrl(qid, m.prop), href: wdUrl(m.id), external: true });
  }
  for (const r of rel.filter((x) => x.prop === "P40")) {
    const o = about.get(r.id);
    if (o?.born != null) moments.push({ id: `P40-${r.id}`, year: o.born, label: `${o.label} is born`, kind: "family", source: wdUrl(qid, "P40"), href: `/explore/life?q=${r.id}` });
  }
  return { person, works, related, moments: moments.sort((a, b) => a.year - b.year), live: true };
}

// ---------------------------------------------------------------------------------------------- Things

/**
 * A "thing" from Wikidata: where and when it appears. Items in its style, of its kind, in its genre or movement,
 * with coordinates and a start date; or, for a field or an occupation, the people in it, placed at their birthplace.
 */
export async function loadThing(qid: string, signal?: AbortSignal, onPartial?: (t: Topic) => void): Promise<Topic> {
  const e = await entity(qid, signal);
  const label = labelOf(e);
  const placed = (deep: boolean, limit: number) => `SELECT ?item ?itemLabel ?prop ?d ?c ?placeLabel ?countryLabel WHERE {
    { SELECT ?item ?prop ?c WHERE {
      { ?item wdt:P149 wd:${qid}; wdt:P625 ?c. BIND("P149" AS ?prop) }
      UNION { ?item wdt:P31${deep ? "/wdt:P279*" : ""} wd:${qid}; wdt:P625 ?c. BIND("P31" AS ?prop) }
      UNION { ?item wdt:P136 wd:${qid}; wdt:P625 ?c. BIND("P136" AS ?prop) }
      UNION { ?item wdt:P135 wd:${qid}; wdt:P625 ?c. BIND("P135" AS ?prop) }
    } LIMIT ${limit} }
    OPTIONAL { ?item wdt:P571 ?d1 } OPTIONAL { ?item wdt:P580 ?d2 } OPTIONAL { ?item wdt:P1619 ?d3 } OPTIONAL { ?item wdt:P577 ?d4 }
    BIND(COALESCE(?d1, ?d2, ?d3, ?d4) AS ?d) FILTER(BOUND(?d))
    OPTIONAL { ?item wdt:P131 ?place } OPTIONAL { ?item wdt:P17 ?country }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en,de,fr,es,it,mul". } }`;
  const make = (rows: Binding[], kind: Topic["kind"], partial?: "loading" | "cut"): Topic => {
    const items = new Map<string, TopicItem>();
    const now = new Date().getFullYear();
    for (const r of rows) {
      const id = qidOf(v(r, "item"));
      const y = yearOfIso(v(r, "d"));
      const pt = pointOf(v(r, "c"));
      const lab = v(r, "itemLabel");
      if (!id || y == null || y > now || !pt || !lab || /^Q\d+$/.test(lab)) continue;
      const old = items.get(id);
      if (old && old.year <= y) continue;
      items.set(id, { id, label: lab, year: y, point: pt, place: v(r, "placeLabel") ?? null, country: v(r, "countryLabel") ?? null, source: wdUrl(id, v(r, "prop")) });
    }
    return {
      id: qid, qid, label, description: e.descriptions?.en?.value ?? null, kind, partial,
      evidence: `Wikidata item ${qid}, looked up live`, items: [...items.values()].sort((a, b) => a.year - b.year), yearSource: kind === "field" ? "P569" : "P571",
    } as Topic;
  };
  const kindOf = (rows: Binding[]): Topic["kind"] => (rows.filter((r) => v(r, "prop") === "P149").length > rows.length / 2 ? "style" : "class");
  // Two questions at once: a quick one (direct members only, a few hundred) that answers in seconds, and the
  // full one (every subclass) that can take much longer. The quick answer is shown while the full one runs.
  let fullDone = false;
  const quick = sparql(placed(false, 400), signal).then((rows) => { if (!fullDone && rows.length >= 3) onPartial?.(make(rows, kindOf(rows), "loading")); return rows; }, () => [] as Binding[]);
  let rows: Binding[];
  try { rows = await sparql(placed(true, 4000), signal); }
  catch (err) {
    // The full question timed out: keep the quick answer if there is one, and say it is partial.
    const q = await quick;
    if (q.length >= 3) return make(q, kindOf(q), "cut");
    throw err;
  } finally { fullDone = true; }
  if (rows.length >= 3) return make(rows, kindOf(rows));
  // Not a kind of place: perhaps a field of work, an occupation or a movement people belong to.
  const people = await sparql(`SELECT ?item ?itemLabel ?prop ?d ?c ?placeLabel WHERE {
    { SELECT ?item ?prop ?d ?c ?place WHERE {
      VALUES (?p ?prop) { (wdt:P101 "P101") (wdt:P106 "P106") (wdt:P135 "P135") }
      ?item ?p wd:${qid}. ?item wdt:P31 wd:Q5; wdt:P569 ?d; wdt:P19 ?place; wikibase:sitelinks ?sl. ?place wdt:P625 ?c. FILTER(?sl > 4)
    } LIMIT 2500 }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en,de,fr,es,it,mul". } }`, signal);
  return make(people, "field");
}

// ---------------------------------------------------------------------------------------------- Stories

export type StoryStep = { id: string; label: string; description?: string; year: number | null; point: [number, number] | null; relation: string; source: string; group: "before" | "parts" | "after" };
export type LiveStory = { id: string; label: string; description?: string; year: number | null; point: [number, number] | null; steps: StoryStep[] };

const STORY_RELS: Record<string, { group: StoryStep["group"]; say: string; on: "x" | "q"; prop: string }> = {
  cause: { group: "before", say: "was a cause of", on: "q", prop: "P828" },
  causeOf: { group: "before", say: "was a cause of", on: "x", prop: "P1542" },
  follows: { group: "before", say: "came just before", on: "q", prop: "P155" },
  part: { group: "parts", say: "was part of", on: "x", prop: "P361" },
  has: { group: "parts", say: "was part of", on: "q", prop: "P527" },
  event: { group: "parts", say: "was a significant event in", on: "q", prop: "P793" },
  effect: { group: "after", say: "was an effect of", on: "q", prop: "P1542" },
  effectOf: { group: "after", say: "was an effect of", on: "x", prop: "P828" },
  next: { group: "after", say: "came right after", on: "q", prop: "P156" },
};

/** A story made now from Wikidata's statements around one event: what led to it, its parts, what followed. */
export async function loadStory(qid: string, signal?: AbortSignal): Promise<LiveStory> {
  const q = `wd:${qid}`;
  const pat: Record<string, string> = {
    cause: `${q} wdt:P828 ?x.`, causeOf: `?x wdt:P1542 ${q}.`, follows: `${q} wdt:P155 ?x.`,
    part: `?x wdt:P361 ${q}.`, has: `${q} wdt:P527 ?x.`, event: `${q} wdt:P793 ?x.`,
    effect: `${q} wdt:P1542 ?x.`, effectOf: `?x wdt:P828 ${q}.`, next: `${q} wdt:P156 ?x.`,
  };
  const [e, rows, self] = await Promise.all([
    entity(qid, signal),
    sparql(`SELECT ?x ?xLabel ?xDescription ?rel ?d ?c WHERE {
      ${Object.entries(pat).map(([k, p]) => `{ ${p} BIND("${k}" AS ?rel) }`).join(" UNION ")}
      OPTIONAL { ?x wdt:P585 ?d1 } OPTIONAL { ?x wdt:P580 ?d2 } OPTIONAL { ?x wdt:P571 ?d3 } BIND(COALESCE(?d1, ?d2, ?d3) AS ?d)
      OPTIONAL { ?x wdt:P625 ?c1 } OPTIONAL { ?x wdt:P276/wdt:P625 ?c2 } BIND(COALESCE(?c1, ?c2) AS ?c)
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en,de,fr,es,it,mul". } } LIMIT 1500`, signal),
    sparql(`SELECT ?d ?c WHERE { OPTIONAL { ${q} wdt:P585 ?d1 } OPTIONAL { ${q} wdt:P580 ?d2 } OPTIONAL { ${q} wdt:P571 ?d3 } BIND(COALESCE(?d1, ?d2, ?d3) AS ?d)
      OPTIONAL { ${q} wdt:P625 ?c1 } OPTIONAL { ${q} wdt:P276/wdt:P625 ?c2 } BIND(COALESCE(?c1, ?c2) AS ?c) } LIMIT 1`, signal),
  ]);
  const steps = new Map<string, StoryStep>();
  for (const r of rows) {
    const id = qidOf(v(r, "x"));
    const rel = STORY_RELS[v(r, "rel") ?? ""];
    const lab = v(r, "xLabel");
    if (!id || !rel || !lab || /^Q\d+$/.test(lab) || id === qid) continue;
    const y = yearOfIso(v(r, "d"));
    const old = steps.get(id);
    if (old && (old.group === "parts" || (old.year != null && (y == null || old.year <= y)))) continue;
    steps.set(id, { id, label: lab, description: v(r, "xDescription"), year: y ?? old?.year ?? null, point: pointOf(v(r, "c")) ?? old?.point ?? null, relation: rel.say, source: rel.on === "q" ? wdUrl(qid, rel.prop) : wdUrl(id, rel.prop), group: rel.group });
  }
  const order = { before: 0, parts: 1, after: 2 };
  const all = [...steps.values()];
  // A long list of parts (a war's battles) is cut to the forty with dates, so the story stays readable.
  const parts = all.filter((s) => s.group === "parts");
  const keepParts = parts.length > 40 ? parts.filter((s) => s.year != null).slice(0, 40) : parts;
  const list = [...all.filter((s) => s.group !== "parts"), ...keepParts].sort((a, b) => order[a.group] - order[b.group] || (a.year ?? 1e9) - (b.year ?? 1e9));
  return { id: qid, label: labelOf(e), description: e.descriptions?.en?.value, year: yearOfIso(v(self[0] ?? {}, "d")), point: pointOf(v(self[0] ?? {}, "c")), steps: list };
}
