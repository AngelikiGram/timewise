// Learning paths and their short lessons.
//
// Two kinds of path, never mixed:
// - The checked path is built from the hand-checked Austria collection. Every card and every answer comes
//   from a curated event or a sourced claim, and links to that source.
// - Region and period paths are built from imported Wikidata records (the TIMEWISE continent files), and
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
export type PathDef = { id: string; title: string; kind: "question" | "region" | "period"; blurb: string; review: Review; lessons: LessonStub[] };

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

// ---------------------------------------------------------------- imported paths

const CENTURIES = [15, 16, 17, 18, 19];
export const centuryName = (c: number) => `${c * 100}s`;
const CONTINENTS = Object.keys(CONTINENT_LABELS);

const regionPath = (ct: string): PathDef => ({
  id: `region-${ct}`,
  title: `${CONTINENT_LABELS[ct]} through five centuries`,
  kind: "region",
  blurb: `Four well-documented events per century, from imported Wikidata records. Not checked by hand.`,
  review: "imported",
  lessons: CENTURIES.map((c) => ({ id: `w-${ct}-${c}`, title: `${CONTINENT_LABELS[ct]} in the ${centuryName(c)}`, minutes: 3, skills: ["chronology", "geography", "evidence", "cause"] })),
});
const periodPath = (c: number): PathDef => ({
  id: `period-${c}`,
  title: `The ${centuryName(c)} around the world`,
  kind: "period",
  blurb: `One lesson per continent, from imported Wikidata records. Not checked by hand.`,
  review: "imported",
  lessons: CONTINENTS.map((ct) => ({ id: `w-${ct}-${c}`, title: `${CONTINENT_LABELS[ct]} in the ${centuryName(c)}`, minutes: 3, skills: ["chronology", "geography", "evidence", "cause"] })),
});

export const PATHS: PathDef[] = [CHECKED_PATH, ...CONTINENTS.map(regionPath), ...[18, 19].map(periodPath)];
export const pathById = (id: string) => PATHS.find((p) => p.id === id);

type RegionEvent = { id: string; title: { en?: string; de?: string }; description?: string; category: string; start: string; end?: string; precision: Precision; lng?: number; lat?: number; links: number; home?: string; multi?: boolean; url: string };
const continentCache = new Map<string, Promise<RegionEvent[]>>();
function loadContinent(ct: string) {
  if (!continentCache.has(ct)) {
    continentCache.set(ct, fetch(asset(`/data/regions/${ct}.json`)).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${ct} ${r.status}`)))).then((d: { events: RegionEvent[] }) => d.events));
    continentCache.get(ct)!.catch(() => continentCache.delete(ct));
  }
  return continentCache.get(ct)!;
}

/** Four events of one century: well documented, dated to the year or better, each from a different country. */
export function pickEvents(events: RegionEvent[], century: number, n = 4): RegionEvent[] {
  const eligible = events
    .filter((e) => e.title.en && e.description && e.description.length >= 20 && e.home && !e.multi && e.lng !== undefined && ["day", "month", "year"].includes(e.precision) && !e.start.startsWith("-"))
    .filter((e) => Math.floor(yearOf(e.start) / 100) === century)
    .sort((a, b) => b.links - a.links);
  const out: RegionEvent[] = [];
  for (const e of eligible) {
    if (out.some((o) => o.home === e.home || o.description === e.description || o.title.en === e.title.en)) continue;
    out.push(e);
    if (out.length === n) break;
  }
  return out;
}

async function importedLesson(id: string, pathId: string, signal?: AbortSignal): Promise<Lesson | null> {
  const m = id.match(/^w-([a-z_]+)-(\d+)$/);
  if (!m || !CONTINENT_LABELS[m[1]]) return null;
  const [, ct, cs] = m;
  const century = Number(cs);
  const [events, regions] = await Promise.all([loadContinent(ct), loadRegions()]);
  const country = (k?: string) => regions.find((r) => r.id === k)?.label.en ?? k ?? "unknown";
  const picked = pickEvents(events, century);
  const title = `${CONTINENT_LABELS[ct]} in the ${centuryName(century)}`;
  const base = { id, pathId, title, minutes: 3, review: "imported" as const, related: [{ label: `Open the ${CONTINENT_LABELS[ct]} overview`, href: `/history/${ct}` }] };
  if (picked.length < 4) {
    return { ...base, intro: "", cards: [], activities: [], gaps: [`Fewer than four well-documented, dated records from different countries are available for ${title.toLowerCase()}, so this lesson can't be built honestly.`] };
  }
  const seed = hash(id);
  const wd = (e: RegionEvent): SourceRef => ({ label: `Wikidata: ${e.title.en}`, url: e.url });
  const when = (e: RegionEvent) => formatImportedDate(e.start, e.end, e.precision);
  const cards: LearnCard[] = picked.map((e) => ({
    id: e.id,
    title: e.title.en!,
    when: when(e),
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
  const g = picked[seed % 4];
  activities.push({
    kind: "choice",
    skill: "geography",
    prompt: `Where did this take place: ${g.title.en}?`,
    options: shuffle(picked, seed).map((e) => ({ id: e.home!, label: country(e.home) })),
    answer: g.home!,
    explanation: `Wikidata gives its location as ${g.lat!.toFixed(2)}°, ${g.lng!.toFixed(2)}°, which TIMEWISE files under ${country(g.home)}. Borders then weren't today's.`,
    sources: [wd(g)],
    map: picked.map((e) => ({ label: country(e.home), lng: e.lng!, lat: e.lat!, answer: e.id === g.id })),
  });
  const r = picked[(seed >>> 2) % 4];
  activities.push({
    kind: "choice",
    skill: "evidence",
    prompt: "Which record does Wikidata describe like this?",
    context: `“${r.description}”`,
    options: shuffle(picked, seed + 5).map((e) => ({ id: e.id, label: e.title.en! })),
    answer: r.id,
    explanation: `That's Wikidata's own short description of ${r.title.en}. Descriptions are written by Wikidata's volunteers and are not checked by TIMEWISE.`,
    sources: [wd(r)],
  });

  // Cause and consequence: only from a documented Wikidata statement.
  const gaps: string[] = [];
  let found = false;
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
        explanation: `A Wikidata statement links ${e.title.en} to ${link.label} as "${link.relation}". ${link.references ? `It gives ${link.references} reference${link.references > 1 ? "s" : ""}.` : "It gives no reference, so treat it with care."} The other options are events from this lesson that no statement connects this way.`,
        sources: [{ label: `The statement on Wikidata`, url: `https://www.wikidata.org/wiki/${link.statementOn}#${link.prop}` }],
        note: "A documented link in crowd-edited data, not a TIMEWISE judgement.",
      });
      found = true;
      break;
    } catch (err) {
      if ((err as Error).name === "AbortError") throw err;
      gaps.push("Wikidata couldn't be reached, so the cause-and-consequence question was left out.");
      break;
    }
  }
  if (!found && !gaps.length) gaps.push("Wikidata records no causes or effects for these events, so there's no cause-and-consequence question.");

  return {
    ...base,
    intro: `Four of the best-documented events from ${title.replace(" in the ", " in the ")}, each from a different country. They're imported from Wikidata and not checked by hand, and "best-documented" favours famous topics.`,
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
