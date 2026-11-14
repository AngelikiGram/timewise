"use client";

import type { HistoricalEvent, Claim, Source, Place } from "@timewise/historical-schemas";
import { eventsByDate, eventById, placeById, claimsFor, collection } from "@/lib/collection";

export interface GraphNode {
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

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: "causal" | "temporal" | "thematic" | "geographic" | "person";
  confidence: "explicit" | "plausible" | "speculative";
  label?: string;
  sourceClaimIds?: string[];
  weight: number;
}

export interface GraphFilters {
  timeRange?: [string, string];
  themes?: string[];
  countries?: string[];
  connectionTypes?: ("causal" | "temporal" | "thematic" | "geographic" | "person")[];
  search?: string;
  eventIds?: string[];
}

export interface EventGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata: {
    totalEvents: number;
    filteredEvents: number;
    dateRange: [string, string];
    themes: string[];
    countries: string[];
  };
}

/**
 * Build a graph from all events with optional filters
 */
export function buildEventGraph(filters: GraphFilters = {}): EventGraph {
  let events = eventsByDate;

  // Apply event ID filter first (for journey-generated graphs)
  if (filters.eventIds && filters.eventIds.length > 0) {
    events = events.filter(e => filters.eventIds!.includes(e.id));
  }

  // Apply time range filter
  if (filters.timeRange) {
    const [start, end] = filters.timeRange;
    events = events.filter(e => {
      const eventDate = new Date(e.when.start).getTime();
      return eventDate >= new Date(start).getTime() && eventDate <= new Date(end).getTime();
    });
  }

  // Apply theme filter
  if (filters.themes && filters.themes.length > 0) {
    events = events.filter(e => filters.themes!.some(t => e.themes.includes(t)));
  }

  // Apply country filter
  if (filters.countries && filters.countries.length > 0) {
    events = events.filter(e => {
      if (!e.placeId) return false;
      const place = placeById.get(e.placeId);
      return place && filters.countries!.includes(place.modernCountry);
    });
  }

  // Apply search filter
  if (filters.search) {
    const search = filters.search.toLowerCase();
    events = events.filter(e =>
      e.title.en.toLowerCase().includes(search) ||
      e.id.toLowerCase().includes(search) ||
      e.people.some(p => p.toLowerCase().includes(search)) ||
      e.themes.some(t => t.toLowerCase().includes(search))
    );
  }

  // Build nodes
  const nodes: GraphNode[] = events.map(event => {
    const place = event.placeId ? placeById.get(event.placeId) : undefined;
    return {
      id: event.id,
      type: "event" as const,
      label: event.title.en,
      event,
      themes: [...new Set(event.themes)],
      date: event.when.start,
      place: place?.label.en,
      country: place?.modernCountry,
      people: event.people,
    };
  });

  // Build edges
  const edges: GraphEdge[] = [];
  const allowedTypes = filters.connectionTypes || ["causal", "temporal", "thematic", "geographic", "person"];

  events.forEach((event, i) => {
    const claims = claimsFor(event.id);

    // Temporal edges: connect to nearby events in time
    if (allowedTypes.includes("temporal")) {
      const nearby = events.slice(Math.max(0, i - 3), i);
      nearby.forEach(prev => {
        const daysDiff = (new Date(event.when.start).getTime() - new Date(prev.when.start).getTime()) / (1000 * 60 * 60 * 24);
        if (daysDiff <= 365 * 3) { // Within 3 years
          edges.push({
            id: `temporal-${prev.id}-${event.id}`,
            source: prev.id,
            target: event.id,
            type: "temporal",
            confidence: daysDiff <= 30 ? "explicit" : daysDiff <= 180 ? "plausible" : "speculative",
            label: `${Math.round(daysDiff)} days`,
            weight: Math.max(1, 10 - daysDiff / 36.5),
          });
        }
      });
    }

    // Thematic edges: shared themes
    if (allowedTypes.includes("thematic")) {
      events.slice(i + 1).forEach(other => {
        const sharedThemes = event.themes.filter(t => other.themes.includes(t));
        if (sharedThemes.length > 0) {
          edges.push({
            id: `thematic-${event.id}-${other.id}`,
            source: event.id,
            target: other.id,
            type: "thematic",
            confidence: sharedThemes.length > 1 ? "plausible" : "speculative",
            label: sharedThemes.join(", "),
            weight: sharedThemes.length,
          });
        }
      });
    }

    // Geographic edges: same place
    if (allowedTypes.includes("geographic") && event.placeId) {
      const samePlace = events.filter(e => e.id !== event.id && e.placeId === event.placeId);
      samePlace.forEach(other => {
        edges.push({
          id: `geo-${event.id}-${other.id}`,
          source: event.id,
          target: other.id,
          type: "geographic",
          confidence: "explicit",
          label: placeById.get(event.placeId!)?.label.en || "Same location",
          weight: 5,
        });
      });
    }

    // Person edges: shared people
    if (allowedTypes.includes("person") && event.people.length > 0) {
      const samePerson = events.filter(e =>
        e.id !== event.id && e.people.some(p => event.people.includes(p))
      );
      samePerson.forEach(other => {
        const sharedPeople = event.people.filter(p => other.people.includes(p));
        edges.push({
          id: `person-${event.id}-${other.id}`,
          source: event.id,
          target: other.id,
          type: "person",
          confidence: sharedPeople.length > 1 ? "plausible" : "speculative",
          label: sharedPeople.join(", "),
          weight: sharedPeople.length * 2,
        });
      });
    }

    // Causal edges: based on claims
    if (allowedTypes.includes("causal")) {
      // For now, add plausible causal links based on temporal proximity and thematic overlap
      events.slice(i + 1).forEach(other => {
        const sharedThemes = event.themes.filter(t => other.themes.includes(t));
        const daysDiff = (new Date(other.when.start).getTime() - new Date(event.when.start).getTime()) / (1000 * 60 * 60 * 24);
        if (sharedThemes.length > 0 && daysDiff > 0 && daysDiff <= 365) {
          edges.push({
            id: `causal-${event.id}-${other.id}`,
            source: event.id,
            target: other.id,
            type: "causal",
            confidence: "plausible",
            label: `Possible causal link (${sharedThemes[0]})`,
            weight: 3,
          });
        }
      });
    }
  });

  // Deduplicate edges (keep highest weight)
  const edgeMap = new Map<string, GraphEdge>();
  edges.forEach(edge => {
    const key = `${edge.source}-${edge.target}-${edge.type}`;
    const existing = edgeMap.get(key);
    if (!existing || edge.weight > existing.weight) {
      edgeMap.set(key, edge);
    }
  });

  const uniqueEdges = Array.from(edgeMap.values());

  // Filter edges by allowed connection types
  const filteredEdges = uniqueEdges.filter(e => allowedTypes.includes(e.type));

  // Calculate metadata
  const allThemes = [...new Set(events.flatMap(e => e.themes))].sort();
  const allCountries = [...new Set(
    events
      .map(e => e.placeId)
      .filter((p): p is string => Boolean(p))
      .map(p => placeById.get(p)?.modernCountry)
      .filter((c): c is string => Boolean(c))
  )].sort();

  const dateRange: [string, string] = events.length > 0
    ? [events[0].when.start, events[events.length - 1].when.start]
    : ["", ""];

  return {
    nodes,
    edges: filteredEdges,
    metadata: {
      totalEvents: eventsByDate.length,
      filteredEvents: events.length,
      dateRange,
      themes: allThemes,
      countries: allCountries,
    },
  };
}

/**
 * Get subgraph for a specific event (ego network)
 */
export function getEventSubgraph(eventId: string, depth: number = 1): EventGraph {
  const fullGraph = buildEventGraph();
  const visited = new Set<string>([eventId]);
  const currentLevel = [eventId];

  for (let d = 0; d < depth; d++) {
    const nextLevel: string[] = [];
    fullGraph.edges.forEach(edge => {
      if (currentLevel.includes(edge.source) && !visited.has(edge.target)) {
        visited.add(edge.target);
        nextLevel.push(edge.target);
      }
      if (currentLevel.includes(edge.target) && !visited.has(edge.source)) {
        visited.add(edge.source);
        nextLevel.push(edge.source);
      }
    });
    currentLevel.length = 0;
    currentLevel.push(...nextLevel);
  }

  const subNodes = fullGraph.nodes.filter(n => visited.has(n.id));
  const subEdges = fullGraph.edges.filter(e => visited.has(e.source) && visited.has(e.target));

  return {
    nodes: subNodes,
    edges: subEdges,
    metadata: {
      totalEvents: fullGraph.metadata.totalEvents,
      filteredEvents: subNodes.length,
      dateRange: fullGraph.metadata.dateRange,
      themes: fullGraph.metadata.themes,
      countries: fullGraph.metadata.countries,
    },
  };
}

/**
 * Get path between two events
 */
export function getPathBetween(sourceId: string, targetId: string): GraphEdge[] {
  const graph = buildEventGraph();
  const adj = new Map<string, GraphEdge[]>();

  graph.edges.forEach(edge => {
    if (!adj.has(edge.source)) adj.set(edge.source, []);
    adj.get(edge.source)!.push(edge);
    if (!adj.has(edge.target)) adj.set(edge.target, []);
    adj.get(edge.target)!.push({ ...edge, source: edge.target, target: edge.source });
  });

  // BFS
  const queue: { node: string; path: GraphEdge[] }[] = [{ node: sourceId, path: [] }];
  const visited = new Set<string>([sourceId]);

  while (queue.length > 0) {
    const { node, path } = queue.shift()!;
    if (node === targetId) return path;

    const neighbors = adj.get(node) || [];
    for (const edge of neighbors) {
      if (!visited.has(edge.target)) {
        visited.add(edge.target);
        queue.push({ node: edge.target, path: [...path, edge] });
      }
    }
  }

  return [];
}

/**
 * Apply force-directed layout positions to nodes
 */
export function applyForceLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  width: number = 1400,
  height: number = 800,
  iterations: number = 100
): GraphNode[] {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const k = Math.sqrt((width * height) / nodes.length); // Optimal distance

  // Initialize positions randomly if not set
  nodes.forEach((node, i) => {
    if (node.x === undefined || node.y === undefined) {
      node.x = 100 + (i % 10) * 130;
      node.y = 100 + Math.floor(i / 10) * 100;
    }
  });

  for (let iter = 0; iter < iterations; iter++) {
    const displacement = new Map<string, { x: number; y: number }>();

    // Repulsion between all nodes
    nodes.forEach(nodeA => {
      nodes.forEach(nodeB => {
        if (nodeA.id === nodeB.id) return;
        const dx = nodeA.x! - nodeB.x!;
        const dy = nodeA.y! - nodeB.y!;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (k * k) / dist;
        const dispX = (dx / dist) * force;
        const dispY = (dy / dist) * force;

        const currA = displacement.get(nodeA.id) || { x: 0, y: 0 };
        displacement.set(nodeA.id, { x: currA.x + dispX, y: currA.y + dispY });
      });
    });

    // Attraction along edges
    edges.forEach(edge => {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      if (!source || !target) return;

      const dx = target.x! - source.x!;
      const dy = target.y! - source.y!;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = (dist * dist) / k * (edge.weight / 5);
      const dispX = (dx / dist) * force;
      const dispY = (dy / dist) * force;

      const currS = displacement.get(source.id) || { x: 0, y: 0 };
      displacement.set(source.id, { x: currS.x - dispX, y: currS.y - dispY });

      const currT = displacement.get(target.id) || { x: 0, y: 0 };
      displacement.set(target.id, { x: currT.x + dispX, y: currT.y + dispY });
    });

    // Apply displacements with cooling
    const cooling = 1 - iter / iterations;
    nodes.forEach(node => {
      const disp = displacement.get(node.id);
      if (disp) {
        node.x! += disp.x * cooling * 0.1;
        node.y! += disp.y * cooling * 0.1;

        // Keep in bounds
        node.x = Math.max(50, Math.min(width - 50, node.x!));
        node.y = Math.max(50, Math.min(height - 50, node.y!));
      }
    });
  }

  return nodes;
}

/**
 * Apply timeline layout (chronological)
 */
export function applyTimelineLayout(nodes: GraphNode[], width: number = 1400, height: number = 800): GraphNode[] {
  if (nodes.length === 0) return nodes;

  const dates = nodes.map(n => new Date(n.date).getTime());
  const minDate = Math.min(...dates);
  const maxDate = Math.max(...dates);
  const range = maxDate - minDate || 1;

  nodes.forEach((node, i) => {
    const date = new Date(node.date).getTime();
    const ratio = (date - minDate) / range;
    node.x = 100 + ratio * (width - 200);
    node.y = 100 + (i % 8) * (height - 200) / 8;
  });

  return nodes;
}

/**
 * Apply geographic layout
 */
export function applyGeoLayout(nodes: GraphNode[], width: number = 1400, height: number = 800): GraphNode[] {
  // Simple geographic clustering by country
  const countryGroups = new Map<string, GraphNode[]>();
  nodes.forEach(node => {
    const country = node.country || "Unknown";
    if (!countryGroups.has(country)) countryGroups.set(country, []);
    countryGroups.get(country)!.push(node);
  });

  const countries = Array.from(countryGroups.keys());
  const cols = Math.ceil(Math.sqrt(countries.length));
  const rows = Math.ceil(countries.length / cols);
  const cellW = (width - 200) / cols;
  const cellH = (height - 200) / rows;

  let col = 0, row = 0;
  countryGroups.forEach((countryNodes, country) => {
    const xBase = 100 + col * cellW;
    const yBase = 100 + row * cellH;
    countryNodes.forEach((node, i) => {
      node.x = xBase + (i % 5) * (cellW / 5);
      node.y = yBase + Math.floor(i / 5) * (cellH / 5);
    });
    col++;
    if (col >= cols) { col = 0; row++; }
  });

  return nodes;
}