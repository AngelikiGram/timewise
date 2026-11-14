"use client";

import type { HistoricalEvent, Journey, JourneyChapter } from "@timewise/historical-schemas";
import { eventsByDate, eventById, placeById, claimsFor } from "@/lib/collection";
import { buildEventGraph, type GraphFilters, type EventGraph } from "@/lib/event-graph";

type LocalizedText = { en: string; de?: string };

export interface AutoJourneyConfig {
  eventIds?: string[];
  filters?: GraphFilters;
  title?: string;
  description?: string;
}

export interface GeneratedJourney {
  journey: Journey;
  chapters: JourneyChapter[];
  selectedEvents: HistoricalEvent[];
  stats: {
    totalEvents: number;
    dateRange: string;
    themes: string[];
    countries: string[];
  };
}

const CHAPTER_TEMPLATES = [
  {
    title: "Origins & Prelude",
    description: "The background conditions and early events that set the stage",
    weight: { temporal: 1.0, thematic: 0.5, causal: 0.3, geographic: 0.2, person: 0.3 },
  },
  {
    title: "Escalation & Crisis",
    description: "Key turning points and moments of heightened tension",
    weight: { temporal: 0.8, thematic: 0.8, causal: 1.0, geographic: 0.3, person: 0.5 },
  },
  {
    title: "Climax & Confrontation",
    description: "The decisive events and their immediate consequences",
    weight: { temporal: 0.6, thematic: 0.7, causal: 1.0, geographic: 0.4, person: 0.6 },
  },
  {
    title: "Aftermath & Legacy",
    description: "Long-term outcomes and historical significance",
    weight: { temporal: 0.9, thematic: 0.6, causal: 0.5, geographic: 0.3, person: 0.4 },
  },
];

/**
 * Generate a journey from a set of event IDs
 */
export function generateJourneyFromEvents(config: AutoJourneyConfig): GeneratedJourney {
  const { eventIds = [], title, description } = config;

  const selectedEvents = eventIds
    .map(id => eventById.get(id))
    .filter((e): e is HistoricalEvent => e !== undefined)
    .sort((a, b) => new Date(a.when.start).getTime() - new Date(b.when.start).getTime());

  if (selectedEvents.length === 0) {
    throw new Error("No valid events provided for journey generation");
  }

  const graph = buildEventGraph({ eventIds, connectionTypes: ["causal", "temporal", "thematic", "geographic", "person"] });

  const chapters = clusterEventsIntoChapters(selectedEvents, graph);

  const journey: Journey = {
    id: `auto-${Date.now()}`,
    title: { en: title || "Auto-Generated Journey", de: "" },
    subtitle: { en: description || `A journey through ${selectedEvents.length} connected events`, de: "" },
    chapters: chapters.map(c => ({
      id: c.id,
      question: c.question,
      connection: c.connection,
      segments: c.segments,
      eventIds: c.eventIds,
      summary: c.summary,
    })),
    closing: { en: "This journey shows how events connect across time and space.", de: "" },
  };

  const allThemes = [...new Set(selectedEvents.flatMap(e => e.themes))].sort();
  const allCountries = [...new Set(
    selectedEvents
      .map(e => e.placeId)
      .filter((p): p is string => Boolean(p))
      .map(p => placeById.get(p)?.modernCountry)
      .filter((c): c is string => Boolean(c))
  )].sort();

  return {
    journey,
    chapters,
    selectedEvents,
    stats: {
      totalEvents: selectedEvents.length,
      dateRange: `${selectedEvents[0].when.start} – ${selectedEvents[selectedEvents.length - 1].when.start}`,
      themes: allThemes,
      countries: allCountries,
    },
  };
}

/**
 * Generate a journey from filters (time range, themes, countries)
 */
export function generateJourneyFromFilters(filters: GraphFilters, title?: string, description?: string): GeneratedJourney {
  const graph = buildEventGraph(filters);
  const eventIds = graph.nodes.map(n => n.id);
  return generateJourneyFromEvents({ eventIds, title, description });
}

function clusterEventsIntoChapters(events: HistoricalEvent[], graph: EventGraph) {
  if (events.length <= 4) {
    const eventIds = events.map(e => e.id);
    return [{
      id: "chapter-1",
      question: { en: "What happened in this sequence of events?", de: "" },
      connection: { en: "These events form a continuous narrative.", de: "" },
      segments: [{
        text: { en: "A chronological sequence of connected events.", de: "" },
        claimIds: [],
      }],
      eventIds,
      summary: { en: "All events in chronological sequence.", de: "" },
    }];
  }

  const chapters: { id: string; question: LocalizedText; connection: LocalizedText; segments: { text: LocalizedText; claimIds: string[] }[]; eventIds: string[]; summary: LocalizedText }[] = [];
  const numChapters = Math.min(4, Math.ceil(events.length / 4));
  const eventsPerChapter = Math.ceil(events.length / numChapters);

  for (let i = 0; i < numChapters; i++) {
    const start = i * eventsPerChapter;
    const end = Math.min(start + eventsPerChapter, events.length);
    const chapterEvents = events.slice(start, end);
    const eventIds = chapterEvents.map(e => e.id);

    const template = CHAPTER_TEMPLATES[i % CHAPTER_TEMPLATES.length];

    // Get primary claims for these events
    const claimIds: string[] = [];
    chapterEvents.forEach(event => {
      const claims = claimsFor(event.id);
      if (claims.length > 0) claimIds.push(claims[0].id);
    });

    chapters.push({
      id: `chapter-${i + 1}`,
      question: { en: template.title, de: "" },
      connection: { en: template.description, de: "" },
      segments: claimIds.length > 0 ? claimIds.map(claimId => ({
        text: { en: `Key claim: ${claimId}`, de: "" },
        claimIds: [claimId],
      })) : [{
        text: { en: "Events in this chapter.", de: "" },
        claimIds: [],
      }],
      eventIds,
      summary: { en: `${chapterEvents.length} events from ${chapterEvents[0].when.start} to ${chapterEvents[chapterEvents.length - 1].when.start}`, de: "" },
    });
  }

  return chapters;
}