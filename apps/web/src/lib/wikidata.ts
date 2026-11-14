// Live context for one imported event: Wikidata statements, a Wikipedia summary and a Commons image.
// Everything is fetched in the browser when an event is opened, and shown with its source and licence.
// Wikidata is CC0; Wikipedia text is CC BY-SA 4.0, which allows quoting with attribution; each Commons
// image carries its own licence and author, read from Commons and shown beside it.

export type Linked = { id: string; label: string };
export type Fact = { label: string; values: Linked[]; text?: string };
export type Enrichment = {
  facts: Fact[];
  before: Linked[];
  after: Linked[];
  causes: Linked[];
  effects: Linked[];
  partOf: Linked[];
  summary?: { text: string; url: string; title: string };
  image?: { url: string; page: string; artist?: string; license?: string; caption?: string };
};

const API = "https://www.wikidata.org/w/api.php";
// Statements worth a line in the key facts, by what they say. Order matters: shown top to bottom.
const FACTS: [string, string][] = [
  ["P276", "Where"], ["P17", "Country"], ["P131", "Located in"], ["P36", "Capital"], ["P710", "Involved"], ["P1346", "Winner"],
  ["P1120", "Deaths"], ["P1603", "Cases"], ["P1132", "Participants"], ["P112", "Founded by"], ["P488", "Led by"], ["P35", "Head of state"],
  ["P122", "Government"], ["P37", "Official language"], ["P38", "Currency"], ["P140", "Religion"], ["P1478", "Pathogen"],
];
const LINKS: Record<string, keyof Pick<Enrichment, "before" | "after" | "causes" | "effects" | "partOf">> = {
  P155: "before", P1365: "before", P156: "after", P1366: "after", P828: "causes", P1542: "effects", P361: "partOf",
};

type Claim = { mainsnak: { datavalue?: { value: unknown; type: string } } };
type Entity = { claims?: Record<string, Claim[]>; sitelinks?: Record<string, { title: string }>; labels?: Record<string, { value: string }> };

async function json<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} from ${new URL(url).host}`);
  return r.json() as Promise<T>;
}

const strip = (html?: string) => html?.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() || undefined;

export async function enrich(qid: string, signal?: AbortSignal): Promise<Enrichment> {
  const params = (p: Record<string, string>) => new URLSearchParams({ format: "json", origin: "*", ...p }).toString();
  const { entities } = await json<{ entities: Record<string, Entity> }>(`${API}?${params({ action: "wbgetentities", ids: qid, props: "claims|sitelinks" })}`);
  if (signal?.aborted) throw new DOMException("aborted", "AbortError");
  const claims = entities[qid]?.claims ?? {};
  const itemIds = (prop: string) =>
    (claims[prop] ?? []).map((c) => c.mainsnak.datavalue).filter((v) => v?.type === "wikibase-entityid").map((v) => (v!.value as { id: string }).id);
  const wanted = new Set([...FACTS.map(([p]) => p), ...Object.keys(LINKS)].flatMap(itemIds));
  const labels: Record<string, string> = {};
  const ids = [...wanted].slice(0, 50);
  if (ids.length) {
    const res = await json<{ entities: Record<string, Entity> }>(`${API}?${params({ action: "wbgetentities", ids: ids.join("|"), props: "labels", languages: "en|de", languagefallback: "1" })}`);
    for (const [id, e] of Object.entries(res.entities)) labels[id] = e.labels?.en?.value ?? e.labels?.de?.value ?? id;
  }
  const linked = (prop: string): Linked[] => itemIds(prop).filter((id) => labels[id]).map((id) => ({ id, label: labels[id] }));
  const quantity = (prop: string) => {
    const v = claims[prop]?.[0]?.mainsnak.datavalue;
    if (v?.type !== "quantity") return undefined;
    const n = Number((v.value as { amount: string }).amount);
    return Number.isFinite(n) ? n.toLocaleString("en") : undefined;
  };
  const facts: Fact[] = [];
  for (const [prop, label] of FACTS) {
    const values = linked(prop).slice(0, 6);
    const text = quantity(prop);
    if (values.length || text) facts.push({ label, values, text });
  }
  const out: Enrichment = { facts, before: [], after: [], causes: [], effects: [], partOf: [] };
  for (const [prop, key] of Object.entries(LINKS)) out[key].push(...linked(prop));

  const title = entities[qid]?.sitelinks?.enwiki?.title;
  const [summary, image] = await Promise.allSettled([
    title ? json<{ extract?: string; content_urls?: { desktop: { page: string } } }>(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replaceAll(" ", "_"))}`) : Promise.reject(),
    (async () => {
      const file = claims.P18?.[0]?.mainsnak.datavalue?.value as string | undefined;
      if (!file) return undefined;
      const res = await json<{ query: { pages: Record<string, { imageinfo?: { thumburl: string; descriptionurl: string; extmetadata?: Record<string, { value: string }> }[] }> } }>(
        `https://commons.wikimedia.org/w/api.php?${params({ action: "query", titles: `File:${file}`, prop: "imageinfo", iiprop: "url|extmetadata", iiurlwidth: "900" })}`,
      );
      const info = Object.values(res.query.pages)[0]?.imageinfo?.[0];
      if (!info) return undefined;
      const meta = info.extmetadata ?? {};
      return { url: info.thumburl, page: info.descriptionurl, artist: strip(meta.Artist?.value), license: strip(meta.LicenseShortName?.value), caption: strip(meta.ImageDescription?.value)?.slice(0, 200) };
    })(),
  ]);
  if (summary.status === "fulfilled" && summary.value.extract && title) {
    out.summary = { text: summary.value.extract, url: summary.value.content_urls?.desktop.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`, title };
  }
  if (image.status === "fulfilled" && image.value) out.image = image.value;
  return out;
}
