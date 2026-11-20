"use client";

// The explorer side of the profile: lives followed, things tracked, years visited, stories read, surprises
// opened. Kept in this browser only, like the rest of progress. XP, levels and badges are computed from it,
// for fun: nothing is ever taken away, and nothing here claims to measure knowledge.
import { useSyncExternalStore } from "react";

type Seen = { label: string; at: string; born?: number | null };
export type Explorer = {
  lives: Record<string, Seen>;
  things: Record<string, Seen>;
  years: Record<string, string>;
  stories: Record<string, Seen>;
  /** Surprise picks opened. */
  surprises: number;
  /** Looked something up on Wikidata live, beyond the prebuilt collection. */
  lookups: number;
  /** Lives scrubbed from birth to the end. */
  wholeLives: string[];
  /** Names for interests saved from live pages, so lists can show them. */
  names: Record<string, string>;
  /** Places explained, events whose causes were opened, and game results. */
  places: Record<string, Seen>;
  why: Record<string, Seen>;
  timeline: { rounds: number; perfect: number; streak: number; best: number };
  facts: { answered: number; right: number };
};

const KEY = "tw-explorer-v1";
const EMPTY: Explorer = { lives: {}, things: {}, years: {}, stories: {}, surprises: 0, lookups: 0, wholeLives: [], names: {}, places: {}, why: {}, timeline: { rounds: 0, perfect: 0, streak: 0, best: 0 }, facts: { answered: 0, right: 0 } };
let cache: Explorer | null = null;
const listeners = new Set<() => void>();

function read(): Explorer {
  if (cache) return cache;
  try { const saved = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Explorer>; cache = { ...EMPTY, ...saved, timeline: { ...EMPTY.timeline, ...saved.timeline }, facts: { ...EMPTY.facts, ...saved.facts } }; } catch { cache = EMPTY; }
  return cache;
}

function write(next: Explorer) {
  const before = new Set(explorerBadges(read()).filter((b) => b.earned).map((b) => b.id));
  cache = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* blocked storage: this visit only */ }
  listeners.forEach((l) => l());
  const fresh = explorerBadges(next).filter((b) => b.earned && !before.has(b.id));
  if (fresh.length && typeof window !== "undefined") window.dispatchEvent(new CustomEvent("tw-badge", { detail: fresh }));
}

const now = () => new Date().toISOString();
const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };
export const useExplorer = () => useSyncExternalStore(subscribe, read, () => EMPTY);
export const readExplorer = read;

export const recordLife = (id: string, label: string, born?: number | null) => { const e = read(); if (e.lives[id]) return; write({ ...e, lives: { ...e.lives, [id]: { label, at: now(), born } } }); };
export const recordThing = (id: string, label: string) => { const e = read(); if (e.things[id]) return; write({ ...e, things: { ...e.things, [id]: { label, at: now() } } }); };
export const recordYear = (y: number) => { const e = read(); if (e.years[y]) return; write({ ...e, years: { ...e.years, [y]: now() } }); };
export const recordStory = (id: string, label: string) => { const e = read(); if (e.stories[id]) return; write({ ...e, stories: { ...e.stories, [id]: { label, at: now() } } }); };
export const recordSurprise = () => { const e = read(); write({ ...e, surprises: e.surprises + 1 }); };
export const recordLookup = () => { const e = read(); write({ ...e, lookups: e.lookups + 1 }); };
export const recordWholeLife = (id: string) => { const e = read(); if (e.wholeLives.includes(id)) return; write({ ...e, wholeLives: [...e.wholeLives, id] }); };
export const rememberName = (key: string, label: string) => { const e = read(); if (e.names[key] === label) return; write({ ...e, names: { ...e.names, [key]: label } }); };
export const recordPlace = (id: string, label: string) => { const e = read(); if (e.places[id]) return; write({ ...e, places: { ...e.places, [id]: { label, at: now() } } }); };
export const recordWhy = (id: string, label: string) => { const e = read(); if (e.why[id]) return; write({ ...e, why: { ...e.why, [id]: { label, at: now() } } }); };
/** A timeline round: perfect rounds build a streak, and the best streak is kept. */
export const recordRound = (perfect: boolean) => { const e = read(); const t = e.timeline; const streak = perfect ? t.streak + 1 : 0; write({ ...e, timeline: { rounds: t.rounds + 1, perfect: t.perfect + (perfect ? 1 : 0), streak, best: Math.max(t.best, streak) } }); };
export const recordFact = (ok: boolean) => { const e = read(); write({ ...e, facts: { answered: e.facts.answered + 1, right: e.facts.right + (ok ? 1 : 0) } }); };
export const resetExplorer = () => write(EMPTY);

/** Recently seen, newest first. */
export const recentOf = (m: Record<string, Seen>, n = 6) => Object.entries(m).sort((a, b) => b[1].at.localeCompare(a[1].at)).slice(0, n).map(([id, s]) => ({ id, ...s }));

export function explorerXp(e: Explorer) {
  return Object.keys(e.lives).length * 10 + Object.keys(e.things).length * 10 + Object.keys(e.years).length * 4 + Object.keys(e.stories).length * 15 + e.surprises * 5 + e.lookups * 3 + e.wholeLives.length * 20
    + Object.keys(e.places).length * 10 + Object.keys(e.why).length * 6 + e.timeline.rounds * 8 + e.timeline.perfect * 12 + e.facts.right * 4;
}

export const LEVELS = [
  { at: 0, title: "Curious Visitor" }, { at: 40, title: "Apprentice Chronicler" }, { at: 120, title: "Time Wanderer" },
  { at: 250, title: "Archive Diver" }, { at: 450, title: "Era Hopper" }, { at: 750, title: "Master Historian" }, { at: 1200, title: "Keeper of Time" },
];
export function level(xp: number) {
  let i = 0;
  while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1].at) i++;
  const next = LEVELS[i + 1];
  return { n: i + 1, title: LEVELS[i].title, xp, from: LEVELS[i].at, to: next?.at ?? null, nextTitle: next?.title ?? null };
}

export type Tier = "bronze" | "silver" | "gold";
export type ExplorerBadge = { id: string; label: string; help: string; icon: "person" | "network" | "timeline" | "book" | "idea" | "compass" | "search" | "period" | "people" | "place" | "cause" | "checked" | "sequence"; tier: Tier; have: number; need: number; earned: boolean };

const eraOf = (y: number) => (y < 500 ? 0 : y < 1450 ? 1 : y < 1800 ? 2 : y < 1914 ? 3 : y < 1945 ? 4 : 5);

/** Explorer badges, each with how far along it is. `interests` is the number of interests saved. */
export function explorerBadges(e: Explorer, interests = 0): ExplorerBadge[] {
  const lives = Object.keys(e.lives).length, things = Object.keys(e.things).length, stories = Object.keys(e.stories).length;
  const years = Object.keys(e.years).map(Number);
  const centuries = new Set(years.map((y) => Math.floor(y / 100))).size;
  const eras = new Set(Object.values(e.lives).map((l) => l.born).filter((b): b is number => b != null).map(eraOf)).size;
  const b = (id: string, label: string, help: string, icon: ExplorerBadge["icon"], tier: Tier, have: number, need: number): ExplorerBadge => ({ id, label, help, icon, tier, have: Math.min(have, need), need, earned: have >= need });
  return [
    b("life1", "First life", "Follow a life.", "person", "bronze", lives, 1),
    b("life10", "Biographer", "Follow ten lives.", "person", "silver", lives, 10),
    b("life30", "Hall of fame", "Follow thirty lives.", "person", "gold", lives, 30),
    b("eras", "Across the ages", "Follow lives born in four different eras.", "period", "gold", eras, 4),
    b("whole", "A whole lifetime", "Scrub a life from birth to the end.", "timeline", "bronze", e.wholeLives.length, 1),
    b("whole5", "Time lapse", "Scrub five whole lives.", "timeline", "silver", e.wholeLives.length, 5),
    b("thing1", "Thing tracker", "Follow a thing across the map.", "network", "bronze", things, 1),
    b("thing5", "Collector", "Follow five different things.", "network", "silver", things, 5),
    b("year5", "Time hopper", "Explore five different years.", "timeline", "bronze", years.length, 5),
    b("cent", "Century surfer", "Explore years in five different centuries.", "period", "silver", centuries, 5),
    b("story1", "Storyteller", "Open a story.", "book", "bronze", stories, 1),
    b("story10", "Bookworm", "Open ten stories.", "book", "silver", stories, 10),
    b("surp1", "Lucky dip", "Press a Surprise me button.", "idea", "bronze", e.surprises, 1),
    b("surp10", "Wildcard", "Take ten surprises.", "idea", "gold", e.surprises, 10),
    b("look3", "Deep diver", "Look up three things beyond the prebuilt collection.", "search", "silver", e.lookups, 3),
    b("int5", "Curator", "Save five interests.", "compass", "bronze", interests, 5),
    b("place1", "Local historian", "Explain a place through its history.", "place", "bronze", Object.keys(e.places).length, 1),
    b("place5", "Globetrotter", "Explain five places.", "place", "silver", Object.keys(e.places).length, 5),
    b("why5", "Cause finder", "Open the causes and effects of five events.", "cause", "silver", Object.keys(e.why).length, 5),
    b("round1", "Chronologist", "Get a timeline round perfectly right.", "sequence", "bronze", e.timeline.perfect, 1),
    b("streak5", "Time lord", "Five perfect timeline rounds in a row.", "sequence", "gold", e.timeline.best, 5),
    b("fact10", "Myth buster", "Judge ten claims correctly in Fact or Myth.", "checked", "silver", e.facts.right, 10),
  ];
}

export const TIER_STYLE: Record<Tier, { ring: string; fill: string; label: string }> = {
  bronze: { ring: "#a8743a", fill: "#f3e2c8", label: "Bronze" },
  silver: { ring: "#8a94a3", fill: "#e8ecf1", label: "Silver" },
  gold: { ring: "#c9a227", fill: "#fbf0c4", label: "Gold" },
};
