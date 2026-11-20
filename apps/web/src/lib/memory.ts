"use client";

// Smart history memory: what you finish (a story, a life, a timeline round) becomes a few review questions,
// asked again at growing intervals (1, 3, 7, 16, 35, 90 days) until they stick. Every question is built from
// the same dated records the page showed, and keeps a link back to it. Kept in this browser only.
import { useSyncExternalStore } from "react";

export type Card = {
  id: string; prompt: string; options: string[]; answer: string; explain: string; source?: string;
  from: { kind: "story" | "life" | "game"; title: string; href: string };
  box: number; due: string; added: string; seen: number; right: number;
};
type New = Omit<Card, "box" | "due" | "added" | "seen" | "right">;

const KEY = "tw-memory-v1";
const DAYS = [1, 3, 7, 16, 35, 90];
let cache: Card[] | null = null;
const listeners = new Set<() => void>();
const read = (): Card[] => { if (cache) return cache; try { cache = JSON.parse(localStorage.getItem(KEY) ?? "[]") as Card[]; } catch { cache = []; } return cache; };
const write = (next: Card[]) => { cache = next; try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* this visit only */ } listeners.forEach((l) => l()); };
const EMPTY: Card[] = [];
export const useMemory = () => useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, read, () => EMPTY);
const later = (days: number, from = Date.now()) => new Date(from + days * 86400000).toISOString();

/** Add questions; ones already kept are left as they are. Returns how many are new. */
export function addCards(cards: New[]): number {
  const have = new Set(read().map((c) => c.id));
  const fresh = cards.filter((c) => !have.has(c.id)).map((c) => ({ ...c, box: 0, due: later(1), added: new Date().toISOString(), seen: 0, right: 0 }));
  if (fresh.length) {
    write([...read(), ...fresh]);
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("tw-memory", { detail: fresh.length }));
  }
  return fresh.length;
}
export const dueCards = (cards: Card[], at = Date.now()) => cards.filter((c) => Date.parse(c.due) <= at);
export function answerCard(id: string, ok: boolean) {
  write(read().map((c) => (c.id !== id ? c : { ...c, seen: c.seen + 1, right: c.right + (ok ? 1 : 0), box: ok ? Math.min(DAYS.length - 1, c.box + 1) : 0, due: later(ok ? DAYS[Math.min(DAYS.length - 1, c.box + 1)] : 1) })));
}
export const removeCard = (id: string) => write(read().filter((c) => c.id !== id));
export const clearMemory = () => write([]);

// ---------------------------------------------------------------------------------------------- Making questions

const fmt = (y: number) => (y < 0 ? `${-y} BC` : String(y));
const shuffle = <T,>(xs: T[]) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
/** Three wrong years near the right one, never equal to it or each other. */
function nearYears(y: number, max = new Date().getFullYear()) {
  const out = new Set<number>();
  const steps = shuffle([3, 5, 8, 12, 17, 25, 40, -3, -6, -10, -15, -22, -35]);
  for (const s of steps) { const z = y + s; if (z !== y && z <= max && out.size < 3) out.add(z); }
  return [...out];
}
type Rec = { id: string; title: string; year: number };

export function yearCard(r: Rec, from: Card["from"], source?: string): New {
  return { id: `year:${r.id}`, prompt: `In which year did “${r.title}” happen or begin?`, options: shuffle([r.year, ...nearYears(r.year)]).map(fmt), answer: fmt(r.year), explain: `${r.title}: ${fmt(r.year)}.`, source, from };
}
export function firstCard(a: Rec, b: Rec, from: Card["from"]): New | null {
  if (a.year === b.year) return null;
  const [x, y] = a.year < b.year ? [a, b] : [b, a];
  const ids = [a.id, b.id].sort().join("|");
  return { id: `first:${ids}`, prompt: "Which came first?", options: shuffle([a.title, b.title]), answer: x.title, explain: `${x.title} (${fmt(x.year)}) came before ${y.title} (${fmt(y.year)}).`, from };
}

/** From a finished story: two "when?" questions and two "which came first?" questions, spread across it. */
export function storyCards(records: Rec[], from: Card["from"], source = (id: string) => `https://www.wikidata.org/wiki/${id}`): New[] {
  const dated = records.filter((r) => Number.isFinite(r.year));
  if (dated.length < 2) return [];
  const pick = shuffle(dated);
  const out: (New | null)[] = [yearCard(pick[0], from, source(pick[0].id)), pick[2] ? yearCard(pick[2], from, source(pick[2].id)) : null];
  out.push(firstCard(dated[0], dated[dated.length - 1], from), firstCard(pick[1], pick[3] ?? pick[0], from));
  return out.filter((c): c is New => !!c);
}

/** From a life scrubbed to the end: when born, how old at a moment, and which came first. */
export function lifeCards(p: { id: string; label: string; born: number | null }, moments: { id: string; year: number; label: string; source: string }[], from: Card["from"]): New[] {
  const out: (New | null)[] = [];
  if (p.born != null) out.push({ id: `born:${p.id}`, prompt: `When was ${p.label} born?`, options: shuffle([p.born, ...nearYears(p.born)]).map(fmt), answer: fmt(p.born), explain: `${p.label} was born in ${fmt(p.born)}.`, source: `https://www.wikidata.org/wiki/${p.id}#P569`, from });
  const mid = moments.filter((m) => p.born != null && m.year > p.born);
  const m = shuffle(mid)[0];
  if (m && p.born != null) {
    const age = m.year - p.born;
    const opts = shuffle([age, ...[age - 7, age + 6, age + 13, age - 12].filter((x) => x > 0 && x !== age).slice(0, 3)]);
    out.push({ id: `age:${p.id}:${m.id}`, prompt: `How old was ${p.label} at this point: ${m.label}?`, options: opts.map(String), answer: String(age), explain: `${m.label}: ${fmt(m.year)}, when ${p.label} was ${age}.`, source: m.source, from });
  }
  const two = shuffle(mid).slice(0, 2);
  if (two.length === 2) out.push(firstCard({ id: two[0].id, title: two[0].label, year: two[0].year }, { id: two[1].id, title: two[1].label, year: two[1].year }, from));
  return out.filter((c): c is New => !!c).map((c) => (c.id.startsWith("first:") ? { ...c, id: `${c.id}:${p.id}`, prompt: `In ${p.label}'s life, which came first?` } : c));
}
