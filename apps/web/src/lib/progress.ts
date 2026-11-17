"use client";

// Personal progress, kept in this browser only. There are no accounts yet, so nothing here leaves the
// device, and clearing site data or switching browsers starts afresh. Readers must cope with it empty.
import { useSyncExternalStore } from "react";
import { edgeKey, type Edge, type Entity } from "./entities";

export type SavedItem = {
  /** Wikidata QID for imported events, the curated id for checked ones. */
  id: string;
  title: string;
  /** Where it opens: an atlas link or a story step. */
  href: string;
  start?: string;
  context?: string;
  savedAt: string;
};

export type Collection = { id: string; name: string; itemIds: string[]; createdAt: string };
/** step: the step within the chapter (as in the URL); done: steps reached in the whole story. */
export type StoryProgress = { chapterId: string; step: number; done?: number; finished: boolean; updatedAt: string; visited: string[] };
export type ChallengeResult = { id: string; score: number; max: number; at: string; mode: "challenge" | "practice"; xp: number };
/** Something answered wrongly, to come back to. Lesson mistakes keep the question, so it can be asked again. */
export type Mistake = { challengeId: string; prompt: string; correct: string; at: string; activity?: unknown; skill?: string; box?: number; due?: string };
/**
 * An entity in the learner's own atlas. The four states are kept apart on purpose: seeing a name is not
 * the same as opening it, saving it, or using it in an exercise.
 */
export type AtlasNode = Entity & { encountered?: string; explored?: string; saved?: string; practised?: string; lessons: string[] };
export type AtlasEdge = Edge & { lessons: string[]; at: string };
/** A lesson's state: where the reader is, and how the last finished attempt went. */
export type LessonProgress = { step: number; steps: number; finished: boolean; score?: number; max?: number; updatedAt: string; title: string; pathId: string };
/** One answer, for skill progress. */
export type SkillEntry = { skill: string; ok: boolean; at: string };

export type Progress = {
  bookmarks: Record<string, SavedItem>;
  notes: Record<string, { text: string; title: string; href: string; updatedAt: string }>;
  collections: Collection[];
  stories: Record<string, StoryProgress>;
  results: ChallengeResult[];
  mistakes: Mistake[];
  /** Places and regions opened, for "explored". */
  explored: Record<string, { label: string; href: string; at: string }>;
  lessons: Record<string, LessonProgress>;
  skills: SkillEntry[];
  /** Days (YYYY-MM-DD, local) with any lesson activity. Only used to show activity, never to take anything away. */
  days: string[];
  /** Lessons a day the reader would like to do; optional, 0 means no goal. */
  goal?: number;
  /** Themes and places the reader chose, used to suggest paths. */
  interests?: string[];
  /** Profile settings. Shareable only means a link can be made; nothing is uploaded. */
  profile?: { name?: string; shareable: boolean };
  /** The learner's history atlas: entities met and the sourced edges between them. */
  atlas?: { nodes: Record<string, AtlasNode>; edges: Record<string, AtlasEdge> };
  /** Review answers, kept apart from atlas size: more nodes isn't more knowledge. */
  reviewLog?: { ok: number; total: number };
};

const KEY = "tw-progress-v1";
const EMPTY: Progress = { bookmarks: {}, notes: {}, collections: [], stories: {}, results: [], mistakes: [], explored: {}, lessons: {}, skills: [], days: [] };

let cache: Progress | null = null;
const listeners = new Set<() => void>();

function read(): Progress {
  if (cache) return cache;
  try {
    cache = { ...EMPTY, ...(JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Progress>) };
  } catch {
    cache = EMPTY;
  }
  return cache;
}

function write(next: Progress) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private windows and full storage: keep it for this visit only.
  }
  listeners.forEach((l) => l());
}

/** The saved progress, read now (for effects that run before the hook has the stored value). */
export const readProgress = () => read();

export function update(fn: (p: Progress) => Progress) {
  write(fn(read()));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** The saved progress, or the empty state during the server render and the first client render. */
export function useProgress(): Progress {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

const now = () => new Date().toISOString();

export function toggleBookmark(item: Omit<SavedItem, "savedAt">) {
  update((p) => {
    const bookmarks = { ...p.bookmarks };
    if (bookmarks[item.id]) delete bookmarks[item.id];
    else bookmarks[item.id] = { ...item, savedAt: now() };
    return { ...p, bookmarks };
  });
}

export function saveNote(id: string, title: string, href: string, text: string) {
  update((p) => {
    const notes = { ...p.notes };
    if (text.trim()) notes[id] = { text, title, href, updatedAt: now() };
    else delete notes[id];
    return { ...p, notes };
  });
}

export function createCollection(name: string, itemIds: string[] = []): string {
  const id = `c${Date.now().toString(36)}`;
  update((p) => ({ ...p, collections: [...p.collections, { id, name: name.trim() || "Untitled", itemIds, createdAt: now() }] }));
  return id;
}

export function setInCollection(collectionId: string, itemId: string, on: boolean) {
  update((p) => ({
    ...p,
    collections: p.collections.map((c) =>
      c.id !== collectionId ? c : { ...c, itemIds: on ? [...new Set([...c.itemIds, itemId])] : c.itemIds.filter((i) => i !== itemId) },
    ),
  }));
}

export function renameCollection(collectionId: string, name: string) {
  update((p) => ({ ...p, collections: p.collections.map((c) => (c.id === collectionId ? { ...c, name: name.trim() || c.name } : c)) }));
}

export function deleteCollection(collectionId: string) {
  update((p) => ({ ...p, collections: p.collections.filter((c) => c.id !== collectionId) }));
}

export function saveStoryStep(storyId: string, chapterId: string, step: number, finished = false, done = step) {
  update((p) => {
    const before = p.stories[storyId];
    const visited = [...new Set([...(before?.visited ?? []), chapterId])];
    const reached = Math.max(done, before?.done ?? 0);
    return { ...p, stories: { ...p.stories, [storyId]: { chapterId, step, done: reached, finished: finished || !!before?.finished, updatedAt: now(), visited } } };
  });
}

export function markExplored(id: string, label: string, href: string) {
  update((p) => (p.explored[id] ? p : { ...p, explored: { ...p.explored, [id]: { label, href, at: now() } } }));
}

/**
 * Records a finished challenge. XP is earned the first time a challenge is completed in challenge mode
 * (and once per day for the daily challenge), never for replays or practice, so it can't be farmed.
 */
export function recordResult(r: Omit<ChallengeResult, "at" | "xp">, xpFor: number, mistakes: Omit<Mistake, "at">[] = []): number {
  let earned = 0;
  update((p) => {
    const already = p.results.some((x) => x.id === r.id && x.mode === "challenge" && x.xp > 0);
    earned = r.mode === "challenge" && !already ? Math.round(xpFor * (r.score / Math.max(1, r.max))) : 0;
    const at = now();
    const keep = p.mistakes.filter((m) => !mistakes.some((n) => n.prompt === m.prompt));
    return {
      ...p,
      results: [...p.results, { ...r, at, xp: earned }].slice(-200),
      mistakes: [...keep, ...mistakes.map((m) => ({ ...m, at }))].slice(-60),
    };
  });
  return earned;
}

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const markDay = (p: Progress): Progress => (p.days.includes(today()) ? p : { ...p, days: [...p.days, today()].slice(-120) });

/** Where the reader is in a lesson, so it can be resumed. Finishing is kept once reached. */
export function saveLessonStep(id: string, info: { step: number; steps: number; title: string; pathId: string }) {
  update((p) => {
    const before = p.lessons[id];
    return markDay({ ...p, lessons: { ...p.lessons, [id]: { ...before, ...info, finished: !!before?.finished, updatedAt: now() } } });
  });
}

/** One answered question: counts towards its skill, and a wrong answer goes to review with the question. */
const INTERVAL_DAYS = [0, 1, 3, 7];
export function logAnswer(lessonId: string, skill: string, ok: boolean, review: { prompt: string; correct: string; activity: unknown }, fromReview = false) {
  update((p) => {
    const at = now();
    const was = p.mistakes.find((m) => m.prompt === review.prompt);
    const others = p.mistakes.filter((m) => m.prompt !== review.prompt);
    let mistakes = others;
    if (!ok) mistakes = [...others, { challengeId: lessonId, prompt: review.prompt, correct: review.correct, at, activity: review.activity, skill, box: 0, due: at }];
    else if (was) {
      const box = (was.box ?? 0) + 1;
      if (box < INTERVAL_DAYS.length) mistakes = [...others, { ...was, box, due: new Date(Date.now() + INTERVAL_DAYS[box] * 86400000).toISOString() }];
    }
    const log = p.reviewLog ?? { ok: 0, total: 0 };
    return markDay({
      ...p,
      skills: [...p.skills, { skill, ok, at }].slice(-600),
      mistakes: mistakes.slice(-60),
      reviewLog: fromReview ? { ok: log.ok + (ok ? 1 : 0), total: log.total + 1 } : log,
    });
  });
}
/** Questions due for review now; later ones wait for their day. */
export const dueReviews = (p: Progress, at = Date.now()) => p.mistakes.filter((m) => m.activity && (!m.due || Date.parse(m.due) <= at));

/** A finished lesson. XP is earned once per lesson, like a challenge, so replays can't farm it. */
export function finishLesson(id: string, score: number, max: number): number {
  let xp = 0;
  update((p) => {
    const before = p.lessons[id];
    const already = p.results.some((r) => r.id === `lesson:${id}` && r.xp > 0);
    xp = already ? 0 : 10 + score * 2;
    return markDay({
      ...p,
      lessons: { ...p.lessons, [id]: { ...before, step: before?.steps ?? 0, finished: true, score, max, updatedAt: now() } },
      results: [...p.results, { id: `lesson:${id}`, score, max, mode: "challenge" as const, at: now(), xp }].slice(-200),
    });
  });
  return xp;
}

export const setGoal = (goal: number) => update((p) => ({ ...p, goal }));
export const setInterests = (interests: string[]) => update((p) => ({ ...p, interests }));
export const setProfile = (profile: { name?: string; shareable: boolean }) => update((p) => ({ ...p, profile }));

/** Keep a question to try again later, whether or not it was answered correctly. */
export function queueReview(lessonId: string, review: { prompt: string; correct: string; activity: unknown; skill?: string }) {
  update((p) => (p.mistakes.some((m) => m.prompt === review.prompt) ? p : { ...p, mistakes: [...p.mistakes, { challengeId: lessonId, ...review, at: now() }].slice(-60) }));
}

// ---------------------------------------------------------------- the personal atlas

const emptyAtlas = () => ({ nodes: {} as Record<string, AtlasNode>, edges: {} as Record<string, AtlasEdge> });
const merge = (old: AtlasNode | undefined, e: Entity): AtlasNode => ({ ...e, ...Object.fromEntries(Object.entries(old ?? {}).filter(([, v]) => v !== undefined)), lessons: old?.lessons ?? [] }) as AtlasNode;

/** Entities shown in a lesson the learner viewed. Encountered only: not explored, not learned. */
export function encounterEntities(lessonId: string, entities: Entity[]) {
  update((p) => {
    const atlas = p.atlas ?? emptyAtlas();
    const nodes = { ...atlas.nodes };
    for (const e of entities) {
      const n = merge(nodes[e.id], e);
      nodes[e.id] = { ...n, encountered: n.encountered ?? now(), lessons: n.lessons.includes(lessonId) ? n.lessons : [...n.lessons, lessonId] };
    }
    return { ...p, atlas: { ...atlas, nodes } };
  });
}
/** The learner opened an entity's panel. */
export function exploreEntity(e: Entity) {
  update((p) => {
    const atlas = p.atlas ?? emptyAtlas();
    const n = merge(atlas.nodes[e.id], e);
    return { ...p, atlas: { ...atlas, nodes: { ...atlas.nodes, [e.id]: { ...n, explored: n.explored ?? now() } } } };
  });
}
export function toggleSaveEntity(e: Entity) {
  update((p) => {
    const atlas = p.atlas ?? emptyAtlas();
    const n = merge(atlas.nodes[e.id], e);
    return { ...p, atlas: { ...atlas, nodes: { ...atlas.nodes, [e.id]: { ...n, saved: n.saved ? undefined : now() } } } };
  });
}
export type AtlasGrowth = { newByType: Record<string, number>; earlier: { id: string; label: string; lessons: string[] }[]; newEdges: number };
/**
 * A finished lesson: its central entities are practised, and its sourced edges join the atlas. Returns what
 * was new, and which entities were already known from earlier lessons.
 */
export function completeLessonAtlas(lessonId: string, central: Entity[], edges: Edge[], extra: Entity[] = []): AtlasGrowth {
  const growth: AtlasGrowth = { newByType: {}, earlier: [], newEdges: 0 };
  update((p) => {
    const atlas = p.atlas ?? emptyAtlas();
    const nodes = { ...atlas.nodes };
    const at = now();
    for (const e of [...central, ...extra]) {
      const old = nodes[e.id];
      const before = (old?.lessons ?? []).filter((l) => l !== lessonId);
      if (!old?.practised && !before.length) growth.newByType[e.type] = (growth.newByType[e.type] ?? 0) + 1;
      if (before.length) growth.earlier.push({ id: e.id, label: e.label, lessons: before });
      const n = merge(old, e);
      nodes[e.id] = { ...n, encountered: n.encountered ?? at, practised: central.includes(e) ? n.practised ?? at : n.practised, lessons: n.lessons.includes(lessonId) ? n.lessons : [...n.lessons, lessonId] };
    }
    const all = { ...atlas.edges };
    for (const e of edges) {
      const k = edgeKey(e);
      if (!all[k]) growth.newEdges++;
      all[k] = { ...e, lessons: [...new Set([...(all[k]?.lessons ?? []), lessonId])], at: all[k]?.at ?? at };
    }
    return { ...p, atlas: { nodes, edges: all } };
  });
  return growth;
}

export function clearMistake(prompt: string) {
  update((p) => ({ ...p, mistakes: p.mistakes.filter((m) => m.prompt !== prompt) }));
}

export const totalXp = (p: Progress) => p.results.reduce((n, r) => n + r.xp, 0);

/** Everything, as a file the reader can keep, and back again. */
export function exportProgress(): string {
  return JSON.stringify(read(), null, 1);
}

export function importProgress(json: string) {
  const data = JSON.parse(json) as Partial<Progress>;
  if (typeof data !== "object" || !data) throw new Error("Not a TIMEWISE progress file");
  write({ ...EMPTY, ...data });
}

export function resetProgress() {
  write(EMPTY);
}
