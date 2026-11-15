"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { EventGraph } from "@/components/learn/EventGraph";
import { buildEventGraph, applyForceLayout, applyTimelineLayout, applyGeoLayout, type GraphFilters, type EventGraph as EventGraphType, type GraphNode } from "@/lib/event-graph";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function GraphPage({ searchParams }: { searchParams: Promise<{ event?: string; timeStart?: string; timeEnd?: string; themes?: string; countries?: string; layout?: string }> }) {
  const [graph, setGraph] = useState<EventGraphType | null>(null);
  const [layout, setLayout] = useState<"force" | "time" | "geo">("force");
  const [filters, setFilters] = useState<GraphFilters>({});
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(true);

  // Parse URL params
  useEffect(() => {
    searchParams.then(params => {
      const initialFilters: GraphFilters = {};
      const initialLayout = (params.layout as "force" | "time" | "geo") || "force";

      if (params.event) {
        initialFilters.eventIds = [params.event];
      }
      if (params.timeStart || params.timeEnd) {
        initialFilters.timeRange = [params.timeStart || "1800-01-01", params.timeEnd || "2000-12-31"];
      }
      if (params.themes) {
        initialFilters.themes = params.themes.split(",");
      }
      if (params.countries) {
        initialFilters.countries = params.countries.split(",");
      }

      setLayout(initialLayout);
      setFilters(initialFilters);
    });
  }, [searchParams]);

  // Build graph when filters change
  useEffect(() => {
    setIsLoading(true);
    // Small delay to allow state to settle
    const timer = setTimeout(() => {
      const newGraph = buildEventGraph(filters);
      setGraph(newGraph);
      setIsLoading(false);
    }, 50);
    return () => clearTimeout(timer);
  }, [filters]);

  // Apply layout when it changes
  useEffect(() => {
    if (graph) {
      let positionedNodes = graph.nodes;
      switch (layout) {
        case "force":
          positionedNodes = applyForceLayout([...graph.nodes], graph.edges);
          break;
        case "time":
          positionedNodes = applyTimelineLayout([...graph.nodes]);
          break;
        case "geo":
          positionedNodes = applyGeoLayout([...graph.nodes]);
          break;
      }
      setGraph(prev => prev ? { ...prev, nodes: positionedNodes } : null);
    }
  }, [layout, graph]);

  const handleFilterChange = useCallback((newFilters: GraphFilters) => {
    setFilters(newFilters);
  }, []);

  const handleNodeSelect = useCallback((nodeId: string | null) => {
    setSelectedEventId(nodeId);
  }, []);

  const handleCreateJourney = useCallback((eventIds: string[]) => {
    if (eventIds.length > 0) {
      const params = new URLSearchParams();
      params.set("events", eventIds.join(","));
      window.location.href = `/journey/auto?${params.toString()}`;
    }
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-paper">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-navy border-t-transparent mx-auto mb-4" />
          <p className="text-xl text-ink-2">Building event graph...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-paper flex flex-col">
      {/* Header */}
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
                <h1 className="font-serif text-xl sm:text-2xl text-ink">Event Graph</h1>
                <p className="text-sm text-ink-2">Explore connections between historical events</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <LayoutSelector value={layout} onChange={setLayout} />
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`px-3 py-1.5 rounded-sm text-sm font-medium transition-colors ${
                  showFilters ? "bg-navy text-on-accent" : "border border-line bg-paper hover:border-bronze"
                }`}
              >
                {showFilters ? "Hide Filters" : "Show Filters"} ({graph?.metadata.filteredEvents || 0} events)
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Filters Panel */}
        {showFilters && (
          <aside className="w-72 sm:w-80 border-r border-line bg-paper-2 p-4 overflow-y-auto flex-shrink-0">
            <GraphFiltersPanel
              filters={filters}
              onChange={handleFilterChange}
              availableThemes={graph?.metadata.themes || []}
              availableCountries={graph?.metadata.countries || []}
              availableLayouts={["force", "time", "geo"] as const}
              currentLayout={layout}
              onLayoutChange={setLayout}
            />
          </aside>
        )}

        {/* Graph Canvas */}
        <div className="flex-1 relative min-w-0">
          {graph && (
            <EventGraph
              initialNodes={graph.nodes}
              initialEdges={graph.edges}
              layout={layout}
              onLayoutChange={setLayout}
              onNodeSelect={handleNodeSelect}
              selectedNodeId={selectedEventId}
              filters={filters}
              onFiltersChange={handleFilterChange}
              availableThemes={graph.metadata.themes}
              availableCountries={graph.metadata.countries}
              onCreateJourney={handleCreateJourney}
            />
          )}
        </div>

        {/* Selected Event Detail Panel */}
        {selectedEventId && graph && (
          <aside className="w-80 border-l border-line bg-paper-2 p-4 overflow-y-auto flex-shrink-0">
            <EventDetailPanel
              event={graph.nodes.find(n => n.id === selectedEventId)!.event}
              onClose={() => setSelectedEventId(null)}
              onCreateJourney={(ids) => handleCreateJourney(ids)}
            />
          </aside>
        )}
      </div>
    </div>
  );
}

function LayoutSelector({ value, onChange }: { value: "force" | "time" | "geo"; onChange: (v: "force" | "time" | "geo") => void }) {
  const labels: Record<"force" | "time" | "geo", string> = {
    force: "Force-Directed",
    time: "Timeline",
    geo: "Geographic",
  };

  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value as "force" | "time" | "geo")}
      className="px-3 py-1.5 rounded-sm border border-line bg-paper text-sm focus:outline-none focus:ring-2 focus:ring-bronze"
      aria-label="Graph layout"
    >
      <option value="force">{labels.force}</option>
      <option value="time">{labels.time}</option>
      <option value="geo">{labels.geo}</option>
    </select>
  );
}

function GraphFiltersPanel({
  filters,
  onChange,
  availableThemes,
  availableCountries,
  availableLayouts,
  currentLayout,
  onLayoutChange,
}: {
  filters: GraphFilters;
  onChange: (f: GraphFilters) => void;
  availableThemes: string[];
  availableCountries: string[];
  availableLayouts: ("force" | "time" | "geo")[];
  currentLayout: "force" | "time" | "geo";
  onLayoutChange: (l: "force" | "time" | "geo") => void;
}) {
  return (
    <div className="space-y-4">
      {/* Layout Selector */}
      <div>
        <label className="block text-sm font-medium text-ink-2 mb-2">Layout</label>
        <div className="flex gap-1">
          {availableLayouts.map(l => (
            <button
              key={l}
              onClick={() => onLayoutChange(l)}
              className={`flex-1 px-3 py-1.5 rounded-sm text-sm font-medium transition-colors ${
                currentLayout === l
                  ? "bg-navy text-on-accent"
                  : "border border-line bg-paper hover:border-bronze"
              }`}
            >
              {l.charAt(0).toUpperCase() + l.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div>
        <label className="block text-sm font-medium text-ink-2 mb-1">Search Events</label>
        <input
          type="text"
          placeholder="Event name, ID, person, theme..."
          value={filters.search || ""}
          onChange={e => onChange({ ...filters, search: e.target.value })}
          className="w-full px-3 py-2 rounded-sm border border-line bg-paper text-sm"
        />
      </div>

      {/* Time Range */}
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
        {filters.timeRange && (
          <button
            onClick={() => onChange({ ...filters, timeRange: undefined })}
            className="text-xs text-bronze hover:underline mt-1"
          >
            Clear time range
          </button>
        )}
      </div>

      {/* Themes */}
      <div>
        <label className="block text-sm font-medium text-ink-2 mb-1">Themes</label>
        <div className="flex flex-wrap gap-1.5">
          {availableThemes.map(theme => (
            <FilterChip
              key={theme}
              label={theme}
              selected={filters.themes?.includes(theme) || false}
              onClick={() => onChange({
                ...filters,
                themes: filters.themes?.includes(theme)
                  ? filters.themes.filter(t => t !== theme)
                  : [...(filters.themes || []), theme]
              })}
            />
          ))}
        </div>
      </div>

      {/* Countries */}
      <div>
        <label className="block text-sm font-medium text-ink-2 mb-1">Countries</label>
        <div className="flex flex-wrap gap-1.5">
          {availableCountries.map(country => (
            <FilterChip
              key={country}
              label={country}
              selected={filters.countries?.includes(country) || false}
              onClick={() => onChange({
                ...filters,
                countries: filters.countries?.includes(country)
                  ? filters.countries.filter(c => c !== country)
                  : [...(filters.countries || []), country]
              })}
            />
          ))}
        </div>
      </div>

      {/* Connection Types */}
      <div>
        <label className="block text-sm font-medium text-ink-2 mb-1">Connection Types</label>
        <div className="space-y-1.5">
          {[
            { value: "causal" as const, label: "Causal", color: "#10b981" },
            { value: "temporal" as const, label: "Temporal", color: "#6b7280" },
            { value: "thematic" as const, label: "Thematic", color: "#f59e0b" },
            { value: "geographic" as const, label: "Geographic", color: "#3b82f6" },
            { value: "person" as const, label: "Person", color: "#8b5cf6" },
          ].map(conn => (
            <label key={conn.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.connectionTypes?.includes(conn.value) ?? true}
                onChange={e => onChange({
                  ...filters,
                  connectionTypes: e.target.checked
                    ? [...(filters.connectionTypes || []), conn.value]
                    : (filters.connectionTypes || []).filter(c => c !== conn.value)
                })}
                className="rounded border-line"
              />
              <span className="w-3 h-3 rounded" style={{ background: conn.color }} />
              <span className="text-sm text-ink">{conn.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Clear Filters */}
      {Object.keys(filters).some(k => {
        const v = filters[k as keyof GraphFilters];
        return Array.isArray(v) ? v.length > 0 : v !== undefined && v !== "";
      }) && (
        <button
          onClick={() => onChange({})}
          className="w-full text-sm text-bronze hover:underline"
        >
          Clear All Filters
        </button>
      )}
    </div>
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

function EventDetailPanel({
  event,
  onClose,
  onCreateJourney,
}: {
  event: any;
  onClose: () => void;
  onCreateJourney: (ids: string[]) => void;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-start justify-between mb-4">
        <h2 className="font-serif text-lg text-ink">{event.title.en}</h2>
        <button onClick={onClose} className="text-ink-2 hover:text-bronze">✕</button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-ink-2">
          <span className="font-medium">Date:</span>
          <span>{event.when.start}{event.when.end && event.when.start !== event.when.end ? ` – ${event.when.end}` : ""}</span>
        </div>
        {event.placeId && (
          <div className="flex items-center gap-2 text-sm text-ink-2">
            <span className="font-medium">Place:</span>
            <span>{event.placeId}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-sm text-ink-2">
          <span className="font-medium">Themes:</span>
          <div className="flex flex-wrap gap-1">
            {event.themes.map((t: string) => (
              <span key={t} className="px-2 py-0.5 text-xs bg-navy text-on-accent rounded">{t}</span>
            ))}
          </div>
        </div>
        {event.people.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-ink-2">
            <span className="font-medium">People:</span>
            <span>{event.people.join(", ")}</span>
          </div>
        )}

        <div className="pt-2 border-t border-line">
          <a
            href={`/explore?event=${event.id}`}
            className="block px-3 py-2 bg-navy text-on-accent rounded-sm text-center text-sm font-medium hover:opacity-90"
            target="_blank"
            rel="noopener noreferrer"
          >
            Explore Event →
          </a>
        </div>

        <div className="pt-2">
          <button
            className="w-full px-3 py-2 border border-line rounded-sm text-sm font-medium text-bronze hover:bg-paper-3"
            onClick={() => onCreateJourney([event.id])}
          >
            Create Journey from This Event
          </button>
        </div>
      </div>
    </div>
  );
}