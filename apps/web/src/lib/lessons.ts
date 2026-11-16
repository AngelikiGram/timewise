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
import { fetchRecord } from "./record";
import { CONTINENT_LABELS, loadRegions } from "./world-index";
import catalog from "./journey-catalog.json";

export type Skill = "chronology" | "geography" | "evidence" | "cause";
export const SKILLS: Record<Skill, { label: string; help: string }> = {
  chronology: { label: "Chronology", help: "Putting events in order and placing them in time." },
  geography: { label: "Geography", help: "Knowing where things happened." },
  evidence: { label: "Evidence", help: "Telling what a source says, and how firmly." },
  cause: { label: "Cause and consequence", help: "Following documented causes and effects." },
};

export type SourceRef = { label: string; url: string; note?: string };
export type Review = "source_checked" | "imported";
export type OrderItem = { id: string; label: string; when: string };
export type MapPoint = { label: string; lng: number; lat: number; answer?: boolean };
export type Activity =
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
  title: inv.question.en,
  kind: "question",
  blurb: "Six short lessons from railways to a new republic. Every statement is checked against a linked source.",
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
    };
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
const PLACE_CATALOG = catalog.place as Record<string, { label: string; centuries: number[] }>;

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
const placePath = (country: string, label: string, centuries: number[]): PathDef => ({
  id: `place-${country}`, kind: "place", review: "imported", difficulty: "Medium", icon: "place",
  title: `${label} through the centuries`,
  blurb: `One lesson per century, inside today's ${label}.`,
  why: `Each lesson takes the four records located inside today's ${label} in that century, written about in the most Wikipedia languages. Today's borders are used only to sort records.`,
  lessons: centuries.map((c) => stub(`p-${country}-${c}`, `${label} in the ${centuryName(c)}`, ["chronology", "evidence", "cause"])),
});

export const PATHS: PathDef[] = [
  CHECKED_PATH,
  ...Object.entries(REGION_CATALOG).map(([ct, cs]) => regionPath(ct, cs)),
  ...Object.entries(TOPIC_CATALOG).map(([k, cs]) => topicPath(k, cs)),
  ...Object.entries(PLACE_CATALOG).map(([k, v]) => placePath(k, v.label, v.centuries)),
  ...[17, 18, 19].map(periodPath),
];
export const pathById = (id: string) => PATHS.find((p) => p.id === id);

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
export function pickEvents(events: RegionEvent[], century: number, n = 4, opts: { category?: string; sameCountry?: boolean } = {}): RegionEvent[] {
  const eligible = events
    .filter((e) => e.title.en && e.description && e.description.length >= 20 && e.home && !e.multi && e.lng !== undefined && ["day", "month", "year"].includes(e.precision) && !e.start.startsWith("-"))
    .filter((e) => Math.floor(yearOf(e.start) / 100) === century && (!opts.category || e.category === opts.category) && (!opts.sameCountry || e.inside))
    .sort((a, b) => b.links - a.links);
  const out: RegionEvent[] = [];
  for (const e of eligible) {
    if (out.some((o) => (!opts.sameCountry && o.home === e.home) || o.description === e.description || o.title.en === e.title.en)) continue;
    out.push(e);
    if (out.length === n) break;
  }
  return out;
}

type Spec = { file: string; century: number; title: string; why: string; category?: string; sameCountry?: boolean; overview: { label: string; href: string } };
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
  m = id.match(/^p-([a-z_]+)-(\d+)$/);
  const place = m ? PLACE_CATALOG[m[1]] : undefined;
  if (m && place) {
    const c = Number(m[2]);
    return { file: m[1], century: c, sameCountry: true, title: `${place.label} in the ${centuryName(c)}`, why: `the four records located inside today's ${place.label} in the ${centuryName(c)} written about in the most Wikipedia languages`, overview: { label: `Open the ${place.label} map`, href: `/atlas/${m[1]}?from=${c * 100}&to=${c * 100 + 99}` } };
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
    return { ...base, intro: "", cards: [], activities: [], gaps: [`Fewer than four suitable records are available for ${title}, so this lesson can't be built honestly.`] };
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
  }));
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

  // Follow a documented connection: only from a Wikidata statement of cause or effect.
  const gaps: string[] = [];
  if (spec.sameCountry) gaps.push("All four records are in one country, so there's no geography question.");
  let found = false;
  let unreachable = false;
  for (const e of picked.slice(0, 2)) {
    try {
      const rec = await fetchRecord(e.id, signal);
      const link = rec.links.find((l) => l.documented && ["caused by", "led to", "immediate cause"].includes(l.relation));
      if (!link) continue;
      const decoys = picked.filter((x) => x.id !== e.id && !rec.links.some((l) => l.target === x.id)).slice(0, 3);
      const verb = link.relation === "led to" ? `Which of these does Wikidata say ${e.title.en} led to?` : `Which of these does Wikidata list as a cause of ${e.title.en}?`;
      activities.push({
        kind: "choice",
        skill: "cause",
        prompt: verb,
        options: shuffle([{ id: link.target, label: link.label }, ...decoys.map((d) => ({ id: d.id, label: d.title.en! }))], seed + 7),
        answer: link.target,
        explanation: `A Wikidata statement links ${e.title.en} to ${link.label} as "${link.relation}". ${link.references ? `It gives ${link.references} reference${link.references > 1 ? "s" : ""}.` : "It gives no reference, so treat it with care."} The other options are records from this lesson that no statement connects this way.`,
        sources: [{ label: "The statement on Wikidata", url: `https://www.wikidata.org/wiki/${link.statementOn}#${link.prop}` }],
        note: "A documented link in crowd-edited data, not a TIMEWISE judgement.",
      });
      found = true;
      break;
    } catch (err) {
      if ((err as Error).name === "AbortError") throw err;
      unreachable = true;
      gaps.push("Wikidata couldn't be reached, so the cause-and-consequence question was left out.");
      break;
    }
  }
  if (!found && !unreachable) gaps.push("Wikidata records no causes or effects for these records, so there's no cause-and-consequence question.");

  return {
    ...base,
    intro: `Assembled automatically from ${spec.why}. Imported from Wikidata, not checked by hand; "written about in more languages" favours famous topics.`,
    cards,
    activities,
    gaps,
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
