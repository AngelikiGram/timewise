// Learning paths and their short lessons.
//
// Two kinds of path, never mixed:
// - The checked path is built from the hand-checked Austria collection. Every card and every answer comes
//   from a curated event or a sourced claim, and links to that source.
// - Region, topic, place and period journeys are built from imported Wikidata records (the TIMEWISE region files), and
//   are labelled unreviewed. Their cards use only Wikidata's own title, date, place and short description,
//   and a cause-and-consequence question appears only when a Wikidata statement documents one.
//
// Nothing is written here that isn't in those records: questions are assembled from them, not authored.
import { claimsFor, collection, eventsByDate, formatWhen, placeById, sourceById, SUPPORT_LABELS } from "./collection";
import { ESTABLISH_OPTIONS, shuffle } from "./challenges";
import { formatImportedDate, formatYear, yearOf, type Precision } from "./dates";
import { asset } from "./paths";
import { fetchNodeFacts, fetchRecord } from "./record";
import { CONTINENT_LABELS, loadRegions } from "./world-index";
import { checkedEventId, countryId, personId, wikidataUrl, type Edge, type Entity } from "./entities";
import catalog from "./journey-catalog.json";

export type Skill = "chronology" | "geography" | "evidence" | "people" | "cause";
export const SKILLS: Record<Skill, { label: string; help: string }> = {
  chronology: { label: "Chronology", help: "Putting events in order and placing them in time." },
  geography: { label: "Geography", help: "Knowing where things happened." },
  evidence: { label: "Evidence", help: "Telling what a source says, and how firmly." },
  people: { label: "People", help: "Connecting people to the events they're recorded in." },
  cause: { label: "Cause and consequence", help: "Following documented causes and effects." },
};

export type SourceRef = { label: string; url: string; note?: string };
export type Review = "source_checked" | "imported";
export type OrderItem = { id: string; label: string; when: string };
export type MapPoint = { label: string; lng: number; lat: number; answer?: boolean };
export type Activity =
  /** Place a record on a timeline of other, dated records: choose the gap it belongs in. */
  | { kind: "timeline"; skill: Skill; prompt: string; target: string; anchors: OrderItem[]; answer: number; explanation: string; sources: SourceRef[] }
  | { kind: "order"; skill: Skill; prompt: string; items: OrderItem[]; explanation: string; sources: SourceRef[] }
  | { kind: "choice"; skill: Skill; prompt: string; context?: string; options: { id: string; label: string }[]; answer: string; explanation: string; sources: SourceRef[]; map?: MapPoint[]; note?: string };

export type LearnCard = {
  id: string;
  title: string;
  when: string;
  /** For placing it on the lesson's timeline. */
  year?: number;
  where?: string;
  point?: [number, number];
  summary?: string;
  summarySource?: string;
  claims: { text: string; support: string; supportHelp: string; sources: SourceRef[] }[];
  image?: { url: string; page: string; title: string; creator: string; created: string; license: string; caveat?: string };
  explore?: string;
  saveHref: string;
  /** The record as an entity, and the named place and people that can be opened from the card. */
  entity: Entity;
  place?: Entity;
  people?: { name: string; entity?: Entity }[];
};

export type Lesson = {
  id: string;
  pathId: string;
  title: string;
  question?: string;
  intro: string;
  minutes: number;
  review: Review;
  cards: LearnCard[];
  activities: Activity[];
  /** Said plainly at the end: what this lesson couldn't ask, and why. */
  gaps: string[];
  /** Sourced relationships among this lesson's entities: what finishing it adds to the learner's atlas. */
  edges: Edge[];
  /** Entities reached through those relationships that aren't cards of their own. */
  extra?: Entity[];
  related: { label: string; href: string }[];
};

export type LessonStub = { id: string; title: string; minutes: number; skills: Skill[]; milestone?: string };
export type IconKey = "map" | "timeline" | "place" | "war" | "politics" | "culture" | "state" | "checked";
export type PathDef = { id: string; title: string; kind: "question" | "region" | "period" | "topic" | "place"; blurb: string; why: string; difficulty: "Easy" | "Medium"; icon: IconKey; review: Review; lessons: LessonStub[] };

const src = (id: string): SourceRef => {
  const s = sourceById.get(id)!;
  return { label: `${s.title} (${s.provider})`, url: s.url };
};
const firstSources = (eventId: string) => claimsFor(eventId).flatMap((c) => c.evidence.map((e) => e.sourceId)).filter((v, i, a) => a.indexOf(v) === i).slice(0, 2).map(src);
const countryName = (code: string) => {
  try { return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code; } catch { return code; }
};
const hash = (s: string) => [...s].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) >>> 0, 7);

// ---------------------------------------------------------------- the checked path

const inv = collection.investigations[0];
const chapterEvents = (chapterId: string) => eventsByDate.filter((e) => e.chapterId === chapterId);
const periodOf = (iso: string) => collection.periods.find((p) => p.start <= iso && iso <= p.end);

export const CHECKED_PATH: PathDef = {
  id: "austria",
  title: "Austria: Empire to Republic",
  kind: "question",
  blurb: `${inv.question.en} Six short lessons, from railways to a new republic, every statement checked against a linked source.`,
  why: "Written from the hand-checked Austria collection: one lesson per chapter of its investigation, using every event and claim in that chapter.",
  difficulty: "Medium",
  icon: "checked",
  review: "source_checked",
  lessons: inv.chapters.map((c, i) => {
    const events = chapterEvents(c.id);
    const period = periodOf(events[0]?.when.start ?? "");
    const prev = i > 0 ? periodOf(chapterEvents(inv.chapters[i - 1].id)[0]?.when.start ?? "") : undefined;
    return {
      id: `austria-${c.id.replace(/^ch-/, "")}`,
      title: c.title.en,
      minutes: 2 + Math.ceil(events.length / 2),
      skills: ["chronology", "geography", "evidence"] as Skill[],
      milestone: period && period.id !== prev?.id ? period.label.en : undefined,
    };
  }),
};

function checkedLesson(id: string): Lesson | null {
  const chapter = inv.chapters.find((c) => `austria-${c.id.replace(/^ch-/, "")}` === id);
  if (!chapter) return null;
  const events = chapterEvents(chapter.id);
  const seed = hash(id);
  const cards: LearnCard[] = events.map((e) => {
    const p = e.placeId ? placeById.get(e.placeId) : undefined;
    return {
      id: e.id,
      title: e.title.en,
      when: formatWhen(e.when),
      year: yearOf(e.when.start),
      where: p ? p.label.en : e.noPlaceReason ? "No single location" : undefined,
      point: p ? [p.lng, p.lat] : undefined,
      summary: e.summary.en,
      claims: claimsFor(e.id).map((c) => ({
        text: c.statement.en,
        support: SUPPORT_LABELS[c.support].label,
        supportHelp: SUPPORT_LABELS[c.support].help,
        sources: c.evidence.map((ev) => ({ ...src(ev.sourceId), note: ev.passage })),
      })),
      image: e.media,
      explore: p ? `/connections?id=${p.wikidata}` : undefined,
      saveHref: `/explore?event=${e.id}`,
      entity: { id: checkedEventId(e.id), label: e.title.en, type: "event", dates: formatWhen(e.when), year: yearOf(e.when.start), description: e.summary.en, source: firstSources(e.id)[0] },
      place: p ? { id: p.wikidata, label: p.label.en, type: "place", description: `${p.region}, in today's ${countryName(p.modernCountry)}`, source: { label: `Wikidata ${p.wikidata}`, url: wikidataUrl(p.wikidata) } } : undefined,
      people: e.people.map((name) => ({ name, entity: personId(name) ? { id: personId(name)!, label: name, type: "person" as const, source: { label: `Wikidata ${personId(name)}`, url: wikidataUrl(personId(name)!) } } : undefined })),
    };
  });
  const edges: Edge[] = cards.flatMap((c) => {
    const src = c.entity.source ?? { label: "TIMEWISE checked collection", url: "" };
    return [
      ...(c.place ? [{ from: c.entity.id, to: c.place.id, label: "took place in", source: src, date: c.when }] : []),
      ...(c.people ?? []).filter((x) => x.entity).map((x) => ({ from: x.entity!.id, to: c.entity.id, label: "is named in the record of", source: src, date: c.when })),
    ];
  });

  const activities: Activity[] = [];
  const gaps: string[] = [];
  if (events.length >= 2) {
    const items = events.slice(0, 5);
    activities.push({
      kind: "order",
      skill: "chronology",
      prompt: "Put these in order, earliest first.",
      items: items.map((e) => ({ id: e.id, label: e.title.en, when: formatWhen(e.when) })),
      explanation: items.map((e) => `${e.title.en}: ${formatWhen(e.when)}`).join(". ") + ".",
      sources: items.flatMap((e) => firstSources(e.id).slice(0, 1)),
    });
  }
  const placed = events.filter((e) => e.placeId);
  if (placed.length) {
    const e = placed[seed % placed.length];
    const p = placeById.get(e.placeId!)!;
    const others = shuffle(collection.places.filter((x) => x.id !== p.id && !events.some((y) => y.placeId === x.id)), seed).slice(0, 3);
    const options = shuffle([p, ...others], seed + 1);
    activities.push({
      kind: "choice",
      skill: "geography",
      prompt: `Where did this take place: ${e.title.en}?`,
      options: options.map((o) => ({ id: o.id, label: o.label.en })),
      answer: p.id,
      explanation: `${e.title.en} is placed at ${p.label.en} (${p.region}, in today's ${countryName(p.modernCountry)}).${e.placeNote ? ` ${e.placeNote}` : ""}`,
      sources: firstSources(e.id),
      map: options.map((o) => ({ label: o.label.en, lng: o.lng, lat: o.lat, answer: o.id === p.id })),
    });
  } else gaps.push("None of these events has a single location, so there's no map question.");

  const claims = events.flatMap((e) => claimsFor(e.id));
  const sourced = claims.filter((c) => c.evidence.length);
  if (sourced.length) {
    const c = sourced[(seed >>> 3) % sourced.length];
    const right = c.evidence[0].sourceId;
    const others = shuffle(collection.sources.filter((s) => !c.evidence.some((e) => e.sourceId === s.id) && s.provider !== sourceById.get(right)!.provider), seed + 2).slice(0, 2);
    const options = shuffle([sourceById.get(right)!, ...others], seed + 3);
    activities.push({
      kind: "choice",
      skill: "evidence",
      prompt: "Which source supports this statement?",
      context: c.statement.en,
      options: options.map((s) => ({ id: s.id, label: `${s.title} (${s.provider})` })),
      answer: right,
      explanation: `${sourceById.get(right)!.title}: ${c.evidence[0].passage}`,
      sources: [src(right)],
    });
  }
  // How firmly is it known? Prefer a claim that isn't a plain reference statement.
  const judged = claims.find((c) => c.support !== "reference") ?? claims[seed % Math.max(claims.length, 1)];
  if (judged) {
    const options = ESTABLISH_OPTIONS.map((o) => ({ id: o.status, label: o.text }));
    activities.push({
      kind: "choice",
      skill: "evidence",
      prompt: judged.support === "disputed" ? "Accounts of this differ. What does the evidence establish?" : "What does the evidence establish?",
      context: `${judged.statement.en} Its source: ${judged.evidence.map((e) => e.passage).join(" ")}`,
      options,
      answer: judged.support,
      explanation: `It's recorded as "${SUPPORT_LABELS[judged.support].label}": ${SUPPORT_LABELS[judged.support].help}`,
      sources: judged.evidence.map((e) => src(e.sourceId)),
    });
  }
  // Where does one of this chapter's events sit among others from the collection?
  if (events.length) {
    const t = events[(seed >>> 5) % events.length];
    const others = eventsByDate.filter((e) => e.id !== t.id && e.when.start.slice(0, 4) !== t.when.start.slice(0, 4));
    const step = Math.max(1, Math.floor(others.length / 4));
    const anchors = [0, 1, 2, 3].map((i) => others[Math.min(others.length - 1, i * step + ((seed >>> 2) % step))]).filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a.when.start.localeCompare(b.when.start));
    const slot = anchors.filter((a) => a.when.start < t.when.start).length;
    activities.push({
      kind: "timeline", skill: "chronology",
      prompt: "Where on the timeline does this belong?",
      target: t.title.en,
      anchors: anchors.map((a) => ({ id: a.id, label: a.title.en, when: formatWhen(a.when) })),
      answer: slot,
      explanation: `${t.title.en}: ${formatWhen(t.when)}. ${anchors.map((a) => `${a.title.en}: ${formatWhen(a.when)}`).join(". ")}.`,
      sources: [...firstSources(t.id).slice(0, 1), ...anchors.flatMap((a) => firstSources(a.id).slice(0, 1))],
    });
  }
  // A person the collection names for an event, against people named for other events.
  const withPeople = events.filter((e) => e.people.length);
  if (withPeople.length) {
    const e = withPeople[seed % withPeople.length];
    const person = e.people[0];
    const decoys = [...new Set(collection.events.filter((x) => !x.people.includes(person) && x.id !== e.id).flatMap((x) => x.people))].slice(0, 3);
    if (decoys.length >= 2) {
      activities.push({
        kind: "choice", skill: "people",
        prompt: `Who is connected to this: ${e.title.en}?`,
        options: shuffle([person, ...decoys], seed + 9).map((n) => ({ id: n, label: n })),
        answer: person,
        explanation: `The checked collection names ${person} for ${e.title.en} (${formatWhen(e.when)}). The others are named for different events.`,
        sources: firstSources(e.id),
      });
    }
  }
  gaps.push("The checked collection doesn't record causes and effects yet, so this lesson has no cause-and-consequence question.");

  const index = CHECKED_PATH.lessons.findIndex((l) => l.id === id);
  return {
    id,
    pathId: CHECKED_PATH.id,
    title: chapter.title.en,
    question: inv.question.en,
    intro: chapter.intro.en,
    minutes: CHECKED_PATH.lessons[index].minutes,
    review: "source_checked",
    cards,
    activities,
    gaps,
    edges,
    related: [
      ...placed.slice(0, 2).map((e) => ({ label: `Explore connections of ${placeById.get(e.placeId!)!.label.en}`, href: `/connections?id=${placeById.get(e.placeId!)!.wikidata}` })),
      { label: "Follow the guided story", href: "/journeys/austria-1848-1921" },
    ],
  };
}

// ---------------------------------------------------------------- generated journeys
//
// Built from imported Wikidata records by fixed rules. journey-catalog.json (written by
// scripts/journey_catalog.py) lists only the journeys with enough records. Every lesson says how its
// records were chosen, and is labelled imported, not checked by hand.

export const centuryName = (c: number) => `${c * 100}s`;
const CONTINENTS = Object.keys(CONTINENT_LABELS);
const TOPIC_LABEL: Record<string, string> = { war: "Wars and battles", politics: "Politics", culture: "Culture and institutions", state: "States and empires" };
const IMPORTED_SKILLS: Skill[] = ["chronology", "geography", "evidence", "cause"];
const REGION_CATALOG = catalog.region as Record<string, number[]>;
const TOPIC_CATALOG = catalog.topic as Record<string, number[]>;
const PLACE_CATALOG = catalog.place as Record<string, { label: string; continent?: string; eras: string[] }>;
export const ERAS: { id: string; label: string; from: number; to: number }[] = [
  { id: "antiquity", label: "Antiquity", from: -3500, to: 499 },
  { id: "middle-ages", label: "Middle Ages", from: 500, to: 1499 },
  { id: "early-modern", label: "1500–1800", from: 1500, to: 1799 },
  { id: "long-19th", label: "1800–1914", from: 1800, to: 1913 },
  { id: "world-wars", label: "1914–1945", from: 1914, to: 1945 },
  { id: "since-1945", label: "Since 1945", from: 1946, to: 2026 },
];
const eraById = (id: string) => ERAS.find((e) => e.id === id);
/** One colour per era, used the same way on every timeline, recap and path; always shown with the era's name. */
export const ERA_COLOR: Record<string, string> = { antiquity: "#7a5c99", "middle-ages": "#2f6f8f", "early-modern": "#3d7f4e", "long-19th": "#a8642a", "world-wars": "#9b2f2f", "since-1945": "#56607a" };
export const eraOf = (year?: number) => (year === undefined ? undefined : ERAS.find((e) => year >= e.from && year <= e.to) ?? (year < ERAS[0].from ? ERAS[0] : ERAS[ERAS.length - 1]));
/** Countries with a path, and those without enough records for one. */
export const PLACE_PATHS = PLACE_CATALOG;

const stub = (id: string, title: string, skills = IMPORTED_SKILLS): LessonStub => ({ id, title, minutes: 3, skills });
const regionPath = (ct: string, centuries: number[]): PathDef => ({
  id: `region-${ct}`, kind: "region", review: "imported", difficulty: "Easy", icon: "map",
  title: `${CONTINENT_LABELS[ct]} through the centuries`,
  blurb: "One short lesson per century.",
  why: "Each lesson takes the four records of that century and continent written about in the most Wikipedia languages, from four different countries, each with a year or exact date and a Wikidata description.",
  lessons: centuries.map((c) => stub(`w-${ct}-${c}`, `${CONTINENT_LABELS[ct]} in the ${centuryName(c)}`)),
});
const periodPath = (c: number): PathDef => ({
  id: `period-${c}`, kind: "period", review: "imported", difficulty: "Easy", icon: "timeline",
  title: `The ${centuryName(c)} around the world`,
  blurb: "One lesson per continent.",
  why: `Each lesson takes the four records of the ${centuryName(c)} on one continent written about in the most Wikipedia languages, from four different countries.`,
  lessons: CONTINENTS.filter((ct) => REGION_CATALOG[ct]?.includes(c)).map((ct) => stub(`w-${ct}-${c}`, `${CONTINENT_LABELS[ct]} in the ${centuryName(c)}`)),
});
const topicPath = (key: string, centuries: number[]): PathDef => {
  const cut = key.indexOf("-");
  const topic = key.slice(0, cut);
  const ct = key.slice(cut + 1);
  return {
    id: `topic-${key}`, kind: "topic", review: "imported", difficulty: "Medium", icon: topic as IconKey,
    title: `${TOPIC_LABEL[topic]} in ${CONTINENT_LABELS[ct]}`,
    blurb: "One lesson per century.",
    why: `Each lesson takes the four records filed under "${TOPIC_LABEL[topic].toLowerCase()}" in that century and continent, written about in the most Wikipedia languages, from four different countries.`,
    lessons: centuries.map((c) => stub(`t-${topic}-${ct}-${c}`, `${TOPIC_LABEL[topic]}, ${CONTINENT_LABELS[ct]}, ${centuryName(c)}`)),
  };
};
const placePath = (country: string, label: string, eras: string[]): PathDef => ({
  id: `place-${country}`, kind: "place", review: "imported", difficulty: eras.length > 3 ? "Medium" : "Easy", icon: "place",
  title: eras.length > 1 ? `${label}: ${eraById(eras[0])!.label} to ${eraById(eras[eras.length - 1])!.label.replace("Since 1945", "today")}` : `${label}: ${eraById(eras[0])!.label}`,
  blurb: `${eras.length} stage${eras.length > 1 ? "s" : ""}, one lesson each, inside today's ${label}.`,
  why: `Each stage takes the four records located inside today's ${label} in that era, written about in the most Wikipedia languages. Today's borders are used only to sort records.`,
  lessons: eras.map((e, i) => ({ ...stub(`p-${country}-${e}`, `${label}, ${eraById(e)!.label}`, ["chronology", "evidence", "people", "cause"] as Skill[]), milestone: `Stage ${i + 1}, ${eraById(e)!.label}` })),
});

export const PATHS: PathDef[] = [
  CHECKED_PATH,
  ...Object.entries(REGION_CATALOG).map(([ct, cs]) => regionPath(ct, cs)),
  ...Object.entries(TOPIC_CATALOG).map(([k, cs]) => topicPath(k, cs)),
  ...Object.entries(PLACE_CATALOG).map(([k, v]) => placePath(k, v.label, v.eras)),
  ...[17, 18, 19].map(periodPath),
];
export const pathById = (id: string) => PATHS.find((p) => p.id === id);
/** The continent a journey is about, when it is about one place; the checked journey is Austria, in Europe. */
export const continentOfPath = (id: string) => (id === CHECKED_PATH.id ? "europe" : id.startsWith("place-") ? PLACE_CATALOG[id.slice(6)]?.continent ?? null : null);

type RegionEvent = { id: string; title: { en?: string; de?: string }; description?: string; category: string; start: string; end?: string; precision: Precision; lng?: number; lat?: number; links: number; home?: string; multi?: boolean; inside?: boolean; url: string };
const fileCache = new Map<string, Promise<RegionEvent[]>>();
function loadRegionFile(id: string) {
  if (!fileCache.has(id)) {
    fileCache.set(id, fetch(asset(`/data/regions/${id}.json`)).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${id} ${r.status}`)))).then((d: { events: RegionEvent[] }) => d.events));
    fileCache.get(id)!.catch(() => fileCache.delete(id));
  }
  return fileCache.get(id)!;
}

/**
 * Four records of one century: well documented, dated to the year or better, with a description.
 * From four different countries, unless `sameCountry` (place journeys), where they must lie inside it.
 */
export function pickEvents(events: RegionEvent[], when: number | [number, number], n = 4, opts: { category?: string; sameCountry?: boolean } = {}): RegionEvent[] {
  const [lo, hi] = typeof when === "number" ? [when * 100, when * 100 + 99] : when;
  const precisions = opts.sameCountry ? ["day", "month", "year", "decade"] : ["day", "month", "year"];
  const eligible = events
    .filter((e) => e.title.en && e.description && e.description.length >= 20 && e.home && !e.multi && e.lng !== undefined && precisions.includes(e.precision) && (opts.sameCountry || !e.start.startsWith("-")))
    .filter((e) => yearOf(e.start) >= lo && yearOf(e.start) <= hi && (!opts.category || e.category === opts.category) && (!opts.sameCountry || e.inside))
    .sort((a, b) => b.links - a.links);
  const out: RegionEvent[] = [];
  for (const e of eligible) {
    if (out.some((o) => (!opts.sameCountry && o.home === e.home) || o.description === e.description || o.title.en === e.title.en)) continue;
    out.push(e);
    if (out.length === n) break;
  }
  return out;
}

type Spec = { file: string; century: number | [number, number]; title: string; why: string; category?: string; sameCountry?: boolean; overview: { label: string; href: string } };
/** What a generated lesson id means: which data file, which century, which filter, and why. */
export function parseLesson(id: string): Spec | null {
  let m = id.match(/^w-([a-z_]+)-(\d+)$/);
  if (m && CONTINENT_LABELS[m[1]]) {
    const c = Number(m[2]);
    const name = CONTINENT_LABELS[m[1]];
    return { file: m[1], century: c, title: `${name} in the ${centuryName(c)}`, why: `the four records from ${name} in the ${centuryName(c)} written about in the most Wikipedia languages, each from a different country`, overview: { label: `Open the ${name} overview`, href: `/history/${m[1]}` } };
  }
  m = id.match(/^t-([a-z]+)-([a-z_]+)-(\d+)$/);
  if (m && TOPIC_LABEL[m[1]] && CONTINENT_LABELS[m[2]]) {
    const c = Number(m[3]);
    const name = CONTINENT_LABELS[m[2]];
    return { file: m[2], century: c, category: m[1], title: `${TOPIC_LABEL[m[1]]}, ${name}, ${centuryName(c)}`, why: `the four records filed under "${TOPIC_LABEL[m[1]].toLowerCase()}" from ${name} in the ${centuryName(c)} written about in the most Wikipedia languages, each from a different country`, overview: { label: `Open the ${name} map`, href: `/atlas/${m[2]}?cat=${m[1]}` } };
  }
  m = id.match(/^p-([a-z_]+)-([a-z0-9-]+)$/);
  const place = m ? PLACE_CATALOG[m[1]] : undefined;
  const era = m ? eraById(m[2]) : undefined;
  if (m && place && era) {
    return { file: m[1], century: [era.from, era.to], sameCountry: true, title: `${place.label}, ${era.label}`, why: `the four records located inside today's ${place.label} in ${era.label === "Since 1945" ? "the years since 1945" : era.label} written about in the most Wikipedia languages`, overview: { label: `Open the ${place.label} map`, href: `/atlas/${m[1]}?from=${era.from}&to=${era.to}` } };
  }
  return null;
}

async function importedLesson(id: string, pathId: string, signal?: AbortSignal): Promise<Lesson | null> {
  const spec = parseLesson(id);
  if (!spec) return null;
  const [events, regions] = await Promise.all([loadRegionFile(spec.file), loadRegions()]);
  const country = (k?: string) => regions.find((r) => r.id === k)?.label.en ?? k ?? "unknown";
  const picked = pickEvents(events, spec.century, 4, { category: spec.category, sameCountry: spec.sameCountry });
  const title = spec.title;
  const base = { id, pathId, title, minutes: 3, review: "imported" as const, related: [spec.overview] };
  if (picked.length < 4) {
    return { ...base, intro: "", cards: [], activities: [], edges: [], gaps: [`Fewer than four suitable records are available for ${title}, so this lesson can't be built honestly.`] };
  }
  const seed = hash(id);
  const wd = (e: RegionEvent): SourceRef => ({ label: `Wikidata: ${e.title.en}`, url: e.url });
  const when = (e: RegionEvent) => formatImportedDate(e.start, e.end, e.precision);
  const cards: LearnCard[] = picked.map((e) => ({
    id: e.id,
    title: e.title.en!,
    when: when(e),
    year: yearOf(e.start),
    where: country(e.home),
    point: [e.lng!, e.lat!],
    summary: e.description,
    summarySource: "Wikidata's short description (CC0)",
    claims: [],
    explore: `/connections?id=${e.id}`,
    saveHref: `/connections?id=${e.id}`,
    entity: { id: e.id, label: e.title.en!, type: "event", dates: when(e), year: yearOf(e.start), description: e.description, source: wd(e), qid: e.id },
    place: e.home ? { id: countryId(e.home), label: country(e.home), type: "country", description: "Present-day country, used only to sort records", source: wd(e) } : undefined,
  }));
  const edges: Edge[] = cards.filter((c) => c.place).map((c) => ({ from: c.entity.id, to: c.place!.id, label: "located in present-day", source: c.entity.source!, date: c.when }));
  const byDate = [...picked].sort((a, b) => a.start.localeCompare(b.start));
  const activities: Activity[] = [
    {
      kind: "order",
      skill: "chronology",
      prompt: "Put these in order, earliest first.",
      items: byDate.map((e) => ({ id: e.id, label: e.title.en!, when: when(e) })),
      explanation: byDate.map((e) => `${e.title.en}: ${when(e)}`).join(". ") + ". Dates are Wikidata's.",
      sources: byDate.map(wd),
    },
  ];
  if (!spec.sameCountry) {
    const g = picked[seed % 4];
    activities.push({
      kind: "choice",
      skill: "geography",
      prompt: `Where did this take place: ${g.title.en}?`,
      options: shuffle(picked, seed).map((e) => ({ id: e.home!, label: country(e.home) })),
      answer: g.home!,
      explanation: `Wikidata gives its location as ${g.lat!.toFixed(2)}°, ${g.lng!.toFixed(2)}°, which TIMEWISE files under today's ${country(g.home)}. Borders then weren't today's.`,
      sources: [wd(g)],
      map: picked.map((e) => ({ label: country(e.home), lng: e.lng!, lat: e.lat!, answer: e.id === g.id })),
    });
  }
  const r = picked[(seed >>> 2) % 4];
  activities.push({
    kind: "choice",
    skill: "evidence",
    prompt: "Which record does Wikidata describe like this?",
    context: `"${r.description}"`,
    options: shuffle(picked, seed + 5).map((e) => ({ id: e.id, label: e.title.en! })),
    answer: r.id,
    explanation: `That's Wikidata's own short description of ${r.title.en}. Descriptions are written by Wikidata's volunteers and are not checked by TIMEWISE.`,
    sources: [wd(r)],
  });

  // Where on the timeline: the latest-but-one record placed among the other three.
  {
    const t = byDate[(seed >>> 3) % byDate.length];
    const anchors = byDate.filter((x) => x.id !== t.id);
    activities.push({
      kind: "timeline", skill: "chronology",
      prompt: "Where on the timeline does this belong?",
      target: t.title.en!,
      anchors: anchors.map((a) => ({ id: a.id, label: a.title.en!, when: when(a) })),
      answer: anchors.filter((a) => a.start < t.start).length,
      explanation: `${t.title.en}: ${when(t)}. The others: ${anchors.map((a) => `${a.title.en}, ${when(a)}`).join("; ")}. Dates are Wikidata's.`,
      sources: [wd(t)],
    });
  }

  // Documented statements of the records: causes and effects, and the people involved.
  const gaps: string[] = [];
  /** Entities a statement brought in that aren't cards: a cause, an effect, a person. */
  const linked: Entity[] = [];
  if (spec.sameCountry) gaps.push("All four records are in one country, so there's no geography question.");
  const records = await Promise.allSettled(picked.slice(0, 3).map((e) => fetchRecord(e.id, signal)));
  if (signal?.aborted) throw new DOMException("aborted", "AbortError");
  const ok = records.map((r, i) => (r.status === "fulfilled" ? { e: picked[i], rec: r.value } : null)).filter(Boolean) as { e: RegionEvent; rec: Awaited<ReturnType<typeof fetchRecord>> }[];
  if (!ok.length) gaps.push("Wikidata couldn't be reached, so the cause and people questions were left out.");

  const causal = ok.map(({ e, rec }) => ({ e, rec, link: rec.links.find((l) => l.documented && ["caused by", "led to", "immediate cause"].includes(l.relation)) })).find((x) => x.link);
  if (causal) {
    const { e, rec, link } = causal as { e: RegionEvent; rec: (typeof ok)[number]["rec"]; link: NonNullable<(typeof causal)["link"]> };
    const decoys = picked.filter((x) => x.id !== e.id && !rec.links.some((l) => l.target === x.id)).slice(0, 3);
    activities.push({
      kind: "choice",
      skill: "cause",
      prompt: link.relation === "led to" ? `Which of these does Wikidata say ${e.title.en} led to?` : `Which of these does Wikidata list as a cause of ${e.title.en}?`,
      options: shuffle([{ id: link.target, label: link.label }, ...decoys.map((d) => ({ id: d.id, label: d.title.en! }))], seed + 7),
      answer: link.target,
      explanation: `A Wikidata statement links ${e.title.en} to ${link.label} as "${link.relation}". ${link.references ? `It gives ${link.references} reference${link.references > 1 ? "s" : ""}.` : "It gives no reference, so treat it with care."} The other options are records from this lesson that no statement connects this way.`,
      sources: [{ label: "The statement on Wikidata", url: `https://www.wikidata.org/wiki/${link.statementOn}#${link.prop}` }],
      note: "A documented link in crowd-edited data, not a TIMEWISE judgement.",
    });
    const stmt = { label: "Wikidata statement", url: `https://www.wikidata.org/wiki/${link.statementOn}#${link.prop}` };
    edges.push(link.relation === "led to" ? { from: e.id, to: link.target, label: "led to", source: stmt } : { from: link.target, to: e.id, label: "led to", source: stmt });
    linked.push({ id: link.target, label: link.label, type: "event", source: { label: `Wikidata ${link.target}`, url: wikidataUrl(link.target) }, qid: link.target });
  } else if (ok.length) gaps.push("Wikidata records no causes or effects for these records, so there's no cause-and-consequence question.");

  // People: a human Wikidata records as taking part in, founding, creating or leading one record, against
  // humans recorded for the other records.
  const PEOPLE = ["participant", "winner", "founded by", "discoverer or inventor", "creator", "author", "chairperson", "head of state"];
  const candidates = ok.flatMap(({ e, rec }) => rec.links.filter((l) => l.documented && l.group === "people" && PEOPLE.includes(l.relation)).map((l) => ({ e, l })));
  if (candidates.length) {
    const facts = await fetchNodeFacts([...new Set(candidates.map((c) => c.l.target))], signal).catch(() => ({} as Record<string, { human?: boolean }>));
    const humans = candidates.filter((c) => facts[c.l.target]?.human);
    const q = humans[0];
    const decoys = q ? [...new Map(humans.filter((h) => h.e.id !== q.e.id && h.l.target !== q.l.target).map((h) => [h.l.target, h.l])).values()].slice(0, 3) : [];
    if (q && decoys.length >= 2) {
      activities.push({
        kind: "choice",
        skill: "people",
        prompt: `Who does Wikidata record as "${q.l.relation}" for ${q.e.title.en}?`,
        options: shuffle([{ id: q.l.target, label: q.l.label }, ...decoys.map((d) => ({ id: d.target, label: d.label }))], seed + 11),
        answer: q.l.target,
        explanation: `A Wikidata statement names ${q.l.label} as "${q.l.relation}" for ${q.e.title.en}. The others are recorded for other events in this lesson.`,
        sources: [{ label: "The statement on Wikidata", url: `https://www.wikidata.org/wiki/${q.l.statementOn}#${q.l.prop}` }],
        note: "A documented link in crowd-edited data, not a TIMEWISE judgement.",
      });
      const VERB: Record<string, string> = { participant: "participated in", winner: "won", "founded by": "founded", "discoverer or inventor": "discovered or invented", creator: "created", author: "wrote", chairperson: "chaired", "head of state": "was head of state of" };
      edges.push({ from: q.l.target, to: q.e.id, label: VERB[q.l.relation] ?? q.l.relation, source: { label: "Wikidata statement", url: `https://www.wikidata.org/wiki/${q.l.statementOn}#${q.l.prop}` } });
      linked.push({ id: q.l.target, label: q.l.label, type: "person", source: { label: `Wikidata ${q.l.target}`, url: wikidataUrl(q.l.target) }, qid: q.l.target });
    } else gaps.push("Not enough people are recorded for these events to ask a fair people question.");
  } else if (ok.length) gaps.push("Wikidata records no people for these events, so there's no people question.");

  return {
    ...base,
    intro: `Assembled automatically from ${spec.why}. Imported from Wikidata, not checked by hand; "written about in more languages" favours famous topics.`,
    cards,
    activities,
    gaps,
    edges,
    extra: linked,
    related: [...base.related, ...picked.slice(0, 2).map((e) => ({ label: `Explore connections of ${e.title.en}`, href: `/connections?id=${e.id}` }))],
  };
}

export async function loadLesson(id: string, pathId?: string, signal?: AbortSignal): Promise<Lesson | null> {
  if (id.startsWith("austria-")) return checkedLesson(id);
  return importedLesson(id, pathId ?? PATHS.find((p) => p.lessons.some((l) => l.id === id))?.id ?? "", signal);
}
export const checkedLessonSync = checkedLesson;

/** The lesson after this one in its path, if any. */
export function nextInPath(pathId: string, lessonId: string): LessonStub | undefined {
  const path = pathById(pathId);
  const i = path?.lessons.findIndex((l) => l.id === lessonId) ?? -1;
  return i >= 0 ? path!.lessons[i + 1] : undefined;
}

export const lessonHref = (lessonId: string, pathId: string) => `/learn/lesson?id=${lessonId}&path=${pathId}`;
export const yearLabel = (y: number) => formatYear(y);
