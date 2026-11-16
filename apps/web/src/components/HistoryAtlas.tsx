"use client";

import type { ExpressionSpecification, GeoJSONSource, Map as MapLibreMap, Popup } from "maplibre-gl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { collection, eventsByDate, formatWhen } from "@/lib/collection";
import { dedupe, type MergedRef } from "@/lib/dedupe";
import { fold } from "@/lib/search";
import { useAppearance, type Appearance } from "./ThemeToggle";
import { applyBasemapPalette, PALETTE, STYLE_URL } from "./AtlasMap";
import { SiteHeader } from "./SiteHeader";
import { EventStory } from "./EventStory";
import { Meanwhile } from "./Meanwhile";
import { CATEGORY_COLORS, CATEGORY_GLYPH, CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/categories";
import { byDate, centuryLabel, centuryOf, formatImportedDate, formatYear, yearOf } from "@/lib/dates";
import { remember } from "@/lib/recent";
import { markExplored } from "@/lib/progress";
import { asset } from "@/lib/paths";

export type Region = { id: string; label: { en: string }; note?: string; imported: number; bbox?: number[] | null; kind?: string; continent?: string | null };

const regionDataCache = new Map<string, { events: Item[]; total: number | null }>();
const boundaryCache = new Map<string, GeoJSON.Geometry | null>();

/** Where the atlas opens: the region's main territory, or the whole world. */
function frame(m: MapLibreMap, region: Region, animate: boolean) {
  const b = region.bbox;
  if (b && b.length === 4) m.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 40, maxZoom: 7, animate });
  else m.jumpTo({ center: [14.2, 30], zoom: 1.3 });
}

type Item = {
  id: string; title: { en: string; de?: string }; description?: string; category: string; start: string; end?: string;
  precision: "day" | "month" | "year" | "decade" | "century"; conflict?: boolean; lng?: number; lat?: number; loc?: "event" | "place" | "area"; url: string;
  /** Number of Wikipedia language editions with an article: how widely documented, not how important. */
  links?: number;
  checked?: boolean;
  /** Located inside the region's present-day boundary. */
  inside?: boolean;
  /** On a continent or world map: the one country it belongs to, if any. */
  country?: string;
  /** On a country map: the country whose outline contains it. */
  home?: string;
  nc?: number;
  multi?: boolean;
  nopin?: boolean;
  titleYear?: number;
  incept?: boolean;
  /** Other records merged into this display entry (Wikidata twins, or the imported record of a checked event). */
  also?: MergedRef[];
};

/** Why a record is on a country map: it happened inside, it is tied to the country but located elsewhere, it spans several countries, or it has no location. */
export type Scope = "here" | "associated" | "multi" | "unlocated";
export const scopeOf = (e: Pick<Item, "multi" | "inside" | "lng">): Scope => (e.multi ? "multi" : e.lng === undefined ? "unlocated" : e.inside === false ? "associated" : "here");
const SCOPE_LABEL: Record<Scope, string> = { here: "Happened here", associated: "Linked, but located elsewhere", multi: "Spans several countries", unlocated: "No location" };
const SCOPE_HELP: Record<Scope, string> = {
  here: "The record’s location lies inside today’s borders.",
  associated: "Wikidata ties it to this country (often through an earlier state), but its location is outside today’s borders.",
  multi: "Wikidata ties it to five or more countries, so it isn’t pinned to one point.",
  unlocated: "Wikidata gives no location, so it can’t be placed.",
};
const LOC_LABEL: Record<string, string> = { event: "exact point", place: "at its named place", area: "centre of an area" };

const colorOf = (theme: Appearance, category: string) => CATEGORY_COLORS[theme][category] ?? PALETTE[theme].marker;
const PAGE = 80;
/** Label layers: [id, from zoom, at least this many Wikipedia languages]. */
const LABEL_TIERS: [string, number, number][] = [["h-labels-1", 4.5, 25], ["h-labels-2", 7, 8], ["h-labels-3", 9.5, 0]];
export { formatImportedDate };

const dateOf = (e: Item) => (e.checked ? formatWhen({ start: e.start, end: e.end, precision: e.precision as "day" | "month" | "year" }) : formatImportedDate(e.start, e.end, e.precision));
const spanOf = (e: Item): [number, number] => [yearOf(e.start), e.end ? yearOf(e.end) : yearOf(e.start)];

const PRESETS: { label: string; from: number; to: number }[] = [
  { label: "Antiquity", from: -3500, to: 499 },
  { label: "Middle Ages", from: 500, to: 1499 },
  { label: "1500–1800", from: 1500, to: 1799 },
  { label: "1800–1914", from: 1800, to: 1913 },
  { label: "1914–1945", from: 1914, to: 1945 },
  { label: "Since 1945", from: 1946, to: 2026 },
];

function km(a: Item, b: Item) {
  const r = Math.PI / 180;
  const x = (b.lng! - a.lng!) * r * Math.cos(((a.lat! + b.lat!) / 2) * r);
  const y = (b.lat! - a.lat!) * r;
  return Math.sqrt(x * x + y * y) * 6371;
}

function checkedAsItems(): Item[] {
  return eventsByDate.filter((e) => e.kind === "event").map((e) => {
    const place = e.placeId ? collection.places.find((p) => p.id === e.placeId) : undefined;
    return { id: e.id, title: { en: e.title.en }, description: e.summary.en, category: e.themes[0], start: e.when.start, end: e.when.end, precision: e.when.precision, lng: place?.lng, lat: place?.lat, url: `/explore?event=${e.id}`, checked: true, inside: place?.modernCountry === "AT", country: "austria" };
  });
}

function categoryColor(theme: Appearance): ExpressionSpecification {
  const pairs = Object.entries(CATEGORY_COLORS[theme]).flat();
  return ["match", ["get", "category"], ...pairs, PALETTE[theme].marker] as unknown as ExpressionSpecification;
}

/** Bucket size for the timeline, so dense stretches are summed rather than drawn on top of each other. */
function bucketFor(span: number) {
  if (span > 1200) return 100;
  if (span > 120) return 10;
  return 1;
}
const bucketOf = (y: number, size: number) => (size === 100 ? centuryOf(y) : Math.floor(y / size) * size);
function bucketLabel(b: number, size: number) {
  if (size === 100) return centuryLabel(b);
  if (size === 10) return b < 0 ? `${-b}–${-(b + 9)} BC` : `${b}s`;
  return formatYear(b);
}

export function HistoryAtlas({ region, regions }: { region: Region; regions: Region[] }) {
  const router = useRouter();
  const theme = useAppearance();
  const [imported, setImported] = useState<Item[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const byId = useMemo(() => new Map(regions.map((r) => [r.id, r])), [regions]);
  const [range, setRange] = useState<[number, number] | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [source, setSource] = useState<"all" | "checked">("all");
  const [scopes, setScopes] = useState<Scope[]>(["here"]);
  const [stack, setStack] = useState<Item[] | null>(null);
  const [inView, setInView] = useState(false);
  const [bounds, setBounds] = useState<[number, number, number, number] | null>(null);
  const [sort, setSort] = useState<"date" | "notable">("date");
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [selected, setSelected] = useState<Item | null>(null);
  const [sidebar, setSidebar] = useState(true);
  const [focus, setFocus] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [sheetFull, setSheetFull] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  // Brushing across the bars: drag to choose a span of periods at once.
  const [brush, setBrush] = useState<[number, number] | null>(null);
  const brushStart = useRef<number | null>(null);
  const brushed = useRef(false);
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const [mapState, setMapState] = useState<"loading" | "ready" | "failed">("loading");
  const [mapAttempt, setMapAttempt] = useState(0);
  const regionRef = useRef(region);
  regionRef.current = region;
  const isCountry = !region.kind;
  const isWorld = region.kind === "world";

  // Filters live in the URL, so a view can be shared and reloaded.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const from = Number(q.get("from")), to = Number(q.get("to"));
    if (q.has("from") && q.has("to") && Number.isFinite(from) && Number.isFinite(to)) setRange([Math.min(from, to), Math.max(from, to)]);
    const cats = q.get("cat")?.split(",").filter((c) => CATEGORY_LABELS[c]);
    if (cats?.length) setCategories(cats);
    const sc = q.get("scope")?.split(",").filter((x): x is Scope => x in SCOPE_LABEL);
    if (sc?.length) setScopes(sc);
    markExplored(region.id, region.label.en, region.id === "world" ? "/atlas" : `/atlas/${region.id}`);
  }, [region.id, region.label.en]);
  const hydrated = useRef(false);
  useEffect(() => {
    if (!hydrated.current) { hydrated.current = true; return; }
    const url = new URL(window.location.href);
    if (range) { url.searchParams.set("from", String(range[0])); url.searchParams.set("to", String(range[1])); }
    else { url.searchParams.delete("from"); url.searchParams.delete("to"); }
    if (categories.length) url.searchParams.set("cat", categories.join(","));
    else url.searchParams.delete("cat");
    if (scopes.length === 1 && scopes[0] === "here") url.searchParams.delete("scope");
    else url.searchParams.set("scope", scopes.join(","));
    window.history.replaceState(window.history.state, "", url);
  }, [range, categories, scopes]);
  useEffect(() => {
    setYearFrom(range ? String(range[0]) : "");
    setYearTo(range ? String(range[1]) : "");
  }, [range]);

  useEffect(() => {
    setImported(null);
    setSelected(null);
    setFailed(false);
    const cached = regionDataCache.get(region.id);
    if (cached) {
      setImported(cached.events);
      setTotal(cached.total);
      return;
    }
    fetch(asset(`/data/regions/${region.id}.json`))
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        const data = { events: d.events, total: d.total ?? null };
        regionDataCache.set(region.id, data);
        setImported(d.events);
        setTotal(d.total ?? null);
      })
      .catch(() => setFailed(true));
  }, [region.id, attempt]);

  const all = useMemo(() => {
    const checked = region.id === collection.region.id || region.id === "europe" || isWorld ? checkedAsItems() : [];
    // One entry per event: Wikidata twins and the imported records of checked events are merged, with provenance kept.
    return dedupe([...checked, ...(imported ?? [])]).sort(byDate);
  }, [imported, region.id, isWorld]);

  /** On a country map, a multi-country event is pinned only in its own country; elsewhere it is list-only. */
  const pinned = useCallback((e: Item) => e.lng !== undefined && !e.nopin && (!e.multi || (isCountry && e.home === region.id)), [isCountry, region.id]);

  const beforeRange = useMemo(() => {
    const q = fold(query.trim());
    return all.filter((e) => (source === "all" || e.checked) && (!isCountry || scopes.includes(scopeOf(e))) && (!categories.length || categories.includes(e.category)) && (!q || fold(`${e.title.en} ${e.title.de ?? ""} ${e.description ?? ""}`).includes(q)));
  }, [all, source, isCountry, scopes, categories, query]);
  const scopeCounts = useMemo(() => { const c: Record<Scope, number> = { here: 0, associated: 0, multi: 0, unlocated: 0 }; for (const e of all) c[scopeOf(e)]++; return c; }, [all]);
  const filtered = useMemo(() => {
    if (!range) return beforeRange;
    return beforeRange.filter((e) => { const [a, b] = spanOf(e); return b >= range[0] && a <= range[1]; });
  }, [beforeRange, range]);
  const listed = useMemo(() => {
    const visible = inView && bounds ? filtered.filter((e) => pinned(e) && e.lng! >= bounds[0] && e.lng! <= bounds[2] && e.lat! >= bounds[1] && e.lat! <= bounds[3]) : filtered;
    return sort === "notable" ? [...visible].sort((a, b) => (b.checked ? 1e6 : b.links ?? 0) - (a.checked ? 1e6 : a.links ?? 0)) : visible;
  }, [filtered, inView, bounds, sort, pinned]);

  // The timeline: whole extent of the filtered set, or the chosen range, cut into readable buckets.
  const extent = useMemo<[number, number] | null>(() => {
    if (!beforeRange.length) return null;
    let lo = Infinity, hi = -Infinity;
    for (const e of beforeRange) { const [a, b] = spanOf(e); lo = Math.min(lo, a); hi = Math.max(hi, b); }
    return [lo, Math.min(2026, hi)];
  }, [beforeRange]);
  const view = range ?? extent;
  const bucket = view ? bucketFor(view[1] - view[0]) : 100;
  const bars = useMemo(() => {
    if (!view) return [];
    const counts = new Map<number, Map<string, number>>();
    for (const e of range ? filtered : beforeRange) {
      const b = bucketOf(yearOf(e.start), bucket);
      const byCat = counts.get(b) ?? new Map<string, number>();
      byCat.set(e.category, (byCat.get(e.category) ?? 0) + 1);
      counts.set(b, byCat);
    }
    const out = [];
    for (let b = bucketOf(view[0], bucket); b <= view[1]; b += bucket) {
      const byCat = counts.get(b) ?? new Map<string, number>();
      out.push({ bucket: b, count: [...byCat.values()].reduce((s, n) => s + n, 0), byCat: [...byCat.entries()].sort(([a], [c]) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(c)) });
      if (out.length > 400) break;
    }
    return out;
  }, [view, bucket, range, filtered, beforeRange]);
  const maxBar = Math.max(1, ...bars.map((b) => b.count));
  /** Record marks under the bars once the range is narrow enough to tell them apart: the best documented first. */
  const marks = useMemo(() => {
    if (!view || view[1] - view[0] > 120) return [];
    const ranked = [...filtered].filter((e) => { const y = yearOf(e.start); return y >= view[0] && y <= view[1]; }).sort((a, b) => (b.checked ? 1e6 : b.links ?? 0) - (a.checked ? 1e6 : a.links ?? 0));
    const placed: { e: Item; x: number }[] = [];
    for (const e of ranked) {
      const x = Math.min(99, Math.max(1, ((yearOf(e.start) - view[0]) / Math.max(1, view[1] - view[0] + 1)) * 100));
      if (placed.some((q) => Math.abs(q.x - x) < 1.6)) continue;
      placed.push({ e, x });
      if (placed.length >= 30) break;
    }
    return placed;
  }, [view, filtered]);
  const usedCategories = useMemo(() => [...new Set(all.map((e) => e.category))].sort((a, b) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b)), [all]);
  const onMap = filtered.filter(pinned).length;

  useEffect(() => setShown(PAGE), [listed]);

  const itemsRef = useRef(new Map<string, Item>());
  useEffect(() => {
    itemsRef.current = new Map(all.map((e) => [e.id, e]));
  }, [all]);

  // The map: created once per attempt; a failed style shows a fallback with a retry.
  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | undefined;
    let observer: ResizeObserver | undefined;
    setMapState("loading");
    const timeout = setTimeout(() => { if (!cancelled && !mapRef.current?.isStyleLoaded()) setMapState((s) => (s === "loading" ? "failed" : s)); }, 20000);
    (async () => {
      let maplibre;
      try {
        maplibre = (await import("maplibre-gl")).default;
      } catch {
        setMapState("failed");
        return;
      }
      if (cancelled || !container.current) return;
      map = new maplibre.Map({ container: container.current, style: STYLE_URL, center: [14.2, 30], zoom: 1.3, attributionControl: { compact: true } });
      const m = map;
      mapRef.current = m;
      frame(m, regionRef.current, false);
      m.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
      observer = new ResizeObserver(() => m.resize());
      observer.observe(container.current);
      m.on("error", (e) => {
        if (String(e.error?.message ?? "").includes("styles/") || !m.getStyle()) setMapState("failed");
      });

      const hover: Popup = new maplibre.Popup({ closeButton: false, closeOnClick: false, offset: 10, className: "tw-hover", maxWidth: "260px" });
      const reportBounds = () => {
        const b = m.getBounds();
        setBounds([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
      };
      m.once("style.load", () => {
        const theme: Appearance = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
        applyBasemapPalette(m, theme);
        const empty: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
        // The region's present-day outline, under the events. It isn't a historical border.
        m.addSource("outline", { type: "geojson", data: empty });
        m.addLayer({ id: "tw-outline-fill", type: "fill", source: "outline", paint: { "fill-color": PALETTE[theme].accent, "fill-opacity": 0.05 } });
        m.addLayer({ id: "tw-outline", type: "line", source: "outline", paint: { "line-color": PALETTE[theme].accent, "line-width": 1.4, "line-opacity": 0.7, "line-dasharray": [3, 2] } });
        // Nearby events merge into numbered clusters when zoomed out.
        m.addSource("h", { type: "geojson", data: empty, cluster: true, clusterMaxZoom: 5, clusterRadius: 42 });
        const single: ExpressionSpecification = ["!", ["has", "point_count"]];
        const notability: ExpressionSpecification = ["interpolate", ["linear"], ["get", "links"], 0, 0, 10, 0.5, 60, 1];
        m.addLayer({ id: "h-clusters", type: "circle", source: "h", filter: ["has", "point_count"], paint: {
          "circle-radius": ["step", ["get", "point_count"], 13, 25, 17, 100, 22, 500, 28],
          "circle-opacity": 0.9, "circle-stroke-width": 2,
        } });
        m.addLayer({ id: "h-cluster-count", type: "symbol", source: "h", filter: ["has", "point_count"], layout: {
          "text-field": ["get", "point_count_abbreviated"], "text-font": ["Noto Sans Regular"], "text-size": 12, "text-allow-overlap": true,
        } });
        m.addLayer({ id: "h-points", type: "circle", source: "h", filter: single, paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, ["+", 3, ["*", 3, notability]], 6, ["+", 5, ["*", 4, notability]], 10, ["+", 7, ["*", 6, notability]]],
          "circle-opacity": 0.92,
        } });
        // A letter inside each point names its category, so colour is never the only cue.
        m.addLayer({ id: "h-glyphs", type: "symbol", source: "h", filter: single, minzoom: 5.5, layout: {
          "text-field": ["get", "glyph"], "text-font": ["Noto Sans Regular"], "text-size": ["interpolate", ["linear"], ["zoom"], 6, 8, 10, 10], "text-allow-overlap": true, "text-ignore-placement": true,
        } });
        // "+2": more records at exactly this spot, so the overlap is visible.
        m.addLayer({ id: "h-stack", type: "symbol", source: "h", filter: ["all", single, [">", ["get", "stack"], 1]], layout: {
          "text-field": ["concat", "+", ["to-string", ["-", ["get", "stack"], 1]]], "text-font": ["Noto Sans Regular"], "text-size": 11, "text-offset": [1.1, -1.1], "text-allow-overlap": true, "text-ignore-placement": true,
        }, paint: { "text-halo-width": 2 } });
        m.addLayer({ id: "h-selected", type: "circle", source: "h", filter: ["==", ["get", "id"], ""], paint: { "circle-radius": 15, "circle-color": "rgba(0,0,0,0)", "circle-stroke-width": 3 } });
        for (const [id, minzoom, minLinks] of LABEL_TIERS) {
          m.addLayer({ id, type: "symbol", source: "h", minzoom, filter: ["all", single, [">=", ["get", "links"], minLinks]], layout: {
            "text-field": ["get", "title"], "text-font": ["Noto Sans Regular"], "text-size": ["interpolate", ["linear"], ["zoom"], 5, 11, 10, 13],
            "text-max-width": 11, "text-variable-anchor": ["top", "bottom", "left", "right"], "text-radial-offset": 1, "text-justify": "auto",
            "symbol-sort-key": ["-", 0, ["get", "links"]], "text-optional": true,
          }, paint: { "text-halo-width": 1.6 } });
        }

        (window as unknown as { __historyMap?: MapLibreMap }).__historyMap = m;
        m.on("click", "h-clusters", async (e) => {
          const f = e.features?.[0];
          if (!f) return;
          const src = m.getSource("h") as GeoJSONSource;
          const zoom = await src.getClusterExpansionZoom(f.properties.cluster_id);
          // Records at one spot never separate by zooming: list them instead.
          if (zoom > 16) {
            const leaves = await src.getClusterLeaves(f.properties.cluster_id, 200, 0);
            stackRef.current(leaves.map((l) => itemsRef.current.get(l.properties?.id)).filter(Boolean) as Item[]);
            return;
          }
          m.easeTo({ center: (f.geometry as GeoJSON.Point).coordinates as [number, number], zoom: zoom + 0.2 });
        });
        m.on("click", "h-points", (e) => {
          // Everything drawn under the pointer, so overlapping records can each be chosen.
          const box: [[number, number], [number, number]] = [[e.point.x - 6, e.point.y - 6], [e.point.x + 6, e.point.y + 6]];
          const ids = [...new Set(m.queryRenderedFeatures(box, { layers: ["h-points"] }).map((f) => f.properties.id as string))];
          const items = ids.map((id) => itemsRef.current.get(id)).filter(Boolean) as Item[];
          if (items.length) stackRef.current(items);
        });
        for (const layer of ["h-points", "h-clusters"]) {
          m.on("mouseenter", layer, () => { m.getCanvas().style.cursor = "pointer"; });
          m.on("mouseleave", layer, () => { m.getCanvas().style.cursor = ""; hover.remove(); });
        }
        m.on("mousemove", "h-points", (e) => {
          const f = e.features?.[0];
          const item = f && itemsRef.current.get(f.properties.id);
          if (!item) return;
          const node = document.createElement("div");
          const when = document.createElement("p");
          when.className = "tw-hover-date";
          when.textContent = `${dateOf(item)} · ${CATEGORY_LABELS[item.category] ?? item.category}`;
          const title = document.createElement("p");
          title.className = "tw-hover-title";
          title.textContent = item.title.en ?? item.title.de ?? "";
          node.append(when, title);
          hover.setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number]).setDOMContent(node).addTo(m);
        });
        m.on("moveend", reportBounds);
        reportBounds();
        setReady(true);
        setMapState("ready");
      });
    })();
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      observer?.disconnect();
      map?.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, [mapAttempt]);

  useEffect(() => {
    const m = mapRef.current;
    if (!ready || !m) return;
    const p = PALETTE[theme];
    applyBasemapPalette(m, theme);
    const color = categoryColor(theme);
    const outside: ExpressionSpecification = ["==", ["get", "inside"], false];
    m.setPaintProperty("h-points", "circle-color", ["case", outside, p.halo, color]);
    m.setPaintProperty("h-points", "circle-stroke-color", ["case", outside, color, p.markerStroke]);
    m.setPaintProperty("h-points", "circle-stroke-width", ["case", outside, 2, 1]);
    m.setPaintProperty("h-glyphs", "text-color", ["case", outside, color, p.markerStroke] as unknown as ExpressionSpecification);
    m.setPaintProperty("h-clusters", "circle-color", p.marker);
    m.setPaintProperty("h-clusters", "circle-stroke-color", p.halo);
    m.setPaintProperty("h-cluster-count", "text-color", p.markerStroke);
    m.setPaintProperty("h-selected", "circle-stroke-color", p.accent);
    m.setPaintProperty("h-stack", "text-color", theme === "dark" ? "#ebe4d4" : "#2a2418");
    m.setPaintProperty("h-stack", "text-halo-color", p.halo);
    for (const [id] of LABEL_TIERS) {
      m.setPaintProperty(id, "text-color", theme === "dark" ? "#ebe4d4" : "#2a2418");
      m.setPaintProperty(id, "text-halo-color", p.halo);
    }
    m.setPaintProperty("tw-outline", "line-color", p.accent);
    m.setPaintProperty("tw-outline-fill", "fill-color", p.accent);
  }, [ready, theme]);

  useEffect(() => {
    const m = mapRef.current;
    if (!ready || !m) return;
    m.setFilter("h-selected", ["all", ["!", ["has", "point_count"]], ["==", ["get", "id"], selected?.id ?? ""]]);
  }, [ready, selected]);

  useEffect(() => {
    const m = mapRef.current;
    if (!ready || !m) return;
    const onMap = filtered.filter(pinned);
    const spot = (e: Item) => `${e.lng!.toFixed(4)},${e.lat!.toFixed(4)}`;
    const perSpot = new Map<string, number>();
    for (const e of onMap) perSpot.set(spot(e), (perSpot.get(spot(e)) ?? 0) + 1);
    (m.getSource("h") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: onMap.map((e) => ({
        type: "Feature",
        properties: { stack: perSpot.get(spot(e)) ?? 1, id: e.id, category: e.category, glyph: CATEGORY_GLYPH[e.category] ?? "", title: e.title.en ?? e.title.de ?? "", links: e.checked ? 40 : e.links ?? 0, inside: e.inside !== false },
        geometry: { type: "Point", coordinates: [e.lng!, e.lat!] },
      })),
    });
  }, [ready, filtered, pinned]);

  useEffect(() => {
    const m = mapRef.current;
    if (!ready || !m) return;
    frame(m, region, true);
    let stale = false;
    const setOutline = (geometry: GeoJSON.Geometry | null | undefined) =>
      (m.getSource("outline") as GeoJSONSource | undefined)?.setData(geometry ? { type: "Feature", properties: {}, geometry } : { type: "FeatureCollection", features: [] });
    if (isWorld) setOutline(null);
    else if (boundaryCache.has(region.id)) setOutline(boundaryCache.get(region.id));
    else {
      fetch(asset(`/data/regions/${region.id}.boundary.json`))
        .then((r) => (r.ok ? r.json() : null))
        .then((geometry) => {
          if (stale || !mapRef.current) return;
          boundaryCache.set(region.id, geometry);
          setOutline(geometry);
        })
        .catch(() => { boundaryCache.set(region.id, null); });
    }
    return () => { stale = true; };
  }, [ready, region, isWorld]);

  const hrefFor = (item: Item) => (isWorld ? `/atlas?event=${item.id}` : `/atlas/${region.id}?event=${item.id}`);

  // The selected event is in the URL, so it can be shared, and back and forward move between events.
  const select = (item: Item, fly = true) => {
    setSelected(item);
    setStack(null);
    setDrawer(false);
    setSheetFull(false);
    remember({ id: item.id, title: item.title.en ?? item.title.de ?? "", href: hrefFor(item), context: region.label.en, start: item.start });
    const url = new URL(window.location.href);
    if (url.searchParams.get("event") !== item.id) {
      url.searchParams.set("event", item.id);
      url.searchParams.delete("compare");
      window.history.pushState(null, "", url);
    }
    const m = mapRef.current;
    if (fly && m && pinned(item)) {
      const target = { center: [item.lng!, item.lat!] as [number, number], zoom: Math.max(m.getZoom(), 6) };
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) m.jumpTo(target);
      else m.flyTo({ ...target, duration: 1100 });
    }
  };
  const selectRef = useRef(select);
  selectRef.current = select;
  /** Several distinct records under one click: offer them as a list instead of picking one silently. */
  const showStack = (items: Item[]) => {
    if (items.length === 1) return select(items[0], false);
    setSelected(null);
    setStack(items);
    setDrawer(false);
  };
  const stackRef = useRef(showStack);
  stackRef.current = showStack;
  const closeEvent = () => {
    setSelected(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("event");
    url.searchParams.delete("compare");
    window.history.replaceState(null, "", url);
  };

  useEffect(() => {
    if (!imported) return;
    const sync = () => {
      const id = new URLSearchParams(window.location.search).get("event");
      const item = id ? itemsRef.current.get(id) ?? null : null;
      setSelected(item);
      if (item && pinned(item)) mapRef.current?.jumpTo({ center: [item.lng!, item.lat!], zoom: Math.max(mapRef.current.getZoom(), 5) });
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [imported, ready, pinned]);

  const related = useMemo(() => {
    if (!selected) return { sameTime: [], nearby: [] };
    const y = yearOf(selected.start);
    const sameTime = all.filter((e) => e.id !== selected.id && Math.abs(yearOf(e.start) - y) <= 10).sort((a, b) => (b.links ?? 0) - (a.links ?? 0)).slice(0, 5);
    const nearby = !pinned(selected) ? [] : all.filter((e) => e.id !== selected.id && pinned(e) && km(selected, e) < 40).sort(byDate).slice(0, 6);
    return { sameTime, nearby };
  }, [selected, all, pinned]);

  const placeOf = (e: Item) => {
    if (e.multi) return `Multiple regions (${e.nc} countries)`;
    const names = [!isCountry && e.country ? byId.get(e.country)?.label.en : null, e.nc && e.nc > 1 && !e.multi ? `also linked to ${e.nc - 1} other ${e.nc === 2 ? "country" : "countries"}` : null, e.inside === false && isCountry ? `outside today’s ${region.label.en}` : null];
    return names.filter(Boolean).join(", ");
  };
  const continentOf = (e: Item) => {
    if (region.kind === "continent") return region.id;
    if (isCountry) return region.continent ?? null;
    if (e.checked) return "europe";
    return e.country ? byId.get(e.country)?.continent ?? null : null;
  };

  const fitResults = () => {
    const m = mapRef.current;
    const pts = filtered.filter(pinned);
    if (!m || !pts.length) return;
    let w = 180, s = 90, e = -180, n = -90;
    for (const p of pts) { w = Math.min(w, p.lng!); e = Math.max(e, p.lng!); s = Math.min(s, p.lat!); n = Math.max(n, p.lat!); }
    m.fitBounds([[w, s], [e, n]], { padding: 60, maxZoom: 8 });
  };

  const applyYears = () => {
    const a = Number(yearFrom), b = Number(yearTo);
    if (yearFrom.trim() && yearTo.trim() && Number.isFinite(a) && Number.isFinite(b)) setRange([Math.min(a, b), Math.max(a, b)]);
  };
  const zoomOut = () => {
    if (!range || !extent) return setRange(null);
    const mid = (range[0] + range[1]) / 2, half = Math.max(5, (range[1] - range[0]) * 1.5);
    const next: [number, number] = [Math.max(extent[0], Math.round(mid - half)), Math.min(extent[1], Math.round(mid + half))];
    setRange(next[0] <= extent[0] && next[1] >= extent[1] ? null : next);
  };

  const dot = (category: string, hollow = false) => (
    <span aria-hidden className="inline-grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 text-[9px] font-bold leading-none" style={{ borderColor: colorOf(theme, category), background: hollow ? "transparent" : colorOf(theme, category), color: hollow ? colorOf(theme, category) : PALETTE[theme].markerStroke }}>
      {CATEGORY_GLYPH[category] ?? ""}
    </span>
  );
  const miniList = (title: string, items: Item[]) => items.length > 0 && (
    <div className="mt-4">
      <p className="text-sm font-semibold">{title}</p>
      <ul className="mt-1 divide-y divide-line border-y border-line">
        {items.map((e) => (
          <li key={e.id}>
            <button type="button" onClick={() => select(e)} className="flex w-full items-center gap-2 py-2 text-left text-sm hover:text-bronze">
              {dot(e.category)}
              <span className="w-24 shrink-0 text-xs text-ink-2">{dateOf(e)}</span>
              <span className="min-w-0 flex-1 truncate">{e.title.en ?? e.title.de}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );

  const countText = imported
    ? `${filtered.length.toLocaleString("en")} of ${all.length.toLocaleString("en")} events${total && total > all.length ? ` (the best documented of ${total.toLocaleString("en")})` : ""}, ${onMap.toLocaleString("en")} on the map`
    : failed ? "The events couldn't be loaded." : "Loading events…";
  const showSidebar = sidebar && !focus;
  const selYear = selected ? yearOf(selected.start) : null;

  // ---------- Pieces ----------
  const regionPicker = (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wider text-ink-2">Region</span>
      <select value={region.id} onChange={(e) => router.push(e.target.value === "world" ? "/atlas" : `/atlas/${e.target.value}`)} className="field mt-1 font-serif text-lg" data-testid="region-picker">
        <option value="world">The whole world</option>
        <optgroup label="Continents">{regions.filter((r) => r.kind === "continent").map((r) => <option key={r.id} value={r.id}>{r.label.en}</option>)}</optgroup>
        <optgroup label="Countries">{regions.filter((r) => !r.kind).map((r) => <option key={r.id} value={r.id}>{r.label.en}</option>)}</optgroup>
      </select>
    </label>
  );

  const filters = (
    <div className="space-y-3">
      <input aria-label="Search events" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${isWorld ? "the world map" : region.label.en}…`} className="field text-sm" />
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-2">Themes</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {usedCategories.map((c) => (
            <button key={c} type="button" aria-pressed={categories.includes(c)} onClick={() => setCategories(categories.includes(c) ? categories.filter((x) => x !== c) : [...categories, c])} className="chip !min-h-8 !px-2.5 !text-[0.8rem]">
              {dot(c)}{CATEGORY_LABELS[c] ?? c}
            </button>
          ))}
        </div>
      </div>
      {isCountry && (
        <fieldset data-testid="scope-filter">
          <legend className="text-xs font-semibold uppercase tracking-wider text-ink-2">What to include</legend>
          <div className="mt-1.5 grid gap-1">
            {(Object.keys(SCOPE_LABEL) as Scope[]).map((sc) => (
              <label key={sc} className="flex items-start gap-2 text-sm" title={SCOPE_HELP[sc]}>
                <input type="checkbox" className="mt-1 accent-[var(--bronze)]" checked={scopes.includes(sc)} onChange={() => setScopes(scopes.includes(sc) ? scopes.filter((x) => x !== sc) : [...scopes, sc])} />
                <span><span className="font-medium">{SCOPE_LABEL[sc]}</span> <span className="tabular-nums text-ink-2">{scopeCounts[sc].toLocaleString("en")}</span><span className="block text-xs text-ink-2">{SCOPE_HELP[sc]}</span></span>
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-ink-2">Borders are today&rsquo;s, used to sort records, not to show where borders ran at the time.</p>
        </fieldset>
      )}
      <div className="flex flex-wrap gap-1.5">
        {all.some((e) => e.checked) && <button type="button" aria-pressed={source === "checked"} onClick={() => setSource(source === "all" ? "checked" : "all")} className="chip !min-h-8 !text-[0.8rem]">Hand-checked only</button>}
        <button type="button" aria-pressed={inView} onClick={() => setInView(!inView)} className="chip !min-h-8 !text-[0.8rem]">Only what&rsquo;s on the map</button>
      </div>
      {(categories.length > 0 || source !== "all" || inView || query || range || scopes.join() !== "here") && (
        <button type="button" onClick={() => { setCategories([]); setSource("all"); setScopes(["here"]); setInView(false); setQuery(""); setRange(null); }} className="link text-sm">Clear all filters</button>
      )}
    </div>
  );

  const list = (
    <>
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2 text-sm">
        <span className="text-ink-2">{listed.length.toLocaleString("en")} listed</span>
        <label className="flex items-center gap-1.5 text-ink-2">
          Order
          <select value={sort} onChange={(e) => setSort(e.target.value as "date" | "notable")} className="rounded border border-line bg-paper-2 px-1.5 py-1 text-ink outline-none focus:border-bronze">
            <option value="date">By date</option>
            <option value="notable">Best documented first</option>
          </select>
        </label>
      </div>
      <ul data-testid="atlas-list" aria-label="Events">
        {!imported && !failed && Array.from({ length: 6 }, (_, i) => <li key={i} className="border-b border-line px-4 py-3"><div className="skeleton h-3 w-24" /><div className="skeleton mt-2 h-4 w-4/5" /></li>)}
        {listed.slice(0, shown).map((e) => (
          <li key={e.id} className="border-b border-line">
            <button type="button" onClick={() => select(e)} aria-current={selected?.id === e.id ? "true" : undefined} className={`flex w-full gap-3 px-4 py-2.5 text-left transition-colors hover:bg-paper-3 ${selected?.id === e.id ? "bg-paper-3" : ""}`}>
              <span className="pt-1">{dot(e.category, e.inside === false)}</span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline gap-x-2 text-xs text-ink-2">
                  <span>{dateOf(e)}</span>
                  {e.checked && <span className="font-semibold text-navy">✓ Checked</span>}
                  {placeOf(e) && <span>· {placeOf(e)}</span>}
                  {!pinned(e) && !e.multi && <span>· not on the map</span>}
                  {pinned(e) && e.loc && <span>· {LOC_LABEL[e.loc]}</span>}
                  {e.also?.length ? <span>· merged from {e.also.length + 1} records</span> : null}
                  {e.titleYear !== undefined && <span className="font-semibold text-oxblood">· dates disagree</span>}
                </span>
                <span className="block font-serif text-[1.05rem] leading-snug">{e.title.en ?? e.title.de}</span>
              </span>
            </button>
          </li>
        ))}
        {listed.length > shown && <li className="p-3 text-center"><button type="button" onClick={() => setShown(shown + PAGE)} className="btn btn-sm btn-secondary">Show more</button></li>}
        {imported && listed.length === 0 && (
          <li className="p-6 text-sm text-ink-2">
            {inView && filtered.length ? "Nothing on this part of the map. Zoom out or move the map." : "Nothing matches these filters."}
          </li>
        )}
        {failed && <li className="p-6 text-sm text-ink-2">The events couldn&rsquo;t be loaded. <button type="button" className="link" onClick={() => setAttempt(attempt + 1)}>Try again</button></li>}
      </ul>
    </>
  );

  const timeline = (
    <div className="border-t border-line bg-paper-2 px-3 pb-2 pt-2 sm:px-4" data-testid="atlas-timeline">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <p className="text-xs text-ink-2">
          <span className="font-semibold text-ink">{view ? `${formatYear(view[0])} – ${view[1] >= 2026 ? "today" : formatYear(view[1])}` : "Timeline"}</span>
          {" · "}records per {bucket === 100 ? "century" : bucket === 10 ? "decade" : "year"}, not how eventful a time was
        </p>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={zoomOut} disabled={!range} className="btn btn-sm btn-ghost !min-h-8" aria-label="Zoom the timeline out">− Wider</button>
          <button type="button" onClick={() => setRange(null)} disabled={!range} className="btn btn-sm btn-ghost !min-h-8">Reset</button>
          <button type="button" onClick={() => setTimelineOpen(!timelineOpen)} aria-expanded={timelineOpen} className="btn btn-sm btn-ghost !min-h-8 lg:hidden">{timelineOpen ? "Less" : "More"}</button>
        </div>
      </div>
      <div
        className="relative mt-1.5 flex h-14 cursor-crosshair touch-none items-end gap-px"
        role="group"
        aria-label={`Records per ${bucket === 100 ? "century" : bucket === 10 ? "decade" : "year"} in this dataset. Choose a bar to ${bucket === 1 ? "list its records" : "zoom into it"}, or drag across several to choose a span.`}
        data-testid="timeline-bars"
        onPointerDown={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          brushStart.current = Math.min(bars.length - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * bars.length)));
          brushed.current = false;
        }}
        onPointerMove={(e) => {
          if (brushStart.current === null || !(e.buttons & 1)) return;
          const r = e.currentTarget.getBoundingClientRect();
          const i = Math.min(bars.length - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * bars.length)));
          if (i !== brushStart.current || brushed.current) {
            brushed.current = true;
            setBrush([Math.min(i, brushStart.current), Math.max(i, brushStart.current)]);
          }
        }}
        onPointerUp={() => {
          if (brushed.current && brush) setRange([bars[brush[0]].bucket, bars[brush[1]].bucket + bucket - 1]);
          brushStart.current = null;
          setBrush(null);
        }}
        onPointerLeave={() => { if (brushStart.current !== null && brushed.current && brush) setRange([bars[brush[0]].bucket, bars[brush[1]].bucket + bucket - 1]); brushStart.current = null; setBrush(null); }}
      >
        {brush && <span aria-hidden className="pointer-events-none absolute inset-y-0 z-10 rounded border-2 border-bronze bg-bronze/15" style={{ left: `${(brush[0] / bars.length) * 100}%`, width: `${((brush[1] - brush[0] + 1) / bars.length) * 100}%` }} />}
        {bars.map((b) => {
          const on = selYear !== null && selYear >= b.bucket && selYear < b.bucket + bucket;
          const chosen = range !== null && range[0] === b.bucket && range[1] === b.bucket + bucket - 1;
          const bar = (
            <span className={`flex w-full flex-col-reverse overflow-hidden rounded-t-sm ${on ? "outline outline-2 outline-offset-1 outline-oxblood" : ""}`} style={{ height: `${b.count ? Math.max(6, Math.sqrt(b.count / maxBar) * 100) : 2}%` }}>
              {b.count ? b.byCat.map(([c, n]) => <span key={c} className="block w-full" style={{ flexGrow: n, background: colorOf(theme, c) }} />) : <span className="block h-full w-full bg-line" />}
            </span>
          );
          const label = `${bucketLabel(b.bucket, bucket)}: ${b.count.toLocaleString("en")} record${b.count === 1 ? "" : "s"} in this dataset`;
          // An empty period isn't a control, so it isn't drawn as one.
          if (!b.count) return <span key={b.bucket} aria-hidden className="flex h-full min-w-0 flex-1 items-end">{bar}</span>;
          return (
            <button
              key={b.bucket}
              type="button"
              data-century={bucket === 100 ? b.bucket : undefined}
              data-bucket={b.bucket}
              aria-label={`${label}. ${bucket === 1 ? "List them" : "Zoom in"}.`}
              aria-pressed={chosen}
              title={`${label} (not a measure of how eventful it was). ${bucket === 1 ? "Click to list them." : "Click to zoom in."}`}
              onClick={() => { if (brushed.current) { brushed.current = false; return; } setRange([b.bucket, b.bucket + bucket - 1]); if (bucket === 1) setDrawer(true); }}
              className={`group relative flex h-full min-w-0 flex-1 cursor-pointer items-end rounded-t-sm outline-none hover:bg-paper-3 focus-visible:ring-2 focus-visible:ring-bronze ${chosen ? "bg-bronze-soft/50" : ""}`}
            >
              {bar}
            </button>
          );
        })}
      </div>
      {marks.length > 0 && (
        <div className="mt-1.5 border-t border-dashed border-line pt-1">
          <span className="block text-[11px] text-ink-2" id="top-records-label"><span className="font-semibold uppercase tracking-wider">Top records</span> · the best documented here, one dot each. Click to open.</span>
          {/* Full width, so each dot sits under its year in the bars above. Not a count. */}
          <div className="relative h-6" role="group" aria-labelledby="top-records-label" data-testid="timeline-records">
            {marks.map(({ e, x }) => {
              const on = selected?.id === e.id;
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => select(e)}
                  aria-label={`${e.title.en ?? e.title.de}, ${dateOf(e)}`}
                  title={`${e.title.en ?? e.title.de} · ${dateOf(e)}`}
                  aria-pressed={on}
                  className="group absolute top-1/2 grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 cursor-pointer place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-bronze"
                  style={{ left: `${x}%` }}
                >
                  <span className={`block rounded-full border-2 border-paper-2 transition-transform group-hover:scale-125 ${on ? "h-3.5 w-3.5 ring-2 ring-oxblood" : "h-2.5 w-2.5"}`} style={{ background: colorOf(theme, e.category) }} />
                </button>
              );
            })}
          </div>
        </div>
      )}
      {bars.length > 0 && <div className="mt-0.5 flex justify-between text-xs tabular-nums text-ink-2"><span>{bucketLabel(bars[0].bucket, bucket)}</span>{selected && <span className="min-w-0 truncate px-2 font-semibold text-oxblood">Selected: {selected.title.en ?? selected.title.de}, {formatYear(selYear!)}</span>}<span>{bucketLabel(bars[bars.length - 1].bucket, bucket)}</span></div>}
      <div className={`${timelineOpen ? "flex" : "hidden"} mt-2 flex-wrap items-center gap-1.5 lg:flex`}>
        {PRESETS.map((p) => (
          <button key={p.label} type="button" aria-pressed={range?.[0] === p.from && range?.[1] === p.to} onClick={() => setRange([p.from, p.to])} className="chip !min-h-8 !px-2.5 !text-[0.8rem]">{p.label}</button>
        ))}
        <form className="ml-auto flex items-center gap-1 text-sm" onSubmit={(e) => { e.preventDefault(); applyYears(); }}>
          <label className="sr-only" htmlFor="year-from">From year</label>
          <input id="year-from" inputMode="numeric" value={yearFrom} onChange={(e) => setYearFrom(e.target.value)} placeholder="From" className="field !min-h-8 !w-20 !px-2 !py-1 text-sm" />
          <span aria-hidden>–</span>
          <label className="sr-only" htmlFor="year-to">To year</label>
          <input id="year-to" inputMode="numeric" value={yearTo} onChange={(e) => setYearTo(e.target.value)} placeholder="To" className="field !min-h-8 !w-20 !px-2 !py-1 text-sm" />
          <button type="submit" className="btn btn-sm btn-secondary !min-h-8">Go</button>
        </form>
      </div>
      <p className={`${timelineOpen ? "block" : "hidden"} mt-1 text-xs text-ink-2 lg:block`}>Negative years are BC. Drag across the bars to choose a span. A bar counts records in this dataset, not how eventful history was: click one to zoom in, or at single years to list its records. Dots in “Top records” are the best-documented records of the range; click one to open it.</p>
    </div>
  );

  const detail = selected && (
    <EventStory
      item={selected}
      when={dateOf(selected)}
      place={placeOf(selected) || (isCountry ? region.label.en : "")}
      href={hrefFor(selected)}
      onBack={closeEvent}
      known={(id) => itemsRef.current.has(id)}
      onPick={(id) => { const item = itemsRef.current.get(id); if (item) select(item); return !!item; }}
      connected={(related.sameTime.length > 0 || related.nearby.length > 0) && (
        <>
          {miniList("Around the same time in this atlas", related.sameTime)}
          {miniList("At or near the same place", related.nearby)}
          <p className="mt-2 text-xs text-ink-2">Listed because they are close in time or place, not because one led to the other.</p>
        </>
      )}
      meanwhile={<Meanwhile anchor={{ id: selected.id, title: selected.title.en ?? "", start: selected.start, end: selected.end, continent: continentOf(selected) }} />}
    />
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <SiteHeader />
      <div className="relative flex min-h-0 flex-1">
        {/* Left: region, filters and the list (a drawer on phones) */}
        <aside
          aria-label="Filters and events"
          className={`${showSidebar ? "lg:flex" : "lg:hidden"} ${drawer ? "fixed inset-0 z-40 flex" : "hidden"} w-full flex-col bg-paper lg:static lg:z-auto lg:w-[350px] lg:shrink-0 lg:border-r lg:border-line`}
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-2 lg:hidden">
            <p className="font-semibold">Filters and list</p>
            <button type="button" onClick={() => setDrawer(false)} className="btn btn-sm btn-secondary">Show map</button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="space-y-3 border-b border-line p-4">
              <h1 className="font-serif text-2xl leading-tight">{isWorld ? "The world" : `The history of ${region.label.en}`}</h1>
              {regionPicker}
              <p data-testid="atlas-count" role="status" className="text-sm text-ink-2">{countText}</p>
              {!isWorld && (
                <Link href={region.kind === "continent" ? `/history/${region.id}` : region.continent ? `/history/${region.continent}` : "/history"} className="link text-sm">
                  {region.kind === "continent" ? `Charts and eras of ${region.label.en} →` : "Continent overview, with charts →"}
                </Link>
              )}
              {isWorld && <Link href="/atlas/countries" className="link block text-sm">Browse countries by coverage →</Link>}
              {filters}
            </div>
            {list}
          </div>
        </aside>

        {/* Centre: the map, with the timeline beneath */}
        <main className="relative flex min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1">
            {/* MapLibre makes its container position: relative, so the absolute frame is a separate wrapper. */}
            <div className="absolute inset-0">
              <div key={mapAttempt} ref={container} data-testid="history-map" data-ready={ready} className="h-full w-full" role="region" aria-label={`Map of events in ${region.label.en}. Every event is also in the list.`} />
            </div>
            {mapState === "loading" && (
              <div className="absolute inset-0 z-10 grid place-items-center bg-paper/70" aria-live="polite">
                <div className="text-center"><div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-bronze border-t-transparent" /><p className="mt-3 text-sm text-ink-2">Loading the map…</p></div>
              </div>
            )}
            {mapState === "failed" && (
              <div className="absolute inset-0 z-10 grid place-items-center bg-paper p-6 text-center" role="alert">
                <div className="max-w-sm">
                  <p className="font-serif text-xl">The map couldn&rsquo;t be loaded.</p>
                  <p className="mt-2 text-sm text-ink-2">The base map comes from OpenFreeMap and may be unreachable. Every event is still in the list.</p>
                  <div className="mt-4 flex justify-center gap-2">
                    <button type="button" onClick={() => setMapAttempt(mapAttempt + 1)} className="btn btn-primary">Try again</button>
                    <button type="button" onClick={() => setDrawer(true)} className="btn btn-secondary lg:hidden">Open the list</button>
                  </div>
                </div>
              </div>
            )}
            {/* Map toolbar */}
            <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-1.5">
              <button type="button" onClick={() => setDrawer(true)} className="btn btn-sm btn-secondary shadow-sm lg:hidden">
                <span aria-hidden>☰</span> List &amp; filters{categories.length || range ? ` (${categories.length + (range ? 1 : 0)})` : ""}
              </button>
              <button type="button" onClick={() => setSidebar(!sidebar)} aria-pressed={!sidebar} className="btn btn-sm btn-secondary hidden shadow-sm lg:inline-flex" disabled={focus}>
                {sidebar ? "‹ Hide list" : "› Show list"}
              </button>
              <button type="button" onClick={() => setFocus(!focus)} aria-pressed={focus} className="btn btn-sm btn-secondary hidden shadow-sm lg:inline-flex">{focus ? "Exit focus" : "Focus map"}</button>
              <button type="button" onClick={fitResults} className="btn btn-sm btn-secondary shadow-sm">Fit results</button>
            </div>
            <p className="pointer-events-none absolute right-14 top-3 z-10 hidden rounded-md bg-paper-2/90 px-2 py-1 text-xs text-ink-2 shadow-sm sm:block">Today&rsquo;s map, not historical borders</p>
            {!focus && (
              <details data-testid="atlas-legend" className="group absolute bottom-3 left-3 z-10 max-w-xs rounded-md border border-line bg-paper-2/95 text-xs leading-snug text-ink-2 shadow-sm">
                <summary className="cursor-pointer list-none px-3 py-1.5 font-semibold text-ink [&::-webkit-details-marker]:hidden">Map key <span aria-hidden className="inline-block transition-transform group-open:rotate-180">▴</span></summary>
                <div className="px-3 pb-2">
                  <ul className="flex flex-wrap gap-x-3 gap-y-1">
                    {usedCategories.map((c) => <li key={c} className="flex items-center gap-1.5">{dot(c)}{CATEGORY_LABELS[c] ?? c}</li>)}
                  </ul>
                  <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                    <li className="flex items-center gap-1.5"><span aria-hidden className="inline-grid h-4 w-4 place-items-center rounded-full text-[9px] font-bold" style={{ background: PALETTE[theme].marker, color: PALETTE[theme].markerStroke }}>9</span>Group of events: click to zoom in</li>
                    {isCountry && <li className="flex items-center gap-1.5"><span aria-hidden className="inline-block h-3 w-3 rounded-full border-2 border-ink-2" />Outside it</li>}
                    {!isWorld && <li className="flex items-center gap-1.5"><span aria-hidden className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: PALETTE[theme].accent }} />Present-day border</li>}
                  </ul>
                  <p className="mt-1.5">Larger points are written about in more languages, not more important. Events spanning many countries are in the list only.</p>
                </div>
              </details>
            )}
          </div>
          {!focus && timeline}
        </main>

        {/* Right: the selected event (a bottom sheet on phones) */}
        {stack && !selected && !focus && (
          <aside aria-label="Records at this spot" data-testid="atlas-stack" className="sheet fixed inset-x-0 bottom-0 z-30 flex max-h-[60dvh] flex-col rounded-t-2xl border-t border-line bg-paper shadow-[0_-12px_40px_-12px_rgb(0_0_0/0.4)] lg:static lg:z-auto lg:max-h-none lg:w-[440px] lg:shrink-0 lg:rounded-none lg:border-l lg:border-t-0 lg:shadow-none">
            <div className="flex items-start justify-between gap-2 border-b border-line px-4 py-3">
              <div>
                <p className="font-serif text-xl">{stack.length} records here</p>
                <p className="text-xs text-ink-2">Different records drawn at the same spot, often because Wikidata gives only the town or area. Choose one.</p>
              </div>
              <button type="button" className="btn btn-ghost btn-icon" onClick={() => setStack(null)} aria-label="Close the list">✕</button>
            </div>
            <ul className="min-h-0 flex-1 overflow-y-auto">
              {[...stack].sort(byDate).map((e) => (
                <li key={e.id} className="border-b border-line">
                  <button type="button" onClick={() => select(e, false)} className="flex w-full gap-3 px-4 py-2.5 text-left hover:bg-paper-3">
                    <span className="pt-1">{dot(e.category, e.inside === false)}</span>
                    <span className="min-w-0 flex-1"><span className="block text-xs text-ink-2">{dateOf(e)}</span><span className="block font-serif leading-snug">{e.title.en ?? e.title.de}</span></span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        )}
        {selected && !focus && (
          <aside
            aria-label="Selected event"
            className={`sheet fixed inset-x-0 bottom-0 z-30 flex flex-col rounded-t-2xl border-t border-line bg-paper shadow-[0_-12px_40px_-12px_rgb(0_0_0/0.4)] lg:static lg:z-auto lg:h-auto lg:w-[440px] lg:shrink-0 lg:rounded-none lg:border-l lg:border-t-0 lg:shadow-none ${sheetFull ? "h-[92dvh]" : "h-[58dvh]"}`}
          >
            <button type="button" onClick={() => setSheetFull(!sheetFull)} aria-expanded={sheetFull} aria-label={sheetFull ? "Shrink the event panel" : "Expand the event panel"} className="flex w-full justify-center py-2 lg:hidden">
              <span aria-hidden className="h-1.5 w-12 rounded-full bg-line" />
            </button>
            <div className="min-h-0 flex-1 overflow-y-auto">{detail}</div>
          </aside>
        )}
      </div>
    </div>
  );
}
