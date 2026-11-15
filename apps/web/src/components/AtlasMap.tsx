"use client";

import type { Map as MapLibreMap, Popup } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import type { HistoricalEvent } from "@timewise/historical-schemas";
import { DERIVATION_LABELS, geometries, geometriesFor, placeById } from "@/lib/collection";
import { useAtlas, type ComparisonMode } from "@/lib/store";
import { useAppearance, type Appearance } from "./ThemeToggle";

export const STYLE_URL =process.env.NEXT_PUBLIC_BASEMAP_STYLE_URL ?? "https://tiles.openfreemap.org/styles/positron";

export const PALETTE = {
  light: { land: "#efe6d2", water: "#bcccd0", green: "#e6dfc4", road: "#e0d3b8", border: "#a8987a", text: "#6b6250", halo: "#f4ecdc", marker: "#22365a", markerStroke: "#fbf6ea", accent: "#b5541f", future: "#a79a82", modern: "#5e6b57" },
  dark: { land: "#222a37", water: "#0b111b", green: "#252e3c", road: "#2f3848", border: "#5d6779", text: "#a3a7ad", halo: "#11151d", marker: "#d9a95f", markerStroke: "#11151d", accent: "#ff9d6e", future: "#4d5564", modern: "#9fb098" },
} as const;

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Recolours the neutral vector style into TIMEWISE's parchment and navy palettes. */
export function applyBasemapPalette(map: MapLibreMap, theme: Appearance) {
  const p = PALETTE[theme];
  for (const layer of map.getStyle().layers ?? []) {
    if (layer.id.startsWith("tw-")) continue;
    const sourceLayer = "source-layer" in layer ? layer["source-layer"] : undefined;
    const paint = (prop: string, value: string) => map.setPaintProperty(layer.id, prop, value);
    if (layer.type === "background") paint("background-color", p.land);
    else if (sourceLayer === "poi" || sourceLayer === "building" || sourceLayer === "housenumber" || sourceLayer === "aerodrome_label")
      map.setLayoutProperty(layer.id, "visibility", "none");
    else if (layer.type === "fill" && sourceLayer === "water") paint("fill-color", p.water);
    else if (layer.type === "line" && sourceLayer === "waterway") paint("line-color", p.water);
    else if (layer.type === "fill") paint("fill-color", p.green);
    else if (layer.type === "line" && sourceLayer === "boundary") paint("line-color", p.border);
    else if (layer.type === "line") paint("line-color", p.road);
    else if (layer.type === "symbol") {
      paint("text-color", p.text);
      paint("text-halo-color", p.halo);
    }
  }
}

/** Adds historical geometry layers (borders, labels) - deferred for faster initial load. */
export function addHistoricalLayers(map: MapLibreMap, theme: Appearance) {
  const p = PALETTE[theme];
  const polygons: maplibregl.ExpressionSpecification = ["==", ["geometry-type"], "Polygon"];
  const lines: maplibregl.ExpressionSpecification = ["==", ["geometry-type"], "LineString"];

  map.addSource("tw-geo", { type: "geojson", data: GEO_DATA });
  map.addLayer({ id: "tw-geo-fill", type: "fill", source: "tw-geo", filter: polygons, paint: { "fill-color": p.marker, "fill-opacity": 0.2 } });
  map.addLayer({ id: "tw-geo-outline", type: "line", source: "tw-geo", filter: polygons, paint: { "line-color": p.marker, "line-width": 1.5, "line-dasharray": [4, 2] } });
  map.addLayer({ id: "tw-geo-schematic", type: "line", source: "tw-geo", filter: ["all", lines, ["==", ["get", "derivation"], "schematic"]], layout: { "line-cap": "round" }, paint: { "line-color": p.marker, "line-width": 3, "line-dasharray": [0.1, 2] } });
  map.addLayer({ id: "tw-geo-solid", type: "line", source: "tw-geo", filter: ["all", lines, ["!=", ["get", "derivation"], "schematic"]], layout: { "line-cap": "round" }, paint: { "line-color": p.marker, "line-width": 3 } });
  // Placement can't vary per feature, so lines and areas need separate label layers.
  const labelLayout = { "text-field": ["get", "name"] as maplibregl.ExpressionSpecification, "text-font": ["Noto Sans Regular"], "text-size": 12, "text-allow-overlap": true };
  const labelPaint = { "text-color": p.marker, "text-halo-color": p.halo, "text-halo-width": 2 };
  map.addLayer({ id: "tw-geo-label", type: "symbol", source: "tw-geo", filter: polygons, layout: { ...labelLayout, "symbol-placement": "point" }, paint: labelPaint });
  map.addLayer({ id: "tw-geo-label-line", type: "symbol", source: "tw-geo", filter: lines, layout: { ...labelLayout, "symbol-placement": "line-center", "text-offset": [0, 1] }, paint: labelPaint });
}

function toGeoJSON(events: HistoricalEvent[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: events.filter((e) => e.placeId).map((e) => {
      const place = placeById.get(e.placeId!)!;
      return {
        type: "Feature",
        id: e.id,
        properties: { id: e.id, year: e.when.start.slice(0, 4), title: e.title.en, place: place.label.en, date: Number(e.when.start.replaceAll("-", "")) },
        geometry: { type: "Point", coordinates: [place.lng, place.lat] },
      };
    }),
  };
}

const dateNumber = (iso: string) => Number(iso.replaceAll("-", ""));

const GEO_DATA: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: geometries.map((g) => ({
    type: "Feature",
    properties: { id: g.id, name: g.name, layer: g.layer, derivation: g.derivation, derivationLabel: DERIVATION_LABELS[g.derivation].label, from: dateNumber(g.validFrom), to: dateNumber(g.validTo), eventId: g.eventIds[0] ?? "" },
    geometry: g.geometry as GeoJSON.Geometry,
  })),
};

function boundsOf(shapes: { type: string; coordinates: unknown }[], extra?: [number, number]): [[number, number], [number, number]] {
  let [w, s, e, n] = [180, 90, -180, -90];
  const visit = (c: unknown) => {
    if (typeof (c as number[])[0] === "number") {
      const [lng, lat] = c as number[];
      w = Math.min(w, lng); e = Math.max(e, lng); s = Math.min(s, lat); n = Math.max(n, lat);
    } else (c as unknown[]).forEach(visit);
  };
  shapes.forEach((g) => visit(g.coordinates));
  if (extra) visit(extra);
  return [[w, s], [e, n]];
}

type Props = {
  events: HistoricalEvent[];
  selectedId: string | null;
  date?: string;
  onSelect?: (id: string) => void;
  interactive?: boolean;
  /** Camera zoom when focused on a selected event. */
  focusZoom?: number;
  initialCenter?: [number, number];
  initialZoom?: number;
  /** Pixels covered by panels floating over the map, which the camera should frame around. */
  leftInset?: number;
  bottomInset?: number;
  /** For comparison modes: the second date to render. */
  comparisonDate?: string | null;
  /** Comparison mode: single, split, swipe, then-now. */
  comparisonMode?: ComparisonMode;
  /** Optional inline style for the map container. */
  style?: React.CSSProperties;
};

export function AtlasMap({
  events,
  selectedId,
  date,
  onSelect,
  interactive = true,
  focusZoom = 6.4,
  initialCenter = [14.2, 47.6],
  initialZoom = 5.3,
  leftInset = 0,
  bottomInset = 0,
  comparisonDate = null,
  comparisonMode = "single",
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const [geoReady, setGeoReady] = useState(false);
  // Shown once recoloured, without waiting for every tile, so slow tiles don't leave a blank panel.
  const [styled, setStyled] = useState(false);
  const [failed, setFailed] = useState(false);
  // Track initial map library + style load to show a spinner.
  const [loading, setLoading] = useState(true);
  const theme = useAppearance();
  const layers = useAtlas((s) => s.layers);
  const boundaryOpacity = useAtlas((s) => s.boundaryOpacity);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;
  const initialEvents = useRef(events);
  const themeRef = useRef(theme);
  themeRef.current = theme;

  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | undefined;
    let frame = 0;
    let map: MapLibreMap | undefined;

    (async () => {
      const maplibre = (await import("maplibre-gl")).default;
      if (cancelled || !container.current) return;
      map = new maplibre.Map({
        container: container.current,
        style: STYLE_URL,
        center: initialCenter,
        zoom: initialZoom,
        interactive,
        attributionControl: { compact: true },
      });
      mapRef.current = map;
      const m = map;
      if (interactive) m.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
      m.on("error", (e) => {
        // Only a failed basemap load is fatal; single tile hiccups are recoverable.
        if (!m.isStyleLoaded() && !m.getStyle()) {
          setFailed(true);
          setLoading(false);
        } else if (String(e.error?.message ?? "").includes("styles/")) {
          setFailed(true);
          setLoading(false);
        }
      });
      observer = new ResizeObserver(() => m.resize());
      observer.observe(container.current);

      // Recolour before the first tiles paint, so the default light style never flashes.
      m.once("style.load", () => {
        applyBasemapPalette(m, themeRef.current);
        setStyled(true);
        setLoading(false);

        // Historical geometry layers wait for an idle moment, for a faster first paint, but never more than
        // half a second: an animation can keep the page busy. Once added, the filters are applied again.
        const addHistorical = () => {
          if (cancelled || m.getLayer("tw-geo-solid")) return;
          addHistoricalLayers(m, themeRef.current);
          setGeoReady(true);
        };
        if ("requestIdleCallback" in window) {
          (window as unknown as { requestIdleCallback: (cb: () => void, o: { timeout: number }) => number }).requestIdleCallback(addHistorical, { timeout: 500 });
        } else {
          setTimeout(addHistorical, 0);
        }

        m.addSource("tw-events", { type: "geojson", data: toGeoJSON(initialEvents.current) });
        m.addLayer({ id: "tw-halo", type: "circle", source: "tw-events", filter: ["==", ["get", "id"], ""], paint: { "circle-radius": 16, "circle-color": PALETTE.light.accent, "circle-opacity": 0.3 } });
        m.addLayer({ id: "tw-points", type: "circle", source: "tw-events", paint: { "circle-radius": 6, "circle-color": PALETTE.light.marker, "circle-stroke-width": 1.5, "circle-stroke-color": PALETTE.light.markerStroke } });
        m.addLayer({
          id: "tw-selected-label",
          type: "symbol",
          source: "tw-events",
          filter: ["==", ["get", "id"], ""],
          layout: { "text-field": ["concat", ["get", "year"], " · ", ["get", "place"]], "text-font": ["Noto Sans Regular"], "text-size": 14, "text-offset": [0, 1.6], "text-anchor": "top", "text-allow-overlap": true },
          paint: { "text-color": PALETTE.light.accent, "text-halo-color": PALETTE.light.halo, "text-halo-width": 2 },
        });
        setReady(true);
        (window as unknown as { __timewiseMap?: MapLibreMap }).__timewiseMap = m;

        if (interactive) {
          let popup: Popup | undefined;
          // Several records can share a place, so repeated clicks step through them.
          m.on("click", "tw-points", (e) => {
            const ids = [...new Set((e.features ?? []).map((f) => f.properties.id as string))].sort();
            if (!ids.length) return;
            const current = ids.indexOf(selectedRef.current ?? "");
            onSelectRef.current?.(ids[(current + 1) % ids.length]);
          });
          m.on("click", (e) => {
            if (m.queryRenderedFeatures(e.point, { layers: ["tw-points"] }).length) return;
            const pad = 5;
            const hit = m.queryRenderedFeatures([[e.point.x - pad, e.point.y - pad], [e.point.x + pad, e.point.y + pad]], { layers: ["tw-geo-schematic", "tw-geo-solid"] })[0];
            if (hit?.properties.eventId) onSelectRef.current?.(hit.properties.eventId);
          });
          for (const layer of ["tw-geo-schematic", "tw-geo-solid"]) {
            m.on("mousemove", layer, (e) => {
              if (m.queryRenderedFeatures(e.point, { layers: ["tw-points"] }).length) return;
              m.getCanvas().style.cursor = "pointer";
              const f = e.features?.[0];
              if (!f) return;
              const el = document.createElement("div");
              const title = document.createElement("div");
              title.style.cssText = "font-family:var(--font-serif);font-size:15px";
              title.textContent = f.properties.name;
              const meta = document.createElement("div");
              meta.style.cssText = "font-size:11px;color:var(--ink-2)";
              meta.textContent = f.properties.derivationLabel;
              el.append(title, meta);
              popup?.remove();
              popup = new maplibre.Popup({ closeButton: false, offset: 10 }).setLngLat(e.lngLat).setDOMContent(el).addTo(m);
            });
            m.on("mouseleave", layer, () => {
              m.getCanvas().style.cursor = "";
              popup?.remove();
            });
          }
          m.on("mousemove", "tw-points", (e) => {
            m.getCanvas().style.cursor = "pointer";
            const feature = e.features?.[0];
            if (!feature) return;
            const count = new Set(e.features!.map((f) => f.properties.id)).size;
            const el = document.createElement("div");
            const title = document.createElement("div");
            title.style.cssText = "font-family:var(--font-serif);font-size:15px";
            title.textContent = count > 1 ? `${count} records at ${feature.properties.place}` : feature.properties.title;
            const meta = document.createElement("div");
            meta.style.cssText = "font-size:11px;color:var(--ink-2)";
            meta.textContent = count > 1 ? "Click to step through them" : `${feature.properties.year} · ${feature.properties.place}`;
            el.append(title, meta);
            popup?.remove();
            popup = new maplibre.Popup({ closeButton: false, offset: 12 }).setLngLat((feature.geometry as GeoJSON.Point).coordinates as [number, number]).setDOMContent(el).addTo(m);
          });
          m.on("mouseleave", "tw-points", () => {
            m.getCanvas().style.cursor = "";
            popup?.remove();
          });
        }

        if (!prefersReducedMotion()) {
          const pulse = (t: number) => {
            if (m.getLayer("tw-halo")) m.setPaintProperty("tw-halo", "circle-radius", 15 + 5 * Math.sin(t / 420));
            frame = requestAnimationFrame(pulse);
          };
          frame = requestAnimationFrame(pulse);
        }
      });
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      map?.remove();
      mapRef.current = null;
      setReady(false);
    };
    // The map instance lives for the component's lifetime; props update it below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = mapRef.current;
    if (!ready || !m) return;
    const p = PALETTE[theme];
    applyBasemapPalette(m, theme);
    const dateNum = date ? Number(date.replaceAll("-", "")) : 99999999;
    const compDateNum = comparisonDate ? Number(comparisonDate.replaceAll("-", "")) : -1;

    const isPast: maplibregl.ExpressionSpecification = ["<=", ["get", "date"], dateNum];
    m.setPaintProperty("tw-points", "circle-color", ["case", ["==", ["get", "id"], selectedId ?? ""], p.accent, isPast, p.marker, p.future]);
    m.setPaintProperty("tw-points", "circle-opacity", ["case", isPast, 1, 0.55]);
    m.setPaintProperty("tw-points", "circle-stroke-color", p.markerStroke);
    m.setPaintProperty("tw-points", "circle-radius", ["case", ["==", ["get", "id"], selectedId ?? ""], 8, isPast, 6, 4]);
    m.setPaintProperty("tw-halo", "circle-color", p.accent);
    m.setPaintProperty("tw-selected-label", "text-color", p.accent);
    m.setPaintProperty("tw-selected-label", "text-halo-color", p.halo);
    m.setFilter("tw-halo", ["==", ["get", "id"], selectedId ?? ""]);
    m.setFilter("tw-selected-label", ["==", ["get", "id"], selectedId ?? ""]);

    // A shape appears when the date is inside its validity, or when the selected record links to it.
    const linked = selectedId ? geometriesFor(selectedId).map((g) => g.id) : [];
    const isLinked: maplibregl.ExpressionSpecification = ["in", ["get", "id"], ["literal", linked]];
    const on = (Object.keys(layers) as (keyof typeof layers)[]).filter((k) => layers[k]);

    // Primary date filter
    const time = ["all", [">=", dateNum, ["get", "from"]], ["<=", dateNum, ["get", "to"]]];

    // Comparison date filter (for split/swipe/then-now)
    const compTime = comparisonDate
      ? ["all", [">=", compDateNum, ["get", "from"]], ["<=", compDateNum, ["get", "to"]]]
      : ["==", ["get", "id"], ""]; // Never matches

    // The historical layers may not be added yet; this effect runs again when they are (geoReady).
    if (!m.getLayer("tw-geo-solid")) return;
    const shown = ["all", ["in", ["get", "layer"], ["literal", on]], ["any", time, compTime, isLinked]] as unknown as maplibregl.ExpressionSpecification;
    const polygons: maplibregl.ExpressionSpecification = ["==", ["geometry-type"], "Polygon"];
    const lines: maplibregl.ExpressionSpecification = ["==", ["geometry-type"], "LineString"];
    const schematic: maplibregl.ExpressionSpecification = ["==", ["get", "derivation"], "schematic"];

    // For split/swipe modes, we add a second set of layers with different styling
    if (comparisonMode === "split" || comparisonMode === "swipe" || comparisonMode === "then-now") {
      // Add comparison layers if they don't exist
      if (!m.getLayer("tw-geo-fill-comp")) {
        m.addLayer({ id: "tw-geo-fill-comp", type: "fill", source: "tw-geo", filter: polygons, paint: { "fill-color": p.accent, "fill-opacity": 0.15 } });
        m.addLayer({ id: "tw-geo-outline-comp", type: "line", source: "tw-geo", filter: polygons, paint: { "line-color": p.accent, "line-width": 1.5, "line-dasharray": [4, 2] } });
        m.addLayer({ id: "tw-geo-solid-comp", type: "line", source: "tw-geo", filter: ["all", lines, ["!", schematic]], layout: { "line-cap": "round" }, paint: { "line-color": p.accent, "line-width": 2.5, "line-dasharray": [6, 3] } });
      }

      // Update comparison layer filters
      const compShown = ["all", ["in", ["get", "layer"], ["literal", on]], compTime, ["!", isLinked]] as unknown as maplibregl.ExpressionSpecification;
      m.setFilter("tw-geo-fill-comp", ["all", polygons, compShown]);
      m.setFilter("tw-geo-outline-comp", ["all", polygons, compShown]);
      m.setFilter("tw-geo-solid-comp", ["all", lines, ["!", schematic], compShown]);
    } else {
      // Hide comparison layers in single mode
      if (m.getLayer("tw-geo-fill-comp")) {
        m.setLayoutProperty("tw-geo-fill-comp", "visibility", "none");
        m.setLayoutProperty("tw-geo-outline-comp", "visibility", "none");
        m.setLayoutProperty("tw-geo-solid-comp", "visibility", "none");
      }
    }

    m.setFilter("tw-geo-fill", ["all", polygons, shown]);
    m.setFilter("tw-geo-outline", ["all", polygons, shown]);
    m.setFilter("tw-geo-schematic", ["all", lines, schematic, shown]);
    m.setFilter("tw-geo-solid", ["all", lines, ["!", schematic], shown]);
    // Labelling only the selected record's shapes keeps the map readable.
    m.setFilter("tw-geo-label", ["all", polygons, shown, isLinked]);
    m.setFilter("tw-geo-label-line", ["all", lines, shown, isLinked]);

    const geoColor = ["case", isLinked, p.accent, ["==", ["get", "derivation"], "modern_reference"], p.modern, p.marker] as maplibregl.ExpressionSpecification;
    m.setPaintProperty("tw-geo-fill", "fill-color", geoColor);
    m.setPaintProperty("tw-geo-fill", "fill-opacity", ["case", isLinked, Math.min(0.75, boundaryOpacity * 1.4), boundaryOpacity]);
    m.setPaintProperty("tw-geo-outline", "line-color", geoColor);
    m.setPaintProperty("tw-geo-schematic", "line-color", geoColor);
    m.setPaintProperty("tw-geo-schematic", "line-width", ["case", isLinked, 5, 3]);
    m.setPaintProperty("tw-geo-solid", "line-color", geoColor);
    m.setPaintProperty("tw-geo-solid", "line-width", ["case", isLinked, 5, 3]);
    for (const id of ["tw-geo-label", "tw-geo-label-line"]) {
      m.setPaintProperty(id, "text-color", geoColor);
      m.setPaintProperty(id, "text-halo-color", p.halo);
    }
    for (const id of ["tw-points", "tw-halo", "tw-selected-label"]) m.setLayoutProperty(id, "visibility", layers.points ? "visible" : "none");
  }, [ready, geoReady, theme, date, comparisonDate, comparisonMode, selectedId, layers, boundaryOpacity]);

  useEffect(() => {
    const m = mapRef.current;
    if (!ready || !m) return;
    (m.getSource("tw-events") as maplibregl.GeoJSONSource | undefined)?.setData(toGeoJSON(events));
  }, [ready, events]);

  useEffect(() => {
    const m = mapRef.current;
    if (!ready || !m || !selectedId) return;
    // The map keeps this and adds it to every camera move, so it's set here and nowhere else.
    m.setPadding({ top: 0, right: 0, left: leftInset, bottom: bottomInset });
    const event = events.find((e) => e.id === selectedId);
    if (!event) return;
    const place = event.placeId ? placeById.get(event.placeId) : undefined;
    const shapes = geometriesFor(event.id);
    // Frame the shape when the record has one. Only a record without one gets a point-sized view.
    if (shapes.length) {
      const reduce = prefersReducedMotion();
      const { width } = m.getContainer().getBoundingClientRect();
      const edge = Math.min(70, (width - leftInset) / 7);
      m.fitBounds(boundsOf(shapes.map((s) => s.geometry), place ? [place.lng, place.lat] : undefined), { padding: edge, maxZoom: 13.5, duration: reduce ? 0 : 1800 });
      return;
    }
    if (!place) return;
    const camera = { center: [place.lng, place.lat] as [number, number], zoom: focusZoom };
    if (prefersReducedMotion()) m.jumpTo(camera);
    else m.flyTo({ ...camera, duration: 1800, curve: 1.3, essential: false });
  }, [ready, selectedId, events, focusZoom, leftInset, bottomInset]);

  return (
    <div className="relative h-full w-full bg-paper-3">
      <div ref={container} data-testid="atlas-map" data-ready={ready} className={`h-full w-full transition-opacity duration-500 ${styled ? "opacity-100" : "opacity-0"}`} aria-label="Map of historical events" role="region" />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-paper-3/80 z-10" aria-live="polite">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-bronze border-t-transparent mx-auto" />
            <p className="mt-3 text-sm text-ink-2">Loading map&hellip;</p>
          </div>
        </div>
      )}
      {failed && (
        <p role="alert" className="absolute inset-x-4 top-4 z-10 border border-line bg-paper-2 px-4 py-3 text-sm text-ink-2">
          The basemap couldn&rsquo;t be loaded. Events, sources and the timeline still work.
        </p>
      )}
    </div>
  );
}
