"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { eventsByDate, eventById, placeById, claimsFor } from "@/lib/collection";
import { buildEventGraph, applyForceLayout, applyTimelineLayout, applyGeoLayout, type GraphFilters, type EventGraph as EventGraphType, type GraphNode } from "@/lib/event-graph";
import { generateJourneyFromEvents, generateJourneyFromFilters, type GeneratedJourney } from "@/lib/auto-journey";
import { EventGraph } from "@/components/learn/EventGraph";
import Link from "next/link";
import type { HistoricalEvent } from "@timewise/historical-schemas";

export default function AutoJourneyPage() {
  const [mode, setMode] = useState<"select" | "filters" | "preview">("select");
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);
  const [filters, setFilters] = useState<GraphFilters>({});
  const [generatedJourney, setGeneratedJourney] = useState<GeneratedJourney | null>(null);
  const [graph, setGraph] = useState<EventGraphType | null>(null);
  const [layout, setLayout] = useState<"force" | "time" | "geo">("force");
  const [isGenerating, setIsGenerating] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [journeyTitle, setJourneyTitle] = useState("");
  const [journeyDescription, setJourneyDescription] = useState("");

  useEffect(() => {
    const newGraph = buildEventGraph(filters);
    const positionedNodes = applyForceLayout([...newGraph.nodes], newGraph.edges);
    setGraph({ ...newGraph, nodes: positionedNodes });
  }, [filters]);

  const handleEventToggle = useCallback((eventId: string | null) => {
    if (!eventId) return;
    setSelectedEventIds(prev =>
      prev.includes(eventId)
        ? prev.filter(id => id !== eventId)
        : [...prev, eventId]
    );
  }, []);

  const handleFilterChange = useCallback((newFilters: GraphFilters) => {
    setFilters(newFilters);
  }, []);

  const handleGenerateJourney = useCallback(() => {
    setIsGenerating(true);
    try {
      let journey: GeneratedJourney;
      if (mode === "select" && selectedEventIds.length > 0) {
        journey = generateJourneyFromEvents({
          eventIds: selectedEventIds,
          title: journeyTitle || "Custom Journey",
          description: journeyDescription,
        });
      } else {
        journey = generateJourneyFromFilters(filters, journeyTitle || "Filtered Journey", journeyDescription);
      }
      setGeneratedJourney(journey);
      setMode("preview");
    } catch (error) {
      console.error("Failed to generate journey:", error);
      alert("Failed to generate journey. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  }, [mode, selectedEventIds, filters, journeyTitle, journeyDescription]);

  const handleSaveJourney = useCallback(() => {
    if (!generatedJourney) return;

    const saved = localStorage.getItem("timewise-custom-journeys");
    const journeys = saved ? JSON.parse(saved) : [];
    journeys.push({
      ...generatedJourney,
      savedAt: new Date().toISOString(),
    });
    localStorage.setItem("timewise-custom-journeys", JSON.stringify(journeys));

    alert("Journey saved! You can access it from the Learning Hub.");
  }, [generatedJourney]);

  const handleOpenJourney = useCallback(() => {
    if (!generatedJourney) return;
    const params = new URLSearchParams();
    params.set("events", generatedJourney.selectedEvents.map(e => e.id).join(","));
    params.set("title", generatedJourney.journey.title.en);
    window.location.href = `/journey/auto/play?${params.toString()}`;
  }, [generatedJourney]);

  const allThemes = useMemo(() => [...new Set(eventsByDate.flatMap(e => e.themes))].sort(), []);
  const allCountries = useMemo(() => [...new Set(
    eventsByDate
      .map(e => e.placeId)
      .filter((p): p is string => Boolean(p))
      .map(p => placeById.get(p)?.modernCountry)
      .filter((c): c is string => Boolean(c))
  )].sort(), []);

  return (
    <div className="min-h-dvh bg-paper flex flex-col">
      <header className="border-b border-line bg-paper-2 sticky top-0 z-10">
        <div className="max-w-full mx-auto px-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 py-3">
            <div className="flex items-center gap-4">
              <Link href="/learn" className="p-2 text-ink-2 hover:text-bronze transition-colors" aria-label="Back to Learning Hub">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
              </Link>
              <div>
                <h1 className="font-serif text-xl sm:text-2xl text-ink">Auto Journey Generator</h1>
                <p className="text-sm text-ink-2">Create journeys from any selection of events</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="border-b border-line bg-paper-2">
        <nav className="max-w-full mx-auto px-4" aria-label="Journey generation modes">
          <ol className="flex gap-1 p-2" role="tablist">
            <li role="tab" aria-selected={mode === "select"}>
              <button
                onClick={() => setMode("select")}
                className={`px-4 py-2 rounded-sm text-sm font-medium transition-colors ${
                  mode === "select" ? "bg-navy text-on-accent" : "text-ink-2 hover:text-ink"
                }`}
              >
                Select Events ({selectedEventIds.length})
              </button>
            </li>
            <li role="tab" aria-selected={mode === "filters"}>
              <button
                onClick={() => setMode("filters")}
                className={`px-4 py-2 rounded-sm text-sm font-medium transition-colors ${
                  mode === "filters" ? "bg-navy text-on-accent" : "text-ink-2 hover:text-ink"
                }`}
              >
                Filter & Generate
              </button>
            </li>
            {generatedJourney && (
              <li role="tab" aria-selected={mode === "preview"}>
                <button
                  onClick={() => setMode("preview")}
                  className={`px-4 py-2 rounded-sm text-sm font-medium transition-colors ${
                    mode === "preview" ? "bg-navy text-on-accent" : "text-ink-2 hover:text-ink"
                  }`}
                >
                  Preview Journey
                </button>
              </li>
            )}
          </ol>
        </nav>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-72 sm:w-80 border-r border-line bg-paper-2 p-4 overflow-y-auto flex-shrink-0">
          {mode === "select" && (
            <EventSelectorPanel
              selectedEventIds={selectedEventIds}
              onToggle={handleEventToggle}
              filters={filters}
              onFilterChange={handleFilterChange}
              allThemes={allThemes}
              allCountries={allCountries}
              onGenerate={handleGenerateJourney}
              isGenerating={isGenerating}
              journeyTitle={journeyTitle}
              setJourneyTitle={setJourneyTitle}
              journeyDescription={journeyDescription}
              setJourneyDescription={setJourneyDescription}
            />
          )}

          {mode === "filters" && (
            <FilterGeneratorPanel
              filters={filters}
              onChange={handleFilterChange}
              allThemes={allThemes}
              allCountries={allCountries}
              onGenerate={handleGenerateJourney}
              isGenerating={isGenerating}
              journeyTitle={journeyTitle}
              setJourneyTitle={setJourneyTitle}
              journeyDescription={journeyDescription}
              setJourneyDescription={setJourneyDescription}
            />
          )}

          {mode === "preview" && generatedJourney && (
            <JourneyPreviewPanel
              journey={generatedJourney}
              onSave={handleSaveJourney}
              onOpen={handleOpenJourney}
            />
          )}
        </aside>

        <div className="flex-1 relative min-w-0">
          {mode === "preview" && generatedJourney ? (
            <JourneyPreviewGraph
              journey={generatedJourney}
              layout={layout}
              onLayoutChange={setLayout}
            />
          ) : (
            <EventGraph
              initialNodes={graph?.nodes || []}
              initialEdges={graph?.edges || []}
              layout={layout}
              onLayoutChange={setLayout}
              onNodeSelect={handleEventToggle}
              selectedNodeId={null}
              filters={filters}
              onFiltersChange={handleFilterChange}
              availableThemes={graph?.metadata.themes || []}
              availableCountries={graph?.metadata.countries || []}
              onCreateJourney={() => {}}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function EventSelectorPanel({
  selectedEventIds,
  onToggle,
  filters,
  onFilterChange,
  allThemes,
  allCountries,
  onGenerate,
  isGenerating,
  journeyTitle,
  setJourneyTitle,
  journeyDescription,
  setJourneyDescription,
}: {
  selectedEventIds: string[];
  onToggle: (eventId: string | null) => void;
  filters: GraphFilters;
  onFilterChange: (filters: GraphFilters) => void;
  allThemes: string[];
  allCountries: string[];
  onGenerate: () => void;
  isGenerating: boolean;
  journeyTitle: string;
  setJourneyTitle: (v: string) => void;
  journeyDescription: string;
  setJourneyDescription: (v: string) => void;
}) {
  const { buildEventGraph } = require("@/lib/event-graph");
  const graph = buildEventGraph(filters);
  const filteredEvents = graph.nodes.map((n: GraphNode) => n.event);

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="space-y-3">
        <h3 className="font-serif text-lg">Journey Details</h3>
        <input
          type="text"
          placeholder="Journey title"
          value={journeyTitle}
          onChange={e => setJourneyTitle(e.target.value)}
          className="w-full px-3 py-2 rounded-sm border border-line bg-paper text-sm"
        />
        <textarea
          placeholder="Description (optional)"
          value={journeyDescription}
          onChange={e => setJourneyDescription(e.target.value)}
          className="w-full px-3 py-2 rounded-sm border border-line bg-paper text-sm min-h-[60px] resize-y"
        />
      </div>

      <div className="space-y-3 border-t border-line pt-4">
        <h3 className="font-serif text-lg">Filter Events</h3>

        <div>
          <label className="block text-sm font-medium text-ink-2 mb-1">Search</label>
          <input
            type="text"
            placeholder="Event name, person, theme..."
            value={filters.search || ""}
            onChange={e => onFilterChange({ ...filters, search: e.target.value })}
            className="w-full px-3 py-2 rounded-sm border border-line bg-paper text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-2 mb-1">Themes</label>
          <div className="flex flex-wrap gap-1.5">
            {allThemes.slice(0, 8).map(theme => (
              <FilterChip
                key={theme}
                label={theme}
                selected={filters.themes?.includes(theme) || false}
                onClick={() => onFilterChange({
                  ...filters,
                  themes: filters.themes?.includes(theme)
                    ? filters.themes.filter((t: string) => t !== theme)
                    : [...(filters.themes || []), theme]
                })}
              />
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-2 mb-1">Time Range</label>
          <div className="flex gap-2">
            <input
              type="date"
              value={filters.timeRange?.[0] || ""}
              onChange={e => onFilterChange({ ...filters, timeRange: [e.target.value, filters.timeRange?.[1] || ""] })}
              className="flex-1 px-3 py-2 rounded-sm border border-line bg-paper text-sm"
            />
            <input
              type="date"
              value={filters.timeRange?.[1] || ""}
              onChange={e => onFilterChange({ ...filters, timeRange: [filters.timeRange?.[0] || "", e.target.value] })}
              className="flex-1 px-3 py-2 rounded-sm border border-line bg-paper text-sm"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-lg">Events ({filteredEvents.length})</h3>
          <span className="text-sm text-ink-2">{selectedEventIds.length} selected</span>
        </div>

        {filteredEvents.length === 0 ? (
          <p className="text-ink-2 text-center py-8">No events match your filters</p>
        ) : (
          filteredEvents.map((event: HistoricalEvent) => (
            <EventSelectionCard
              key={event.id}
              event={event}
              isSelected={selectedEventIds.includes(event.id)}
              onToggle={() => onToggle(event.id)}
            />
          ))
        )}
      </div>

      <button
        onClick={onGenerate}
        disabled={selectedEventIds.length === 0 || isGenerating}
        className="w-full px-4 py-3 bg-navy text-on-accent rounded-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isGenerating ? "Generating..." : `Generate Journey (${selectedEventIds.length} events)`}
      </button>
    </div>
  );
}

function FilterGeneratorPanel({
  filters,
  onChange,
  allThemes,
  allCountries,
  onGenerate,
  isGenerating,
  journeyTitle,
  setJourneyTitle,
  journeyDescription,
  setJourneyDescription,
}: {
  filters: GraphFilters;
  onChange: (filters: GraphFilters) => void;
  allThemes: string[];
  allCountries: string[];
  onGenerate: () => void;
  isGenerating: boolean;
  journeyTitle: string;
  setJourneyTitle: (v: string) => void;
  journeyDescription: string;
  setJourneyDescription: (v: string) => void;
}) {
  const connectionTypeOptions = [
    { value: "causal" as const, label: "Causal", color: "#10b981" },
    { value: "temporal" as const, label: "Temporal", color: "#6b7280" },
    { value: "thematic" as const, label: "Thematic", color: "#f59e0b" },
    { value: "geographic" as const, label: "Geographic", color: "#3b82f6" },
    { value: "person" as const, label: "Person", color: "#8b5cf6" },
  ];

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="space-y-3">
        <h3 className="font-serif text-lg">Journey Details</h3>
        <input
          type="text"
          placeholder="Journey title"
          value={journeyTitle}
          onChange={e => setJourneyTitle(e.target.value)}
          className="w-full px-3 py-2 rounded-sm border border-line bg-paper text-sm"
        />
        <textarea
          placeholder="Description (optional)"
          value={journeyDescription}
          onChange={e => setJourneyDescription(e.target.value)}
          className="w-full px-3 py-2 rounded-sm border border-line bg-paper text-sm min-h-[60px] resize-y"
        />
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 border-t border-line pt-4">
        <div>
          <label className="block text-sm font-medium text-ink-2 mb-1">Time Range</label>
          <div className="flex gap-2">
            <input
              type="date"
              value={filters.timeRange?.[0] || ""}
              onChange={e => onChange({ ...filters, timeRange: [e.target.value, filters.timeRange?.[1] || ""] })}
              className="flex-1 px-3 py-2 rounded-sm border border-line bg-paper text-sm"
            />
            <input
              type="date"
              value={filters.timeRange?.[1] || ""}
              onChange={e => onChange({ ...filters, timeRange: [filters.timeRange?.[0] || "", e.target.value] })}
              className="flex-1 px-3 py-2 rounded-sm border border-line bg-paper text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-2 mb-1">Themes</label>
          <div className="flex flex-wrap gap-1.5">
            {allThemes.map(theme => (
              <FilterChip
                key={theme}
                label={theme}
                selected={filters.themes?.includes(theme) || false}
                onClick={() => onChange({
                  ...filters,
                  themes: filters.themes?.includes(theme)
                    ? filters.themes.filter((t: string) => t !== theme)
                    : [...(filters.themes || []), theme]
                })}
              />
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-2 mb-1">Countries</label>
          <div className="flex flex-wrap gap-1.5">
            {allCountries.map(country => (
              <FilterChip
                key={country}
                label={country}
                selected={filters.countries?.includes(country) || false}
                onClick={() => onChange({
                  ...filters,
                  countries: filters.countries?.includes(country)
                    ? filters.countries.filter((c: string) => c !== country)
                    : [...(filters.countries || []), country]
                })}
              />
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-2 mb-1">Connection Types</label>
          <div className="space-y-1.5">
            {connectionTypeOptions.map(conn => (
              <label key={conn.value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.connectionTypes?.includes(conn.value) ?? true}
                  onChange={e => onChange({
                    ...filters,
                    connectionTypes: e.target.checked
                      ? [...(filters.connectionTypes || []), conn.value]
                      : (filters.connectionTypes || []).filter((c: "causal" | "temporal" | "thematic" | "geographic" | "person") => c !== conn.value)
                  })}
                  className="rounded border-line"
                />
                <span className="w-3 h-3 rounded" style={{ background: conn.color }} />
                <span className="text-sm text-ink">{conn.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={onGenerate}
        disabled={isGenerating}
        className="w-full px-4 py-3 bg-navy text-on-accent rounded-sm font-medium hover:opacity-90 disabled:opacity-50"
      >
        {isGenerating ? "Generating..." : "Generate Journey from Filters"}
      </button>
    </div>
  );
}

function JourneyPreviewPanel({
  journey,
  onSave,
  onOpen,
}: {
  journey: GeneratedJourney;
  onSave: () => void;
  onOpen: () => void;
}) {
  const estimatedMinutes = Math.ceil(journey.selectedEvents.length * 3);

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="space-y-3">
        <h3 className="font-serif text-lg">Journey Preview</h3>
        <p className="text-ink-2 text-sm">{journey.journey.subtitle.en}</p>
        <div className="text-xs text-ink-2 space-y-1">
          <p>📅 {journey.stats.dateRange}</p>
          <p>📍 {journey.stats.countries.join(", ") || "Multiple locations"}</p>
          <p>🏷️ {journey.stats.themes.slice(0, 5).join(", ")}</p>
          <p>⏱️ ~{estimatedMinutes} minutes</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2">
        <h4 className="font-medium text-sm text-ink-2">Chapters ({journey.chapters.length})</h4>
        {journey.chapters.map(chapter => (
          <div key={chapter.id} className="p-3 bg-paper border border-line rounded-sm">
            <h5 className="font-medium text-sm text-ink">{chapter.question.en}</h5>
            <p className="text-xs text-ink-2 mt-1">{chapter.connection?.en || chapter.summary.en}</p>
            <div className="flex flex-wrap gap-1 mt-2">
              {chapter.eventIds.slice(0, 4).map(eventId => {
                const event = journey.selectedEvents.find(e => e.id === eventId);
                return event ? (
                  <span key={event.id} className="px-2 py-0.5 text-xs bg-navy text-on-accent rounded">
                    {event.title.en}
                  </span>
                ) : null;
              })}
              {chapter.eventIds.length > 4 && (
                <span className="px-2 py-0.5 text-xs text-ink-2">+{chapter.eventIds.length - 4} more</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 border-t border-line pt-4">
        <button onClick={onSave} className="flex-1 px-4 py-2 border border-line rounded-sm text-sm font-medium hover:bg-paper-2">
          Save Journey
        </button>
        <button onClick={onOpen} className="flex-1 px-4 py-2 bg-navy text-on-accent rounded-sm text-sm font-medium hover:opacity-90">
          Open in Player
        </button>
      </div>
    </div>
  );
}

function JourneyPreviewGraph({
  journey,
  layout,
  onLayoutChange,
}: {
  journey: GeneratedJourney;
  layout: "force" | "time" | "geo";
  onLayoutChange: (l: "force" | "time" | "geo") => void;
}) {
  const { buildEventGraph, applyForceLayout, applyTimelineLayout, applyGeoLayout } = require("@/lib/event-graph");

  const eventIds = journey.selectedEvents.map(e => e.id);
  const graph = buildEventGraph({ eventIds });

  let positionedNodes = graph.nodes;
  if (layout === "force") positionedNodes = applyForceLayout([...graph.nodes], graph.edges);
  else if (layout === "time") positionedNodes = applyTimelineLayout([...graph.nodes]);
  else if (layout === "geo") positionedNodes = applyGeoLayout([...graph.nodes]);

  return (
    <div className="flex h-dvh flex-col bg-paper">
      <header className="border-b border-line bg-paper-2 sticky top-0 z-10 p-3">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-lg">{journey.journey.title.en}</h2>
          <select value={layout} onChange={e => onLayoutChange(e.target.value as "force" | "time" | "geo")} className="px-3 py-1.5 rounded-sm border border-line bg-paper text-sm">
            <option value="force">Force-Directed</option>
            <option value="time">Timeline</option>
            <option value="geo">Geographic</option>
          </select>
        </div>
      </header>
      <div className="flex-1">
        <EventGraph
          initialNodes={positionedNodes}
          initialEdges={graph.edges}
          layout={layout}
          onLayoutChange={onLayoutChange}
          onNodeSelect={() => {}}
          selectedNodeId={null}
          filters={{}}
          onFiltersChange={() => {}}
          availableThemes={graph.metadata.themes}
          availableCountries={graph.metadata.countries}
          onCreateJourney={() => {}}
        />
      </div>
    </div>
  );
}

function EventSelectionCard({ event, isSelected, onToggle }: { event: HistoricalEvent; isSelected: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full p-3 rounded-lg border transition-all text-left ${
        isSelected
          ? "bg-navy border-navy text-on-accent"
          : "border-line bg-paper hover:border-bronze hover:bg-paper-2"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm truncate">{event.title.en}</h4>
          <p className="text-xs mt-1 opacity-80">{event.when.start}</p>
          <div className="flex flex-wrap gap-1 mt-2">
            {event.themes.slice(0, 3).map(t => (
              <span key={t} className={`px-1.5 py-0.5 text-xs rounded ${isSelected ? "bg-on-accent/20" : "bg-paper-3 border border-line"}`}>
                {t}
              </span>
            ))}
          </div>
        </div>
        <span className={`w-5 h-5 rounded-full border-2 flex-shrink-0 ${isSelected ? "border-on-accent bg-navy" : "border-line"}`}>
          {isSelected && <span className="w-full h-full flex items-center justify-center text-xs text-on-accent">✓</span>}
        </span>
      </div>
    </button>
  );
}

function FilterChip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
        selected
          ? "bg-navy text-on-accent"
          : "bg-paper border border-line text-ink-2 hover:border-bronze hover:bg-paper-2"
      }`}
    >
      {label}
    </button>
  );
}