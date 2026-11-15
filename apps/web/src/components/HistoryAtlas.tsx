"use client";

import type { ExpressionSpecification, GeoJSONSource, Map as MapLibreMap, Popup } from "maplibre-gl";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { collection, eventsByDate, formatWhen } from "@/lib/collection";
import { fold } from "@/lib/search";
import { useAppearance, type Appearance } from "./ThemeToggle";
import { applyBasemapPalette, PALETTE, STYLE_URL } from "./AtlasMap";
import { SiteHeader } from "./SiteHeader";
import { EventStory } from "./EventStory";
import { CATEGORY_COLORS, CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/categories";
import { byDate, centuryLabel, centuryOf, formatImportedDate, yearOf } from "@/lib/dates";
import { remember } from "@/lib/recent";
import { asset } from "@/lib/paths";

type Region = { id: string; label: { en: string }; note?: string; imported: number; bbox?: number[] | null; kind?: string; continent?: string | null };

// In-memory cache for region data to avoid re-fetching when switching regions
const regionDataCache = new Map<string, { events: Item[]; total: number | null }>();
// In-memory cache for boundary data
const boundaryCache = new Map<string, GeoJSON.Geometry | null>();

/** Where the atlas opens: the country's main territory, or central Europe for a region without an outline. */
function frame(m: MapLibreMap, region: Region, animate: boolean) {
  const b = region.bbox;
  if (b && b.length === 4) m.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 40, maxZoom: 7, animate });
  else m.jumpTo({ center: [14.2, 47.6], zoom: 4.6 });
}
type Item = {
  id: string; title: { en: string; de?: string }; description?: string; category: string; start: string; end?: string;
  precision: "day" | "month" | "year" | "decade" | "century"; conflict?: boolean; lng?: number; lat?: number; loc?: "event" | "place" | "area"; url: string;
  /** Number of Wikipedia language editions with an article: how widely documented, not how important. */
  links?: number;
  checked?: boolean;
  /** Located inside the region's present-day boundary. */
  inside?: boolean;
  /** On a continent map: the country it was imported for. */
  country?: string;
};

const CATEGORIES = CATEGORY_LABELS;
const colorOf = (theme: Appearance, category: string) => CATEGORY_COLORS[theme][category] ?? PALETTE[theme].marker;
const PAGE = 100;
/** Label layers: [id, from zoom, at least this many Wikipedia languages]. */
const LABEL_TIERS: [string, number, number][] = [["h-labels-1", 4.5, 25], ["h-labels-2", 7, 8], ["h-labels-3", 9.5, 0]];
export { formatImportedDate };

const dateOf = (e: Item) => (e.checked ? formatWhen({ start: e.start, end: e.end, precision: e.precision as "day" | "month" | "year" }) : formatImportedDate(e.start, e.end, e.precision));

function km(a: Item, b: Item) {
  const r = Math.PI / 180;
  const x = (b.lng! - a.lng!) * r * Math.cos(((a.lat! + b.lat!) / 2) * r);
  const y = (b.lat! - a.lat!) * r;
  return Math.sqrt(x * x + y * y) * 6371;
}

function checkedAsItems(): Item[] {
  return eventsByDate.filter((e) => e.kind === "event").map((e) => {
    const place = e.placeId ? collection.places.find((p) => p.id === e.placeId) : undefined;
    return { id: e.id, title: { en: e.title.en }, description: e.summary.en, category: e.themes[0], start: e.when.start, end: e.when.end, precision: e.when.precision, lng: place?.lng, lat: place?.lat, url: `/explore?event=${e.id}`, checked: true, inside: place?.modernCountry === "AT" };
  });
}

/** Category colour as a MapLibre expression. */
function categoryColor(theme: Appearance): ExpressionSpecification {
  const pairs = Object.entries(CATEGORY_COLORS[theme]).flat();
  return ["match", ["get", "category"], ...pairs, PALETTE[theme].marker] as unknown as ExpressionSpecification;
}

function rgba(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/** Adds heatmap and label layers - deferred for faster initial load. */
function addHeavyLayers(map: MapLibreMap, theme: Appearance, notability: ExpressionSpecification) {
  // Heatmap layer - shows density at low zooms
  map.addLayer({ id: "h-heat", type: "heatmap", source: "h", maxzoom: 8, paint: {
    "heatmap-weight": ["+", 0.25, notability],
    "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 2, 0.35, 7, 0.8],
    "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 2, 8, 7, 18],
    "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 3, 0.45, 7, 0],
  } });
  // Titles appear as you zoom in: the best-documented first, more as there's room, never overlapping.
  for (const [id, minzoom, minLinks] of LABEL_TIERS) {
    map.addLayer({ id, type: "symbol", source: "h", minzoom, filter: [">=", ["get", "links"], minLinks], layout: {
      "text-field": ["get", "title"], "text-font": ["Noto Sans Regular"], "text-size": ["interpolate", ["linear"], ["zoom"], 5, 10.5, 10, 13],
      "text-max-width": 11, "text-variable-anchor": ["top", "bottom", "left", "right"], "text-radial-offset": 0.9, "text-justify": "auto",
      "symbol-sort-key": ["-", 0, ["get", "links"]], "text-optional": true,
    }, paint: { "text-halo-width": 1.6 } });
  }
}

export function HistoryAtlas({ region, regions }: { region: Region; regions: Region[] }) {
  const router = useRouter();
  const theme = useAppearance();
  const [imported, setImported] = useState<Item[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const countryLabel = useMemo(() => new Map(regions.map((r) => [r.id, r.label.en])), [regions]);
  const [failed, setFailed] = useState(false);
  const [century, setCentury] = useState<number | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [source, setSource] = useState<"all" | "checked">("all");
  const [insideOnly, setInsideOnly] = useState(false);
  const [inView, setInView] = useState(false);
  const [bounds, setBounds] = useState<[number, number, number, number] | null>(null);
  const [sort, setSort] = useState<"date" | "notable">("date");
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [selected, setSelected] = useState<Item | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const regionRef = useRef(region);
  regionRef.current = region;

  useEffect(() => {
    setImported(null);
    setSelected(null);
    // Check cache first for instant load
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
  }, [region.id]);

  const all = useMemo(() => {
    const checked = region.id === collection.region.id ? checkedAsItems() : [];
    return [...checked, ...(imported ?? [])].sort(byDate);
  }, [imported, region.id]);

  const beforeCentury = useMemo(() => {
    const q = fold(query.trim());
    return all.filter((e) => (source === "all" || e.checked) && (!insideOnly || e.inside) && (!categories.length || categories.includes(e.category)) && (!q || fold(`${e.title.en} ${e.title.de ?? ""} ${e.description ?? ""}`).includes(q)));
  }, [all, source, insideOnly, categories, query]);
  const filtered = useMemo(() => (century === null ? beforeCentury : beforeCentury.filter((e) => centuryOf(yearOf(e.start)) === century)), [beforeCentury, century]);
  // The list can follow the map; the map always shows the whole filtered set.
  const listed = useMemo(() => {
    const visible = inView && bounds ? filtered.filter((e) => e.lng !== undefined && e.lng >= bounds[0] && e.lng <= bounds[2] && e.lat! >= bounds[1] && e.lat! <= bounds[3]) : filtered;
    return sort === "notable" ? [...visible].sort((a, b) => (b.checked ? 1e6 : b.links ?? 0) - (a.checked ? 1e6 : a.links ?? 0)) : visible;
  }, [filtered, inView, bounds, sort]);

  const bars = useMemo(() => {
    const counts = new Map<number, Map<string, number>>();
    for (const e of beforeCentury) {
      const c = centuryOf(yearOf(e.start));
      const byCat = counts.get(c) ?? new Map<string, number>();
      byCat.set(e.category, (byCat.get(e.category) ?? 0) + 1);
      counts.set(c, byCat);
    }
    const keys = [...counts.keys()];
    if (!keys.length) return [];
    const out = [];
    for (let c = Math.min(...keys); c <= Math.max(...keys); c += 100) {
      const byCat = counts.get(c) ?? new Map<string, number>();
      out.push({ century: c, count: [...byCat.values()].reduce((s, n) => s + n, 0), byCat: [...byCat.entries()].sort(([a], [b]) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b)) });
    }
    return out;
  }, [beforeCentury]);
  const maxBar = Math.max(1, ...bars.map((b) => b.count));
  const usedCategories = useMemo(() => [...new Set(all.map((e) => e.category))].sort((a, b) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b)), [all]);
  const located = filtered.filter((e) => e.lng !== undefined).length;

  useEffect(() => setShown(PAGE), [listed]);

  const itemsRef = useRef(new Map<string, Item>());
  useEffect(() => {
    itemsRef.current = new Map(all.map((e) => [e.id, e]));
  }, [all]);

  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | undefined;
    let observer: ResizeObserver | undefined;
    (async () => {
      const maplibre = (await import("maplibre-gl")).default;
      if (cancelled || !container.current) return;
      map = new maplibre.Map({ container: container.current, style: STYLE_URL, center: [14.2, 47.6], zoom: 4.6, attributionControl: { compact: true } });
      const m = map;
      mapRef.current = m;
      frame(m, regionRef.current, false);
      m.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
      observer = new ResizeObserver(() => m.resize());
      observer.observe(container.current);

      m.on("error", (e) => {
        if (!m.isStyleLoaded() && !m.getStyle()) setLoading(false);
        else if (String(e.error?.message ?? "").includes("styles/")) setLoading(false);
      });

      const hover: Popup = new maplibre.Popup({ closeButton: false, closeOnClick: false, offset: 10, className: "tw-hover", maxWidth: "260px" });
      const reportBounds = () => {
        const b = m.getBounds();
        setBounds([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
      };
      // Not "load", which waits for every tile: slow tiles shouldn't hold back the events.
      m.once("style.load", () => {
        const theme: Appearance = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
        applyBasemapPalette(m, theme);
        const empty: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
        // The country's present-day outline, under the events. It isn't a historical border.
        m.addSource("outline", { type: "geojson", data: empty });
        m.addLayer({ id: "tw-outline-fill", type: "fill", source: "outline", paint: { "fill-color": PALETTE[theme].accent, "fill-opacity": 0.05 } });
        m.addLayer({ id: "tw-outline", type: "line", source: "outline", paint: { "line-color": PALETTE[theme].accent, "line-width": 1.4, "line-opacity": 0.7, "line-dasharray": [3, 2] } });
        m.addSource("h", { type: "geojson", data: empty });
        const notability: ExpressionSpecification = ["interpolate", ["linear"], ["get", "links"], 0, 0, 10, 0.5, 60, 1];
        // Core event points layer - add immediately
        m.addLayer({ id: "h-points", type: "circle", source: "h", paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, ["+", 1.5, ["*", 3, notability]], 6, ["+", 3, ["*", 5, notability]], 10, ["+", 5, ["*", 8, notability]]],
          "circle-opacity": ["interpolate", ["linear"], ["zoom"], 2, 0.6, 6, 0.9],
          "circle-stroke-opacity": ["interpolate", ["linear"], ["zoom"], 2, 0.6, 6, 1],
        } });
        m.addLayer({ id: "h-selected", type: "circle", source: "h", filter: ["==", ["get", "id"], ""], paint: { "circle-radius": 15, "circle-color": "rgba(0,0,0,0)", "circle-stroke-width": 2.5 } });

        // Defer heatmap and label layers for faster initial paint
        const scheduleHeavyLayers = () => {
          if ("requestIdleCallback" in window) {
            (window as unknown as { requestIdleCallback: (cb: () => void) => number }).requestIdleCallback(() => {
              if (!cancelled) addHeavyLayers(m, theme, notability);
            });
          } else {
            setTimeout(() => { if (!cancelled) addHeavyLayers(m, theme, notability); }, 0);
          }
        };
        scheduleHeavyLayers();

        (window as unknown as { __historyMap?: MapLibreMap }).__historyMap = m;
        m.on("click", "h-points", (e) => {
          const id = e.features?.[0]?.properties.id;
          const item = id && itemsRef.current.get(id);
          if (item) selectRef.current(item, false);
        });
        m.on("mousemove", "h-points", (e) => {
          const f = e.features?.[0];
          const item = f && itemsRef.current.get(f.properties.id);
          if (!item) return;
          m.getCanvas().style.cursor = "pointer";
          const node = document.createElement("div");
          const when = document.createElement("p");
          when.className = "tw-hover-date";
          when.textContent = dateOf(item);
          const title = document.createElement("p");
          title.className = "tw-hover-title";
          title.textContent = item.title.en ?? item.title.de ?? "";
          node.append(when, title);
          hover.setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number]).setDOMContent(node).addTo(m);
        });
        m.on("mouseleave", "h-points", () => {
          m.getCanvas().style.cursor = "";
          hover.remove();
        });
        m.on("moveend", reportBounds);
        reportBounds();
        setReady(true);
        setLoading(false);
      });
    })();
    return () => {
      cancelled = true;
      observer?.disconnect();
      map?.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, []);

  useEffect(() => {
    const m = mapRef.current;
    if (!ready || !m) return;
    const p = PALETTE[theme];
    applyBasemapPalette(m, theme);
    const color = categoryColor(theme);
    // Hollow: outside today's borders (linked through a historical state, a war, or a regional tag).
    const outside: ExpressionSpecification = ["==", ["get", "inside"], false];
    m.setPaintProperty("h-points", "circle-color", ["case", outside, p.halo, color]);
    m.setPaintProperty("h-points", "circle-stroke-color", ["case", outside, color, p.markerStroke]);
    m.setPaintProperty("h-points", "circle-stroke-width", ["case", outside, 1.6, 0.8]);
    m.setPaintProperty("h-selected", "circle-stroke-color", p.accent);
    for (const [id] of LABEL_TIERS) {
      m.setPaintProperty(id, "text-color", theme === "dark" ? "#ebe4d4" : "#2a2418");
      m.setPaintProperty(id, "text-halo-color", p.halo);
    }
    const heat = p.marker;
    m.setPaintProperty("h-heat", "heatmap-color", ["interpolate", ["linear"], ["heatmap-density"], 0, rgba(heat, 0), 0.3, rgba(heat, 0.18), 0.7, rgba(heat, 0.35), 1, rgba(p.accent, 0.55)]);
    m.setPaintProperty("tw-outline", "line-color", p.accent);
    m.setPaintProperty("tw-outline-fill", "fill-color", p.accent);
  }, [ready, theme]);

  useEffect(() => {
    const m = mapRef.current;
    if (!ready || !m) return;
    m.setFilter("h-selected", ["==", ["get", "id"], selected?.id ?? ""]);
  }, [ready, selected]);

  useEffect(() => {
    const m = mapRef.current;
    if (!ready || !m) return;
    (m.getSource("h") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: filtered.filter((e) => e.lng !== undefined).map((e) => ({
        type: "Feature",
        properties: { id: e.id, category: e.category, title: e.title.en ?? e.title.de ?? "", links: e.checked ? 40 : e.links ?? 0, inside: e.inside !== false },
        geometry: { type: "Point", coordinates: [e.lng!, e.lat!] },
      })),
    });
  }, [ready, filtered]);

  // Choosing another country in the picker re-renders this component, so frame and outline follow the region.
  useEffect(() => {
    const m = mapRef.current;
    if (!ready || !m) return;
    frame(m, region, true);
    let stale = false;
    // Check cache first
    if (boundaryCache.has(region.id)) {
      const geometry = boundaryCache.get(region.id);
      (m.getSource("outline") as GeoJSONSource | undefined)?.setData(geometry ? { type: "Feature", properties: {}, geometry } : { type: "FeatureCollection", features: [] });
    } else {
      fetch(asset(`/data/regions/${region.id}.boundary.json`))
        .then((r) => (r.ok ? r.json() : null))
        .then((geometry) => {
          if (stale || !mapRef.current) return;
          boundaryCache.set(region.id, geometry);
          (m.getSource("outline") as GeoJSONSource | undefined)?.setData(geometry ? { type: "Feature", properties: {}, geometry } : { type: "FeatureCollection", features: [] });
        })
        .catch(() => { boundaryCache.set(region.id, null); });
    }
    return () => { stale = true; };
  }, [ready, region]);

  // The selected event is in the URL, so it can be shared, and back and forward move between events.
  const select = (item: Item, fly = true) => {
    setSelected(item);
    remember({ id: item.id, title: item.title.en ?? item.title.de ?? "", href: `/atlas/${region.id}?event=${item.id}`, context: region.label.en, start: item.start });
    const url = new URL(window.location.href);
    if (url.searchParams.get("event") !== item.id) {
      url.searchParams.set("event", item.id);
      window.history.pushState(null, "", url);
    }
    // On phones the event replaces the list further down the page: bring it into view.
    if (window.innerWidth < 1024) requestAnimationFrame(() => document.querySelector('[data-testid="atlas-detail"]')?.scrollIntoView({ block: "start" }));
    const m = mapRef.current;
    if (fly && m && item.lng !== undefined) {
      const target = { center: [item.lng, item.lat!] as [number, number], zoom: Math.max(m.getZoom(), 7) };
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) m.jumpTo(target);
      else m.flyTo({ ...target, duration: 1200 });
    }
  };
  const selectRef = useRef(select);
  selectRef.current = select;
  const closeEvent = () => {
    setSelected(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("event");
    window.history.replaceState(null, "", url);
  };

  // Open the event named in the URL once the events have loaded, and follow back and forward.
  useEffect(() => {
    if (!imported) return;
    const sync = () => {
      const id = new URLSearchParams(window.location.search).get("event");
      const item = id ? itemsRef.current.get(id) ?? null : null;
      setSelected(item);
      // Opened from a link: show where it is, without an animation that interrupts reading.
      if (item?.lng !== undefined) mapRef.current?.jumpTo({ center: [item.lng, item.lat!], zoom: Math.max(mapRef.current.getZoom(), 6) });
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [imported, ready]);

  // Context for the selected event: the same decades, and the same place.
  const related = useMemo(() => {
    if (!selected) return { sameTime: [], nearby: [] };
    const y = yearOf(selected.start);
    const sameTime = all.filter((e) => e.id !== selected.id && Math.abs(yearOf(e.start) - y) <= 10).sort((a, b) => (b.links ?? 0) - (a.links ?? 0)).slice(0, 5);
    const nearby = selected.lng === undefined ? [] : all.filter((e) => e.id !== selected.id && e.lng !== undefined && km(selected, e) < 40).sort(byDate).slice(0, 6);
    return { sameTime, nearby };
  }, [selected, all]);

  const chip = (on: boolean) => `rounded-full border px-3 py-1 text-xs transition-colors ${on ? "border-navy bg-navy text-on-accent dark:border-bronze dark:bg-bronze" : "border-line text-ink-2 hover:border-bronze"}`;
  const dot = (category: string, hollow = false) => (
    <span aria-hidden className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border-2" style={{ borderColor: colorOf(theme, category), background: hollow ? "transparent" : colorOf(theme, category) }} />
  );
  const miniList = (title: string, items: Item[]) => items.length > 0 && (
    <section className="mt-6">
      <h3 className="eyebrow">{title}</h3>
      <ul className="mt-2 divide-y divide-line border-y border-line">
        {items.map((e) => (
          <li key={e.id}>
            <button type="button" onClick={() => select(e)} className="flex w-full items-baseline gap-2 py-2 text-left text-sm hover:text-bronze">
              {dot(e.category)}
              <span className="w-24 shrink-0 text-xs text-ink-2">{dateOf(e)}</span>
              <span className="min-w-0 flex-1 truncate">{e.title.en ?? e.title.de}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );

  return (
    // On phones the page scrolls as a whole; on large screens map and list scroll side by side.
    <div className="flex min-h-dvh flex-col lg:h-dvh lg:overflow-hidden">
      <SiteHeader />
      <div className="shrink-0 border-b border-line bg-paper-2 px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="font-serif text-2xl leading-none">The history of</h1>
          <label className="font-serif text-2xl">
            <span className="sr-only">Country</span>
            <select value={region.id} onChange={(e) => router.push(`/atlas/${e.target.value}`)} className="border-b border-bronze bg-transparent text-bronze outline-none">
              <optgroup label="Continents">{regions.filter((r) => r.kind === "continent").map((r) => <option key={r.id} value={r.id}>{r.label.en}</option>)}</optgroup>
              <optgroup label="Countries">{regions.filter((r) => r.kind !== "continent").map((r) => <option key={r.id} value={r.id}>{r.label.en}</option>)}</optgroup>
            </select>
          </label>
          <p data-testid="atlas-count" role="status" className="text-sm text-ink-2">{imported ? `${filtered.length.toLocaleString("en")} of ${all.length.toLocaleString("en")} events${total && total > all.length ? ` (the best documented of ${total.toLocaleString("en")})` : ""}, ${located.toLocaleString("en")} on the map` : failed ? "The imported events couldn't be loaded." : "Loading events…"}</p>
          <a href={region.kind === "continent" ? `/history/${region.id}` : region.continent ? `/history/${region.continent}` : "/history"} className="text-sm font-medium text-bronze underline-offset-2 hover:underline">
            {region.kind === "continent" ? `Overview of ${region.label.en}, with charts →` : "Continent overview, with charts →"}
          </a>
          <input aria-label="Search events" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…" className="ml-auto w-full rounded-full border border-line bg-transparent px-4 py-1.5 text-sm outline-none focus:border-bronze sm:w-64" />
        </div>
        <div className="-mx-4 mt-2 flex items-center gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 [&>*]:shrink-0">
          {all.some((e) => e.checked) && <button type="button" aria-pressed={source === "checked"} onClick={() => setSource(source === "all" ? "checked" : "all")} className={chip(source === "checked")}>Hand-checked only</button>}
          <button type="button" aria-pressed={insideOnly} title={region.note} onClick={() => setInsideOnly(!insideOnly)} className={chip(insideOnly)}>Inside present-day {region.label.en}</button>
          <span aria-hidden className="mx-1 h-4 w-px bg-line" />
          {usedCategories.map((c) => (
            <button key={c} type="button" aria-pressed={categories.includes(c)} onClick={() => setCategories(categories.includes(c) ? categories.filter((x) => x !== c) : [...categories, c])} className={`${chip(categories.includes(c))} inline-flex items-center gap-1.5`}>
              {dot(c)}{CATEGORIES[c] ?? c}
            </button>
          ))}
        </div>
      </div>

      <main className="relative flex flex-1 flex-col lg:min-h-0 lg:flex-row">
        <div className="relative h-[38dvh] shrink-0 lg:h-auto lg:min-w-0 lg:flex-1">
          <div ref={container} data-testid="history-map" data-ready={ready} className="h-full w-full" role="region" aria-label="Map of events" />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-paper/80 z-10" aria-live="polite">
              <div className="text-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-bronze border-t-transparent mx-auto" />
                <p className="mt-3 text-sm text-ink-2">Loading map&hellip;</p>
              </div>
            </div>
          )}
          <div data-testid="atlas-legend" className="pointer-events-none absolute bottom-8 left-3 max-w-sm border border-line bg-paper-2/95 px-3 py-2 text-xs leading-snug text-ink-2 shadow-sm">
            <ul className="hidden flex-wrap gap-x-3 gap-y-1 md:flex">
              {usedCategories.map((c) => <li key={c} className="flex items-center gap-1.5">{dot(c)}{CATEGORIES[c] ?? c}</li>)}
            </ul>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 md:mt-1.5">
              <li className="flex items-center gap-1.5"><span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full bg-ink-2" />Inside today&rsquo;s {region.label.en}</li>
              <li className="flex items-center gap-1.5"><span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full border-2 border-ink-2" />Outside it</li>
              <li className="flex items-center gap-1.5"><span aria-hidden className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: PALETTE[theme].accent }} />Present-day border</li>
            </ul>
            <p className="mt-1.5 hidden md:block">Larger dots have articles in more Wikipedia languages: better documented, not more important. Zoomed out, the glow shows where events cluster. Events with no location are only in the list.</p>
          </div>
        </div>

        <aside className="flex flex-1 flex-col border-t border-line bg-paper lg:min-h-0 lg:w-[460px] lg:flex-none lg:border-l lg:border-t-0">
          {selected ? (
            <EventStory
              item={selected}
              when={dateOf(selected)}
              place={[selected.country && region.kind ? countryLabel.get(selected.country) : null, selected.inside === false ? `outside today’s ${region.kind ? "countries" : region.label.en}` : null].filter(Boolean).join(", ")}
              onBack={closeEvent}
              known={(id) => itemsRef.current.has(id)}
              onPick={(id) => { const item = itemsRef.current.get(id); if (item) select(item); return !!item; }}
            >
              {miniList("Around the same time in this atlas", related.sameTime)}
              {miniList("At or near the same place", related.nearby)}
              {(related.sameTime.length > 0 || related.nearby.length > 0) && <p className="-mt-4 text-xs text-ink-2">Listed because they are close in time or place, not because one led to the other.</p>}
            </EventStory>
          ) : (
            <>
              <div className="shrink-0 border-b border-line p-3">
                <div className="flex items-center justify-between text-xs text-ink-2">
                  <span>Events per century in this collection, not how eventful each one was</span>
                  {century !== null && <button type="button" onClick={() => setCentury(null)} className="shrink-0 text-bronze underline-offset-2 hover:underline">All</button>}
                </div>
                <div className="mt-2 flex h-16 items-end gap-px" role="group" aria-label="Filter by century">
                  {bars.map((b) => (
                    <button key={b.century} type="button" disabled={!b.count} data-century={b.century} aria-pressed={century === b.century} aria-label={`${centuryLabel(b.century)}: ${b.count} events`} title={`${centuryLabel(b.century)}: ${b.count.toLocaleString("en")} events`} onClick={() => setCentury(century === b.century ? null : b.century)} className={`flex h-full min-w-0 flex-1 items-end disabled:cursor-default ${century !== null && century !== b.century ? "opacity-35" : ""} hover:opacity-100`}>
                      <span className={`flex w-full flex-col-reverse overflow-hidden ${century === b.century ? "outline outline-2 outline-offset-1 outline-oxblood" : ""}`} style={{ height: `${b.count ? Math.max(6, Math.sqrt(b.count / maxBar) * 100) : 1}%` }}>
                        {b.byCat.map(([c, n]) => <span key={c} className="block w-full" style={{ flexGrow: n, background: colorOf(theme, c) }} />)}
                      </span>
                    </button>
                  ))}
                </div>
                {bars.length > 0 && <div className="mt-1 flex justify-between text-xs text-ink-2"><span>{centuryLabel(bars[0].century, true)}</span><span>{bars[bars.length - 1].century + 99 > 2026 ? "Today" : centuryLabel(bars[bars.length - 1].century, true)}</span></div>}
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                  <button type="button" aria-pressed={inView} onClick={() => setInView(!inView)} className={chip(inView)}>Only what&rsquo;s on the map</button>
                  <label className="ml-auto flex items-center gap-1.5 text-ink-2">
                    Order
                    <select value={sort} onChange={(e) => setSort(e.target.value as "date" | "notable")} className="border-b border-line bg-transparent text-ink outline-none">
                      <option value="date">By date</option>
                      <option value="notable">Best documented first</option>
                    </select>
                  </label>
                </div>
              </div>
              <ul data-testid="atlas-list" className="flex-1 lg:min-h-0 lg:overflow-y-auto">
                {listed.slice(0, shown).map((e) => (
                  <li key={e.id} className="border-b border-line">
                    <button type="button" onClick={() => select(e)} className="flex w-full gap-3 px-4 py-2.5 text-left hover:bg-paper-3">
                      <span className="pt-1.5">{dot(e.category, e.inside === false)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-2 text-xs text-ink-2">
                          <span>{dateOf(e)}</span>
                          {e.checked && <span className="font-semibold uppercase tracking-wider text-navy">Checked</span>}
                          {region.kind && e.country && <span>· {countryLabel.get(e.country)}</span>}
                          {e.lng === undefined && <span>· no location</span>}
                          {(e.loc === "place" || e.loc === "area") && <span>· approximate place</span>}
                        </span>
                        <span className="block font-serif text-[1.05rem] leading-snug">{e.title.en ?? e.title.de}</span>
                        {e.description && <span className="mt-0.5 block truncate text-xs text-ink-2">{e.description}</span>}
                      </span>
                    </button>
                  </li>
                ))}
                {listed.length > shown && <li className="p-3 text-center"><button type="button" onClick={() => setShown(shown + PAGE)} className="text-sm text-bronze underline-offset-2 hover:underline">Show more</button></li>}
                {imported && listed.length === 0 && <li className="p-6 text-sm text-ink-2">{inView && filtered.length ? "Nothing on this part of the map. Zoom out or move the map." : "Nothing matches these filters."}</li>}
              </ul>
            </>
          )}
        </aside>
      </main>
    </div>
  );
}
