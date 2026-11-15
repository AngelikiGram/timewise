// Published challenges. Every one is built from the hand-checked collection: its dated events, its
// places, its images with their recorded creation dates, and its claims with their sources and support
// status. No challenge states a fact that isn't in a sourced claim.
import type { SupportStatus } from "@timewise/historical-schemas";
import { claimById, collection, eventById, placeById, sourceById, SUPPORT_LABELS } from "./collection";

export type Mode = "challenge" | "practice";

type Base = { id: string; title: string; prompt: string; minutes: number; xp: number; theme: string };
export type OrderChallenge = Base & { kind: "order"; eventIds: string[] };
export type LocateChallenge = Base & { kind: "locate"; eventId: string; options: string[] };
export type ImageChallenge = Base & { kind: "image"; eventId: string; options: string[] };
export type MatchChallenge = Base & { kind: "match"; claimIds: string[] };
export type EstablishChallenge = Base & { kind: "establish"; claimId: string };
export type Challenge = OrderChallenge | LocateChallenge | ImageChallenge | MatchChallenge | EstablishChallenge;

export const FORMATS: Record<Challenge["kind"], { label: string; help: string }> = {
  order: { label: "Put in order", help: "Arrange events from earliest to latest." },
  locate: { label: "Find it on the map", help: "Place an event where it happened." },
  image: { label: "Date the image", help: "Estimate when an image was made, and what it shows." },
  match: { label: "Match the source", help: "Pair each claim with the source that supports it." },
  establish: { label: "What does it establish?", help: "Judge what a piece of evidence can and can't tell you." },
};

export const CHALLENGES: Challenge[] = [
  { id: "order-1848-1867", kind: "order", title: "From revolution to compromise", prompt: "Put these events in order, earliest first.", eventIds: ["vienna-march-1848", "semmering-1854", "ring-decree-1857", "koniggratz-1866", "compromise-1867"], minutes: 2, xp: 20, theme: "Politics" },
  { id: "order-1914-1921", kind: "order", title: "The end of an empire", prompt: "Put these events in order, earliest first.", eventIds: ["sarajevo-1914", "republic-1918", "saint-germain-1919", "salzburg-festival-1920", "carinthia-1920", "sopron-1921"], minutes: 3, xp: 25, theme: "Borders" },
  { id: "order-rails", kind: "order", title: "Rails across the Alps", prompt: "Put these railway milestones in order, earliest first.", eventIds: ["graz-railway-1844", "semmering-1854", "brenner-1867"], minutes: 1, xp: 10, theme: "Railways" },
  { id: "locate-koniggratz", kind: "locate", title: "Where was Königgrätz?", prompt: "A battle of the Austro-Prussian War, fought on 3 July 1866. Where was it?", eventId: "koniggratz-1866", options: ["koniggratz", "linz", "budapest", "graz"], minutes: 1, xp: 10, theme: "War" },
  { id: "locate-sopron", kind: "locate", title: "Where is Sopron?", prompt: "In December 1921 a local plebiscite decided this town's status. Where is it?", eventId: "sopron-1921", options: ["sopron", "klagenfurt", "salzburg", "sarajevo"], minutes: 1, xp: 10, theme: "Borders" },
  { id: "locate-saint-germain", kind: "locate", title: "Where was the treaty signed?", prompt: "A treaty recorded as prohibiting the state of German-Austria was signed on 10 September 1919. Where?", eventId: "saint-germain-1919", options: ["saint-germain", "vienna", "budapest", "brenner"], minutes: 1, xp: 10, theme: "Borders" },
  { id: "locate-sarajevo", kind: "locate", title: "Where did the shots fall?", prompt: "Archduke Franz Ferdinand was assassinated on 28 June 1914. Where?", eventId: "sarajevo-1914", options: ["sarajevo", "vienna", "koniggratz", "klagenfurt"], minutes: 1, xp: 10, theme: "War" },
  { id: "image-koniggratz", kind: "image", title: "A battle in paint", prompt: "When was this painting made, and which event does it show?", eventId: "koniggratz-1866", options: ["koniggratz-1866", "vienna-october-1848", "sarajevo-1914"], minutes: 2, xp: 15, theme: "Sources" },
  { id: "image-salzburg", kind: "image", title: "A portrait and a festival", prompt: "When was this portrait made, and which event is it linked to here?", eventId: "salzburg-festival-1920", options: ["salzburg-festival-1920", "linz-program-1882", "republic-1918"], minutes: 2, xp: 15, theme: "Sources" },
  { id: "image-sarajevo", kind: "image", title: "Front-page news", prompt: "When was this illustration printed, and which event does it show?", eventId: "sarajevo-1914", options: ["sarajevo-1914", "koniggratz-1866", "republic-1918"], minutes: 2, xp: 15, theme: "Sources" },
  { id: "match-borders", kind: "match", title: "Who says so?", prompt: "Match each claim with the source that supports it.", claimIds: ["c-car-1", "c-sop-1", "c-ger-1"], minutes: 3, xp: 20, theme: "Sources" },
  { id: "match-rails", kind: "match", title: "Paper trail of the railways", prompt: "Match each claim with the source that supports it.", claimIds: ["c-graz-1", "c-sem-1", "c-bren-1"], minutes: 3, xp: 20, theme: "Sources" },
  { id: "establish-comp", kind: "establish", title: "A narrow compromise?", prompt: "Read the statement and what its source does. What does the evidence establish?", claimId: "c-comp-2", minutes: 2, xp: 15, theme: "Sources" },
  { id: "establish-sopron", kind: "establish", title: "A vote in question", prompt: "Read the statement and what its source does. What does the evidence establish?", claimId: "c-sop-1", minutes: 2, xp: 15, theme: "Sources" },
  { id: "establish-semmering", kind: "establish", title: "World Heritage", prompt: "Read the statement and what its sources do. What does the evidence establish?", claimId: "c-sem-2", minutes: 2, xp: 15, theme: "Sources" },
  { id: "establish-linz", kind: "establish", title: "Support for a programme", prompt: "Read the statement and what its source does. What does the evidence establish?", claimId: "c-linz-2", minutes: 2, xp: 15, theme: "Sources" },
];

export const challengeById = new Map(CHALLENGES.map((c) => [c.id, c]));

/** The answer choices for "what does it establish?", one per support status that occurs in the collection. */
export const ESTABLISH_OPTIONS: { status: SupportStatus; text: string }[] = [
  { status: "reference", text: "It is stated by a reference work. The original record isn't linked." },
  { status: "corroborated", text: "More than one source states it, and they agree." },
  { status: "interpretation", text: "It is a judgement about the past, not a recorded fact." },
  { status: "disputed", text: "It is recorded, but accounts or assessments of it conflict." },
];

export const supportHelp = (s: SupportStatus) => SUPPORT_LABELS[s].help;

/** The day's challenge: the same for everyone on a given date, cycling through the published set. */
export function dailyChallenge(date = new Date()): { challenge: Challenge; day: string } {
  const day = date.toISOString().slice(0, 10);
  const n = Math.floor(Date.parse(`${day}T00:00:00Z`) / 86400000);
  return { challenge: CHALLENGES[(n * 7) % CHALLENGES.length], day };
}

/** Deterministic shuffle, so the server and browser agree, and a retry gets a fresh order. */
export function shuffle<T>(items: T[], seed: number): T[] {
  const out = [...items];
  let s = seed || 1;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  // Never hand back the answer already in order.
  return out.every((x, i) => x === items[i]) && out.length > 1 ? [...out.slice(1), out[0]] : out;
}

// Look-ups the challenge screens use, kept here so every fact shown comes from the collection.
export const ev = (id: string) => eventById.get(id)!;
export const place = (id: string) => placeById.get(id)!;
export const claim = (id: string) => claimById.get(id)!;
export const source = (id: string) => sourceById.get(id)!;
export const claimsOf = (eventId: string) => collection.claims.filter((c) => c.eventId === eventId);
