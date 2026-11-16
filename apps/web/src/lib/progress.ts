"use client";

// Personal progress, kept in this browser only. There are no accounts yet, so nothing here leaves the
// device, and clearing site data or switching browsers starts afresh. Readers must cope with it empty.
import { useSyncExternalStore } from "react";

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
export type Mistake = { challengeId: string; prompt: string; correct: string; at: string; activity?: unknown; skill?: string };
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
export function logAnswer(lessonId: string, skill: string, ok: boolean, review: { prompt: string; correct: string; activity: unknown }) {
  update((p) => {
    const at = now();
    const others = p.mistakes.filter((m) => m.prompt !== review.prompt);
    return markDay({
      ...p,
      skills: [...p.skills, { skill, ok, at }].slice(-600),
      mistakes: ok ? others : [...others, { challengeId: lessonId, prompt: review.prompt, correct: review.correct, at, activity: review.activity, skill }].slice(-60),
    });
  });
}

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
