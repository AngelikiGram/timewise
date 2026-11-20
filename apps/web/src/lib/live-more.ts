// More live Wikidata lookups: a place through the centuries, the causes and effects around an event, famous
// people resolved by name in one go, and what Wikidata's editors recorded about well-known facts (supported,
// uncertain, or marked wrong). Same rules as live.ts: every item keeps the statement it came from.
import { commonsImage, pointOf, qidOf, sparql, v, wdUrl, yearOfIso, type Binding } from "./live";
import type { Credit } from "./explore";

const LABEL = `SERVICE wikibase:label { bd:serviceParam wikibase:language "en,de,fr,es,it,mul". }`;
const named = (l?: string) => !!l && !/^Q\d+$/.test(l);

// ---------------------------------------------------------------------------------------------- Places

export type PlaceBasics = { point: [number, number] | null; founded: number | null; country: string | null; image?: Credit; population: { year: number; n: number }[] };
export type Landmark = { id: string; label: string; description?: string; kind?: string; point: [number, number] | null; year: number | null; image?: Credit; links: number };
export type Native = { id: string; label: string; description?: string; born: number | null; died: number | null; links: number };
export type PlaceEvent = { id: string; label: string; description?: string; year: number; links: number };

export async function placeBasics(qid: string, signal?: AbortSignal): Promise<PlaceBasics> {
  const rows = await sparql(`SELECT ?c ?inc ?countryLabel ?img ?pop ?pt WHERE {
    OPTIONAL { wd:${qid} wdt:P625 ?c } OPTIONAL { wd:${qid} wdt:P571 ?inc } OPTIONAL { wd:${qid} wdt:P17 ?country } OPTIONAL { wd:${qid} wdt:P18 ?img }
    OPTIONAL { wd:${qid} p:P1082 ?s. ?s ps:P1082 ?pop; pq:P585 ?pt } ${LABEL} }`, signal);
  const r0 = rows[0] ?? {};
  const pop = new Map<number, number>();
  for (const r of rows) { const y = yearOfIso(v(r, "pt")), n = Number(v(r, "pop")); if (y != null && Number.isFinite(n) && n > 0) pop.set(y, n); }
  const founded = rows.map((r) => yearOfIso(v(r, "inc"))).filter((y): y is number => y != null).sort((a, b) => a - b)[0] ?? null;
  return { point: pointOf(v(r0, "c")), founded, country: v(r0, "countryLabel") ?? null, image: commonsImage(v(r0, "img"), 900), population: [...pop.entries()].sort((a, b) => a[0] - b[0]).map(([year, n]) => ({ year, n })) };
}

// Sub-divisions of the place itself (districts, wards) are places to live, not to visit or learn about.
const ADMIN = /district|municipal|borough|quarter|neighbo|cadastral|ward|suburb|commune|census|statistical|parish|electoral|constituency|postal|zone/i;

export async function placeLandmarks(qid: string, signal?: AbortSignal): Promise<Landmark[]> {
  const rows = await sparql(`SELECT ?x ?xLabel ?xDescription ?kindLabel ?c ?inc ?img ?sl WHERE {
    { SELECT ?x ?sl WHERE { ?x wdt:P131 wd:${qid}; wdt:P625 []; wikibase:sitelinks ?sl. } ORDER BY DESC(?sl) LIMIT 120 }
    OPTIONAL { ?x wdt:P31 ?kind } OPTIONAL { ?x wdt:P625 ?c } OPTIONAL { ?x wdt:P571 ?inc } OPTIONAL { ?x wdt:P18 ?img } ${LABEL} }`, signal);
  const out = new Map<string, Landmark & { kinds: string[] }>();
  for (const r of rows) {
    const id = qidOf(v(r, "x"));
    if (!id || !named(v(r, "xLabel"))) continue;
    const l = out.get(id) ?? { id, label: v(r, "xLabel")!, description: v(r, "xDescription"), kinds: [], point: pointOf(v(r, "c")), year: null, image: commonsImage(v(r, "img"), 320), links: Number(v(r, "sl") ?? 0) };
    const k = v(r, "kindLabel");
    if (k && !l.kinds.includes(k)) l.kinds.push(k);
    const y = yearOfIso(v(r, "inc"));
    if (y != null && (l.year == null || y < l.year)) l.year = y;
    out.set(id, l);
  }
  return [...out.values()].filter((l) => !l.kinds.some((k) => ADMIN.test(k)) && !ADMIN.test(l.description ?? "")).map(({ kinds, ...l }) => ({ ...l, kind: kinds[0] })).sort((a, b) => b.links - a.links).slice(0, 60);
}

export async function placePeople(qid: string, signal?: AbortSignal): Promise<Native[]> {
  const rows = await sparql(`SELECT ?p ?pLabel ?pDescription ?b ?d ?sl WHERE {
    { SELECT ?p ?sl WHERE { ?p wdt:P19 wd:${qid}; wikibase:sitelinks ?sl. } ORDER BY DESC(?sl) LIMIT 40 }
    OPTIONAL { ?p wdt:P569 ?b } OPTIONAL { ?p wdt:P570 ?d } ${LABEL} }`, signal);
  const out = new Map<string, Native>();
  for (const r of rows) {
    const id = qidOf(v(r, "p"));
    if (!id || out.has(id) || !named(v(r, "pLabel"))) continue;
    out.set(id, { id, label: v(r, "pLabel")!, description: v(r, "pDescription"), born: yearOfIso(v(r, "b")), died: yearOfIso(v(r, "d")), links: Number(v(r, "sl") ?? 0) });
  }
  return [...out.values()].sort((a, b) => b.links - a.links);
}

// Sports results and seasons fill Wikidata's event lists but tell little about a place's history.
const SPORT = /championship|world cup|olympic|grand prix|season|tournament|\bcup\b|\bopen\b|marathon|men's|women's|\bATP\b|\bWTA\b|qualif|league|derby|regatta|eurovision song contest \d/i;

export async function placeEvents(qid: string, signal?: AbortSignal): Promise<PlaceEvent[]> {
  const rows = await sparql(`SELECT ?e ?eLabel ?eDescription ?t ?sl WHERE {
    { SELECT ?e (MIN(?t0) AS ?t) (MAX(?sl0) AS ?sl) WHERE { ?e wdt:P276 wd:${qid}; wdt:P585|wdt:P580 ?t0; wikibase:sitelinks ?sl0. FILTER(?sl0 > 2) } GROUP BY ?e ORDER BY DESC(?sl) LIMIT 250 }
    ${LABEL} }`, signal);
  const out: PlaceEvent[] = [];
  for (const r of rows) {
    const id = qidOf(v(r, "e")), y = yearOfIso(v(r, "t")), label = v(r, "eLabel");
    if (!id || y == null || !named(label) || SPORT.test(label!) || SPORT.test(v(r, "eDescription") ?? "")) continue;
    out.push({ id, label: label!, description: v(r, "eDescription"), year: y, links: Number(v(r, "sl") ?? 0) });
  }
  return out.sort((a, b) => b.links - a.links).slice(0, 50);
}

// ---------------------------------------------------------------------------------------------- Why

export type Link = { id: string; label: string; description?: string; year: number | null; kind: "cause" | "effect" | "before" | "after"; source: string };
export type Node = { id: string; label: string; description?: string; year: number | null };

/** One event and the events Wikidata ties to it by cause and effect, or by coming just before or after. */
export async function loadLinks(qid: string, signal?: AbortSignal): Promise<{ node: Node; links: Link[] }> {
  const q = `wd:${qid}`;
  const pat: [string, string, Link["kind"], "q" | "x", string][] = [
    ["cause", `${q} wdt:P828 ?x.`, "cause", "q", "P828"], ["cause2", `?x wdt:P1542 ${q}.`, "cause", "x", "P1542"], ["cause3", `${q} wdt:P1478 ?x.`, "cause", "q", "P1478"],
    ["effect", `${q} wdt:P1542 ?x.`, "effect", "q", "P1542"], ["effect2", `?x wdt:P828 ${q}.`, "effect", "x", "P828"], ["effect3", `?x wdt:P1478 ${q}.`, "effect", "x", "P1478"],
    ["before", `${q} wdt:P155 ?x.`, "before", "q", "P155"], ["after", `${q} wdt:P156 ?x.`, "after", "q", "P156"],
  ];
  const [rows, self] = await Promise.all([
    sparql(`SELECT ?x ?xLabel ?xDescription ?rel ?d WHERE {
      ${pat.map(([k, p]) => `{ ${p} BIND("${k}" AS ?rel) }`).join(" UNION ")}
      OPTIONAL { ?x wdt:P585 ?d1 } OPTIONAL { ?x wdt:P580 ?d2 } OPTIONAL { ?x wdt:P571 ?d3 } BIND(COALESCE(?d1, ?d2, ?d3) AS ?d) ${LABEL} } LIMIT 300`, signal),
    sparql(`SELECT ?l ?desc ?d WHERE { OPTIONAL { ${q} rdfs:label ?l FILTER(LANG(?l) = "en") } OPTIONAL { ${q} schema:description ?desc FILTER(LANG(?desc) = "en") }
      OPTIONAL { ${q} wdt:P585 ?d1 } OPTIONAL { ${q} wdt:P580 ?d2 } OPTIONAL { ${q} wdt:P571 ?d3 } BIND(COALESCE(?d1, ?d2, ?d3) AS ?d) } LIMIT 1`, signal),
  ]);
  const links = new Map<string, Link>();
  for (const r of rows) {
    const id = qidOf(v(r, "x"));
    const p = pat.find((x) => x[0] === v(r, "rel"));
    if (!id || !p || id === qid || !named(v(r, "xLabel"))) continue;
    const old = links.get(id);
    // A cause or effect says more than "came before/after": keep the stronger link.
    if (old && (old.kind === "cause" || old.kind === "effect")) continue;
    links.set(id, { id, label: v(r, "xLabel")!, description: v(r, "xDescription"), year: yearOfIso(v(r, "d")), kind: p[2], source: p[3] === "q" ? wdUrl(qid, p[4]) : wdUrl(id, p[4]) });
  }
  const s0: Binding = self[0] ?? {};
  return { node: { id: qid, label: v(s0, "l") ?? qid, description: v(s0, "desc"), year: yearOfIso(v(s0, "d")) }, links: [...links.values()] };
}

// ---------------------------------------------------------------------------------------------- People by name

/** Many famous people at once, by their exact English name, checked against birth years. */
export async function resolveMany(people: { name: string; from: number; to: number }[], signal?: AbortSignal): Promise<{ name: string; id: string }[]> {
  const out: { name: string; id: string }[] = [];
  for (let k = 0; k < people.length; k += 60) {
    const chunk = people.slice(k, k + 60);
    const rows = await sparql(`SELECT ?name ?p ?b ?sl WHERE { VALUES ?name { ${chunk.map((p) => `${JSON.stringify(p.name)}@en`).join(" ")} }
      ?p rdfs:label ?name; wdt:P31 wd:Q5; wikibase:sitelinks ?sl. OPTIONAL { ?p wdt:P569 ?b } }`, signal);
    for (const f of chunk) {
      const best = rows.filter((r) => v(r, "name") === f.name).filter((r) => { const y = yearOfIso(v(r, "b")); return y != null && y >= f.from && y <= f.to; })
        .sort((a, b) => Number(v(b, "sl")) - Number(v(a, "sl")))[0];
      const id = qidOf(v(best ?? {}, "p"));
      if (id && !out.some((o) => o.id === id)) out.push({ name: f.name, id });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------- Fact or myth

export type Verdict = "supported" | "uncertain" | "wrong";
export type FactClaim = {
  id: string; personId: string; person: string; prop: "P569" | "P570" | "P19" | "P20"; statement: string;
  value: string; verdict: Verdict; why: string; refs: number; source: string;
};
const PROPS = { born: "P569", died: "P570", bornIn: "P19", diedIn: "P20" } as const;
// Qualifiers that make a value uncertain. Others, such as "assumed Julian calendar", are about the record, not the fact.
const UNSURE = /circa|approx|disput|presum|possibl|probabl|uncertain|alleged|hypothe|likely|unconfirmed|legend|tradition|conject|estimat|before|after|or later|or earlier/i;
const CAL: Record<string, string> = { "http://www.wikidata.org/entity/Q1985786": "Julian calendar" };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** A Wikidata time as written in the statement, in its own calendar: "23 April 1564 (Julian calendar)". */
export function formatTime(time: string, precision: number, calendar?: string) {
  const m = time.match(/^([+-])(\d+)-(\d\d)-(\d\d)/);
  if (!m) return time;
  const y = Number(m[2]), yr = m[1] === "-" ? `${y} BC` : String(y);
  const s = precision >= 11 ? `${Number(m[4])} ${MONTHS[Number(m[3]) - 1]} ${yr}` : precision === 10 ? `${MONTHS[Number(m[3]) - 1]} ${yr}` : precision === 9 ? yr : precision === 8 ? `the ${Math.floor(y / 10) * 10}s` : `the ${Math.floor(y / 100) + 1}th century`;
  return calendar && CAL[calendar] ? `${s} (${CAL[calendar]})` : s;
}

type Snak = { datavalue?: { value: { time?: string; precision?: number; calendarmodel?: string; id?: string } } };
type WClaim = { id: string; rank: string; mainsnak: Snak; qualifiers?: Record<string, Snak[]>; references?: unknown[] };

/**
 * Statements about where and when well-known people were born and died, sorted by what Wikidata's editors
 * recorded: referenced and unqualified (supported); qualified as circa, disputed and the like (uncertain);
 * or deprecated, often with a reason (marked wrong). The values are read from each statement as written.
 */
export async function factClaims(ids: string[], signal?: AbortSignal): Promise<FactClaim[]> {
  const rows = await sparql(`SELECT ?p ?pl ?k ?st ?vl ?rank ?reasonl ?circl (COUNT(DISTINCT ?ref) AS ?refs) WHERE {
    VALUES ?p { ${ids.map((i) => `wd:${i}`).join(" ")} }
    VALUES (?k ?prop ?ps) { ("born" p:P569 ps:P569) ("died" p:P570 ps:P570) ("bornIn" p:P19 ps:P19) ("diedIn" p:P20 ps:P20) }
    ?p ?prop ?st. ?st ?ps ?v; wikibase:rank ?rank.
    OPTIONAL { ?v rdfs:label ?vl FILTER(LANG(?vl) = "en") }
    OPTIONAL { ?p rdfs:label ?pl FILTER(LANG(?pl) = "en") }
    OPTIONAL { ?st pq:P2241 ?reason. ?reason rdfs:label ?reasonl FILTER(LANG(?reasonl) = "en") }
    OPTIONAL { ?st pq:P1480 ?circ. ?circ rdfs:label ?circl FILTER(LANG(?circl) = "en") }
    OPTIONAL { ?st prov:wasDerivedFrom ?ref }
  } GROUP BY ?p ?pl ?k ?st ?vl ?rank ?reasonl ?circl`, signal);
  const out = new Map<string, FactClaim & { k: keyof typeof PROPS; rawPlace?: string }>();
  for (const r of rows) {
    const pid = qidOf(v(r, "p")), st = v(r, "st"), person = v(r, "pl"), k = v(r, "k") as keyof typeof PROPS;
    if (!pid || !st || !person || !PROPS[k]) continue;
    const id = st.replace(/^.*\/statement\//, "").replace("-", "$");
    const rank = (v(r, "rank") ?? "").split("#")[1];
    const circ = v(r, "circl"), reason = v(r, "reasonl"), refs = Number(v(r, "refs") ?? 0);
    const old = out.get(id);
    const verdict: Verdict = rank === "DeprecatedRank" ? "wrong" : circ && UNSURE.test(circ) ? "uncertain" : refs > 0 ? "supported" : (old?.verdict ?? "uncertain");
    if (rank !== "DeprecatedRank" && !(circ && UNSURE.test(circ)) && refs === 0) continue; // unreferenced: no verdict to give
    const why = verdict === "wrong" ? `Wikidata's editors deprecated this value${reason ? `: “${reason}”` : ""}.` : verdict === "uncertain" ? `Wikidata records it with the qualifier “${circ}”.` : `Wikidata gives it with ${refs} reference${refs === 1 ? "" : "s"} and no doubt attached.`;
    if (old && old.verdict === "uncertain" && verdict !== "uncertain") continue;
    out.set(id, { id, k, personId: pid, person, prop: PROPS[k], statement: "", value: v(r, "vl") ?? "", rawPlace: v(r, "vl"), verdict, why, refs, source: wdUrl(pid, PROPS[k]) });
  }
  return [...out.values()].filter((c) => (c.k === "bornIn" || c.k === "diedIn" ? named(c.rawPlace) : true)).map(({ k, rawPlace, ...c }) => ({
    ...c, statement: k === "born" ? `${c.person} was born on …` : k === "died" ? `${c.person} died on …` : k === "bornIn" ? `${c.person} was born in ${rawPlace}.` : `${c.person} died in ${rawPlace}.`,
  }));
}

/** The statement's value as written (dates in their own calendar), and the value Wikidata prefers instead. */
export async function claimDetail(c: FactClaim, signal?: AbortSignal): Promise<{ value: string; preferred: string[] }> {
  const r = await fetch(`https://www.wikidata.org/w/api.php?format=json&origin=*&action=wbgetclaims&entity=${c.personId}&property=${c.prop}`, { signal });
  const d = (await r.json()) as { claims?: Record<string, WClaim[]> };
  const list = d.claims?.[c.prop] ?? [];
  const show = (s: Snak) => (s.datavalue?.value.time ? formatTime(s.datavalue.value.time, s.datavalue.value.precision ?? 9, s.datavalue.value.calendarmodel) : c.value);
  const same = (x: WClaim) => x.id.toLowerCase() === c.id.toLowerCase();
  const me = list.find(same);
  const best = list.filter((x) => !same(x) && x.rank !== "deprecated").sort((a, b) => (a.rank === "preferred" ? -1 : 0) - (b.rank === "preferred" ? -1 : 0));
  const value = me ? show(me.mainsnak) : c.value;
  return { value, preferred: c.prop === "P19" || c.prop === "P20" ? [] : best.map((x) => show(x.mainsnak)).filter((x) => x !== value) };
}
