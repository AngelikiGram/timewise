"use client";

import { useMemo, useCallback, useRef, useEffect, useState } from "react";
import {
  Node,
  Edge,
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  NodeTypes,
  EdgeTypes,
  Handle,
  Position,
  EdgeProps,
  ReactFlowInstance,
} from "reactflow";
import "reactflow/dist/style.css";
import type { HistoricalEvent } from "@timewise/historical-schemas";
import { eventsByDate, placeById } from "@/lib/collection";
import Link from "next/link";

interface EventGraphNodeData {
  event: HistoricalEvent;
  label: string;
  themes: string[];
  date: string;
  place?: string;
  country?: string;
  people: string[];
}

interface EventGraphEdgeData {
  type: "causal" | "temporal" | "thematic" | "geographic" | "person";
  confidence: "explicit" | "plausible" | "speculative";
  label?: string;
  sourceClaimIds?: string[];
  weight: number;
}

// Input node type from event-graph.ts
interface GraphNode {
  id: string;
  type: "event";
  label: string;
  event: HistoricalEvent;
  themes: string[];
  date: string;
  place?: string;
  country?: string;
  people: string[];
  x?: number;
  y?: number;
}

// Input edge type from event-graph.ts
interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: "causal" | "temporal" | "thematic" | "geographic" | "person";
  confidence: "explicit" | "plausible" | "speculative";
  label?: string;
  sourceClaimIds?: string[];
  weight: number;
}

const NODE_WIDTH = 280;
const NODE_HEIGHT = 140;

// Convert GraphNode to ReactFlow Node
function toEventNode(gn: GraphNode): Node<EventGraphNodeData, "eventNode"> {
  return {
    id: gn.id,
    type: "eventNode",
    position: { x: gn.x || 0, y: gn.y || 0 },
    data: {
      event: gn.event,
      label: gn.label,
      themes: gn.themes,
      date: gn.date,
      place: gn.place,
      country: gn.country,
      people: gn.people,
    },
  };
}

// Convert GraphEdge to ReactFlow Edge
function toEventEdge(ge: GraphEdge): Edge<EventGraphEdgeData> {
  return {
    id: ge.id,
    source: ge.source,
    target: ge.target,
    type: ge.type,
    data: {
      type: ge.type,
      confidence: ge.confidence,
      label: ge.label,
      sourceClaimIds: ge.sourceClaimIds,
      weight: ge.weight,
    },
    style: getEdgeStyle(ge.type),
  };
}

function getEdgeStyle(type: string) {
  switch (type) {
    case "causal":
      return { strokeWidth: 2, stroke: "#10b981", strokeDasharray: "0" };
    case "temporal":
      return { strokeWidth: 1.5, stroke: "#6b7280", strokeDasharray: "5,5" };
    case "thematic":
      return { strokeWidth: 1, stroke: "#f59e0b", strokeDasharray: "2,4" };
    case "geographic":
      return { strokeWidth: 1.5, stroke: "#3b82f6", strokeDasharray: "8,4" };
    case "person":
      return { strokeWidth: 1.5, stroke: "#8b5cf6", strokeDasharray: "4,2" };
    default:
      return { strokeWidth: 1, stroke: "#9ca3af" };
  }
}

function CausalEdge(props: EdgeProps<EventGraphEdgeData>) {
  return (
    <path
      style={{ strokeWidth: 2, stroke: "#10b981", fill: "none", strokeDasharray: "0" }}
      markerEnd="url(#arrowhead-causal)"
    />
  );
}

function TemporalEdge(props: EdgeProps<EventGraphEdgeData>) {
  return (
    <path
      style={{ strokeWidth: 1.5, stroke: "#6b7280", fill: "none", strokeDasharray: "5,5" }}
      markerEnd="url(#arrowhead-temporal)"
    />
  );
}

function ThematicEdge(props: EdgeProps<EventGraphEdgeData>) {
  return (
    <path
      style={{ strokeWidth: 1, stroke: "#f59e0b", fill: "none", strokeDasharray: "2,4" }}
    />
  );
}

function GeographicEdge(props: EdgeProps<EventGraphEdgeData>) {
  return (
    <path
      style={{ strokeWidth: 1.5, stroke: "#3b82f6", fill: "none", strokeDasharray: "8,4" }}
    />
  );
}

function PersonEdge(props: EdgeProps<EventGraphEdgeData>) {
  return (
    <path
      style={{ strokeWidth: 1.5, stroke: "#8b5cf6", fill: "none", strokeDasharray: "4,2" }}
    />
  );
}

const edgeTypes: EdgeTypes = {
  causal: CausalEdge,
  temporal: TemporalEdge,
  thematic: ThematicEdge,
  geographic: GeographicEdge,
  person: PersonEdge,
};

function EventNodeComponent({
  data,
  selected = false,
  onClick,
}: {
  data: EventGraphNodeData;
  selected?: boolean;
  onClick?: (id: string) => void;
}) {
  const { event, label, themes, date, place, country, people } = data;

  return (
    <div
      className={`event-node ${selected ? "selected" : ""}`}
      style={{ width: NODE_WIDTH, height: NODE_HEIGHT }}
      onClick={() => onClick?.(event.id)}
    >
      <Handle type="target" position={Position.Top} className="handle-top" id="top" />
      <Handle type="source" position={Position.Right} className="handle-right" id="right" />
      <Handle type="source" position={Position.Bottom} className="handle-bottom" id="bottom" />
      <Handle type="target" position={Position.Left} className="handle-left" id="left" />

      <div className="node-header">
        <span className="node-date">{formatDate(date)}</span>
        <span className="node-themes">
          {themes.slice(0, 3).map(t => (
            <span key={t} className="theme-badge">{t}</span>
          ))}
          {themes.length > 3 && <span className="theme-badge">+{themes.length - 3}</span>}
        </span>
      </div>
      <h3 className="node-title">{label}</h3>
      {(place || country) && (
        <p className="node-place">📍 {place || country}</p>
      )}
      {people.length > 0 && (
        <p className="node-people">👤 {people.slice(0, 2).join(", ")}{people.length > 2 ? ` +${people.length - 2}` : ""}</p>
      )}
      <div className="node-footer">
        <span className="node-id">{event.id}</span>
        <Link href={`/explore?event=${event.id}`} className="node-link" target="_blank" rel="noopener noreferrer">
          Explore
        </Link>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!m || !d) return y.toString();
  return `${d} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]} ${y}`;
}

interface EventGraphProps {
  initialNodes: GraphNode[];
  initialEdges: GraphEdge[];
  layout: "force" | "time" | "geo";
  onLayoutChange: (layout: "force" | "time" | "geo") => void;
  onNodeSelect: (nodeId: string | null) => void;
  selectedNodeId: string | null;
  filters: {
    connectionTypes?: ("causal" | "temporal" | "thematic" | "geographic" | "person")[];
    search?: string;
  };
  onFiltersChange: (filters: any) => void;
  availableThemes: string[];
  availableCountries: string[];
  onCreateJourney: (eventIds: string[]) => void;
}

export function EventGraph({
  initialNodes,
  initialEdges,
  layout,
  onLayoutChange,
  onNodeSelect,
  selectedNodeId,
  filters,
  onFiltersChange,
  availableThemes,
  availableCountries,
  onCreateJourney,
}: EventGraphProps) {
  // Convert GraphNode[] to ReactFlow Node[] for ReactFlow
  const convertedInitialNodes = useMemo(() => initialNodes.map(toEventNode), [initialNodes]);
  const convertedInitialEdges = useMemo(() => initialEdges.map(toEventEdge), [initialEdges]);

  const [nodes, setNodes, onNodesChange] = useNodesState(convertedInitialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(convertedInitialEdges);
  const [showFilters, setShowFilters] = useState(true);
  const [connectionTypes, setConnectionTypes] = useState(
    filters.connectionTypes || ["causal", "temporal", "thematic", "geographic", "person"]
  );
  const reactFlowRef = useRef<any>(null);

  useEffect(() => {
    setNodes(convertedInitialNodes);
  }, [convertedInitialNodes, setNodes]);

  useEffect(() => {
    setEdges(convertedInitialEdges);
  }, [convertedInitialEdges, setEdges]);

  useEffect(() => {
    setConnectionTypes(filters.connectionTypes || ["causal", "temporal", "thematic", "geographic", "person"]);
  }, [filters.connectionTypes]);

  const filteredNodes = useMemo(() => {
    if (!filters.search) return nodes;
    const search = filters.search.toLowerCase();
    return nodes.filter(node =>
      node.data.label.toLowerCase().includes(search) ||
      node.data.event.id.toLowerCase().includes(search) ||
      node.data.people.some(p => p.toLowerCase().includes(search)) ||
      node.data.themes.some(t => t.toLowerCase().includes(search))
    );
  }, [nodes, filters.search]);

  const filteredEdges = useMemo(() => {
    if (!connectionTypes.length) return edges;
    const allowedTypes = new Set(connectionTypes);
    return edges.filter(edge => edge.data && allowedTypes.has(edge.data.type));
  }, [edges, connectionTypes]);

  const handleConnect = useCallback((connection: Connection) => {
    setEdges(eds => addEdge({
      ...connection,
      type: "thematic",
      data: { type: "thematic", confidence: "speculative", weight: 1 },
      style: { strokeWidth: 1, stroke: "#f59e0b", strokeDasharray: "2,4" },
    }, eds));
  }, [setEdges]);

  const handleNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    onNodeSelect(node.id === selectedNodeId ? null : node.id);
  }, [onNodeSelect, selectedNodeId]);

  const handleConnectionTypeChange = useCallback((type: string, checked: boolean) => {
    const newTypes = checked
      ? [...connectionTypes, type]
      : connectionTypes.filter(t => t !== type);
    setConnectionTypes(newTypes);
    onFiltersChange({ ...filters, connectionTypes: newTypes });
  }, [connectionTypes, filters, onFiltersChange]);

  const handleFitView = useCallback(() => {
    reactFlowRef.current?.fitView({ padding: 0.1, duration: 300 });
  }, []);

  return (
    <div className="flex h-dvh flex-col bg-paper">
      <header className="border-b border-line bg-paper-2 sticky top-0 z-10">
        <div className="max-w-full mx-auto px-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 py-3">
            <div className="flex items-center gap-4">
              <Link href="/learn" className="p-2 text-ink-2 hover:text-bronze transition-colors" aria-label="Back to Learning Hub">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </Link>
              <div>
                <h1 className="font-serif text-xl sm:text-2xl text-ink">Event Graph</h1>
                <p className="text-sm text-ink-2">Explore connections between historical events</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <LayoutSelector value={layout} onChange={onLayoutChange} />
              <button
                onClick={handleFitView}
                className="px-3 py-1.5 rounded-sm border border-line bg-paper text-sm hover:border-bronze"
                title="Fit view"
              >
                Fit view
              </button>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`px-3 py-1.5 rounded-sm text-sm font-medium transition-colors ${
                  showFilters ? "bg-navy text-on-accent" : "border border-line bg-paper hover:border-bronze"
                }`}
              >
                {showFilters ? "Hide Filters" : "Show Filters"} ({filteredNodes.length}/{nodes.length})
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {showFilters && (
          <aside className="w-72 sm:w-80 border-r border-line bg-paper-2 p-4 overflow-y-auto flex-shrink-0">
            <GraphFiltersPanel
              filters={{ ...filters, connectionTypes }}
              onChange={onFiltersChange}
              availableThemes={availableThemes}
              availableCountries={availableCountries}
              onConnectionTypeChange={handleConnectionTypeChange}
            />
          </aside>
        )}

        <div className="flex-1 relative min-w-0">
          <ReactFlow
            ref={reactFlowRef}
            nodes={filteredNodes}
            edges={filteredEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={handleConnect}
            nodeTypes={{ eventNode: EventNodeComponent }}
            edgeTypes={edgeTypes}
            fitView={false}
            attributionPosition="bottom-left"
            onNodeClick={handleNodeClick}
          >
            <Background
              color="#9ca3af"
              gap={20}
              size={1}
              style={{ opacity: 0.15 }}
            />
            <Controls />
            <MiniMap
              nodeColor="#10b981"
              nodeBorderRadius={4}
              maskColor="rgba(0,0,0,0.1)"
            />
            <defs>
              <marker id="arrowhead-causal" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
                <path d="M0,0 L0,6 L9,3 z" fill="#10b981" />
              </marker>
              <marker id="arrowhead-temporal" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
                <path d="M0,0 L0,6 L9,3 z" fill="#6b7280" />
              </marker>
            </defs>
          </ReactFlow>

          <div className="absolute bottom-4 left-4 bg-paper-2 border border-line rounded-lg p-3 text-xs z-10">
            <div className="font-semibold mb-2">Connection Types</div>
            <div className="flex flex-col gap-1.5">
              <LegendItem color="#10b981" dash="solid" label="Causal (explicit)" />
              <LegendItem color="#6b7280" dash="5,5" label="Temporal (sequence)" />
              <LegendItem color="#f59e0b" dash="2,4" label="Thematic (shared theme)" />
              <LegendItem color="#3b82f6" dash="8,4" label="Geographic (same place)" />
              <LegendItem color="#8b5cf6" dash="4,2" label="Person (shared figure)" />
            </div>
          </div>
        </div>
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
  onConnectionTypeChange,
}: {
  filters: any;
  onChange: (f: any) => void;
  availableThemes: string[];
  availableCountries: string[];
  onConnectionTypeChange: (type: string, checked: boolean) => void;
}) {
  return (
    <div className="space-y-4">
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
                onChange={e => onConnectionTypeChange(conn.value, e.target.checked)}
                className="rounded border-line"
              />
              <span className="w-3 h-3 rounded" style={{ background: conn.color }} />
              <span className="text-sm text-ink">{conn.label}</span>
            </label>
          ))}
        </div>
      </div>

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
          {availableCountries.map(country => (
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

      {Object.keys(filters).some(k => {
        const v = filters[k];
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

function LegendItem({ color, dash, label }: { color: string; dash: string; label: string }) {
  const dashArray = dash === "solid" ? "none" : dash;
  return (
    <div className="flex items-center gap-2">
      <svg width="24" height="4" style={{ display: "block" }}>
        <line x1="0" y1="2" x2="24" y2="2" stroke={color} strokeWidth="2" strokeDasharray={dashArray} />
      </svg>
      <span className="text-ink">{label}</span>
    </div>
  );
}