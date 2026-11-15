// The story library. Each story is authored in one place: a journey in data/curated/<region>/journeys.json
// holds the chapters and their sourced claims; this file adds what a reader needs before starting
// (where, when, how long, how hard) and the closing recap. Detective cases are stories too, built from
// the same sourced claims. Add a story by adding a journey or a case, then an entry here.
import { eventById, journeys } from "./collection";

export type StoryCard = {
  id: string;
  kind: "journey" | "case";
  title: string;
  /** The learning question the story answers. */
  question: string;
  intro: string;
  place: string;
  period: string;
  minutes: number;
  difficulty: "Introductory" | "Intermediate" | "Advanced";
  href: string;
  image?: { url: string; alt: string; creator?: string; license?: string; page?: string; title: string; caveat?: string; created?: string };
  /** Number of steps, for progress. */
  steps: number;
  chapters: { id: string; title: string }[];
  /** Ids of stories to suggest at the end. */
  next: string[];
  checked: true;
};

const flagship = journeys[0];
const media = (eventId: string) => eventById.get(eventId)?.media;
const asImage = (eventId: string, alt?: string) => {
  const m = media(eventId);
  return m ? { url: m.url, alt: alt ?? m.title, creator: m.creator, license: m.license, page: m.page, title: m.title, caveat: m.caveat, created: m.created } : undefined;
};

export const STORIES: StoryCard[] = [
  {
    id: flagship.id,
    kind: "journey",
    title: flagship.title.en,
    question: "How did a revolution, railways and a lost war turn an empire into a small republic?",
    intro: flagship.subtitle.en,
    place: "Austria and its neighbours",
    period: "1844–1921",
    minutes: Math.round(flagship.chapters.reduce((n, c) => n + c.eventIds.length, 0) * 1.2),
    difficulty: "Introductory",
    href: `/journeys/${flagship.id}`,
    image: asImage("vienna-march-1848"),
    steps: flagship.chapters.reduce((n, c) => n + c.eventIds.length, 0),
    chapters: flagship.chapters.map((c) => ({ id: c.id, title: c.question.en })),
    next: ["ringstrasse-case"],
    checked: true,
  },
  {
    id: "ringstrasse-case",
    kind: "case",
    title: "The case of the missing opening day",
    question: "When did Vienna's Ringstrasse open? The sources give more than one answer.",
    intro: "An emperor's decree, a grand opening and a forgotten stretch of road. Weigh three pieces of evidence and decide which answer they support, or whether they can't settle it.",
    place: "Vienna",
    period: "1857–1865",
    minutes: 6,
    difficulty: "Intermediate",
    href: "/challenges/case/ringstrasse",
    steps: 4,
    chapters: [{ id: "question", title: "The question" }, { id: "evidence", title: "The evidence" }, { id: "verdict", title: "Your verdict" }, { id: "explanation", title: "What the evidence shows" }],
    next: [flagship.id],
    checked: true,
  },
];

export const storyById = new Map(STORIES.map((s) => [s.id, s]));
