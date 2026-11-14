"use client";

import type { Map as MapLibreMap, MapMouseEvent } from "maplibre-gl";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PALETTE } from "./AtlasMap";
import { useAppearance, type Appearance } from "./ThemeToggle";

export type CoverageRegion = { id: string; label: { en: string }; imported: number; curated?: boolean };

/**
 * Imported-event count per country, as one bronze ramp, light to dark (dark mode runs dark to light).
 * Checked with the dataviz validator as an ordinal ramp against each theme's page colour:
 * monotone lightness, visible gaps between steps, and the first step clears the background.
 */
const STEPS = [
  { min: 1, label: "1–9" },
  { min: 10, label: "10–99" },
  { min: 100, label: "100–999" },
  { min: 1000, label: "1,000–9,999" },
  { min: 10000, label: "10,000 or more" },
];
const RAMP: Record<Appearance, string[]> = {
  light: ["#c49b55", "#a97c35", "#8a6027", "#674419", "#43280c"],
  dark: ["#6a5330", "#8f6d3d", "#b38b4b", "#d6ad66", "#f2d59a"],
};
const NO_DATA: Record<Appearance, { fill: string; hatch: string }> = {
  light: { fill: "#ece4d3", hatch: "#cbbfa6" },
  dark: { fill: "#1d232e", hatch: "#343c4a" },
};

const stepOf = (n: number) => STEPS.reduce((i, s, k) => (n >= s.min ? k : i), -1);

/** A diagonal hatch, so "no data yet" doesn't depend on telling two colours apart. */
function hatch(theme: Appearance) {
  const size = 8;
  const data = new Uint8Array(size * size * 4);
  const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [fr, fg, fb] = hex(NO_DATA[theme].fill);
  const [hr, hg, hb] = hex(NO_DATA[theme].hatch);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const on = (x + y) % size < 2;
      data.set(on ? [hr, hg, hb, 255] : [fr, fg, fb, 255], (y * size + x) * 4);
    }
  return { width: size, height: size, data };
}

function fillExpression(regions: CoverageRegion[], theme: Appearance) {
  const pairs = regions.filter((r) => r.imported > 0).flatMap((r) => [r.id, RAMP[theme][stepOf(r.imported)]]);
  return pairs.length ? ["match", ["get", "id"], ...pairs, "rgba(0,0,0,0)"] : "rgba(0,0,0,0)";
}

type Hover = { x: number; y: number; name: string; region?: CoverageRegion; other?: boolean };

export function WorldCoverageMap({ regions }: { regions: CoverageRegion[] }) {
  const router = useRouter();
  const theme = useAppearance();
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const regionsRef = useRef(regions);
  regionsRef.current = regions;
  const [ready, setReady] = useState(false);
  const [hover, setHover] = useState<Hover | null>(null);

  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | undefined;
    let observer: ResizeObserver | undefined;
    (async () => {
      const maplibre = (await import("maplibre-gl")).default;
      if (cancelled || !container.current) return;
      const t = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
      map = new maplibre.Map({
        container: container.current,
        // No basemap tiles: the countries are the picture. Present-day outlines from Natural Earth (public domain).
        style: { version: 8, sources: {}, layers: [{ id: "water", type: "background", paint: { "background-color": PALETTE[t].water } }] },
        bounds: [[-168, -56], [190, 78]],
        fitBoundsOptions: { padding: 8 },
        renderWorldCopies: false,
        dragRotate: false,
        attributionControl: { compact: true, customAttribution: "Outlines: Natural Earth" },
      });
      const m = map;
      mapRef.current = m;
      m.touchZoomRotate.disableRotation();
      m.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
      observer = new ResizeObserver(() => m.resize());
      observer.observe(container.current);
      // Not "load", which waits for every tile: slow tiles shouldn't hold back the coverage layers.
      m.once("style.load", async () => {
        const world = await fetch("/data/world-countries.json").then((r) => r.json());
        if (cancelled) return;
        m.addImage("no-data", hatch(t));
        m.addSource("countries", { type: "geojson", data: world });
        m.addLayer({ id: "other-land", type: "fill", source: "countries", filter: ["has", "other"], paint: { "fill-color": PALETTE[t].land } });
        m.addLayer({ id: "no-data", type: "fill", source: "countries", filter: ["!", ["has", "other"]], paint: { "fill-pattern": "no-data" } });
        m.addLayer({ id: "coverage", type: "fill", source: "countries", paint: { "fill-color": fillExpression(regionsRef.current, t) as never } });
        m.addLayer({ id: "borders", type: "line", source: "countries", paint: { "line-color": PALETTE[t].land, "line-width": 0.6 } });
        m.addLayer({ id: "curated", type: "line", source: "countries", filter: ["in", ["get", "id"], ["literal", regionsRef.current.filter((r) => r.curated).map((r) => r.id)]], paint: { "line-color": PALETTE[t].accent, "line-width": 2.2 } });
        m.addLayer({ id: "hovered", type: "line", source: "countries", filter: ["==", ["get", "id"], ""], paint: { "line-color": PALETTE[t].marker, "line-width": 1.8 } });
        const move = (e: MapMouseEvent) => {
          const f = m.queryRenderedFeatures(e.point, { layers: ["no-data", "other-land"] })[0];
          if (!f) {
            setHover(null);
            m.setFilter("hovered", ["==", ["get", "id"], ""]);
            m.getCanvas().style.cursor = "";
            return;
          }
          const id = (f.properties.id as string | undefined) ?? "";
          const region = regionsRef.current.find((r) => r.id === id);
          m.setFilter("hovered", ["==", ["get", "id"], id]);
          m.getCanvas().style.cursor = region ? "pointer" : "";
          setHover({ x: e.point.x, y: e.point.y, name: f.properties.name as string, region, other: !!f.properties.other });
        };
        m.on("mousemove", move);
        m.on("mouseout", () => { setHover(null); m.setFilter("hovered", ["==", ["get", "id"], ""]); });
        m.on("click", (e) => {
          const f = m.queryRenderedFeatures(e.point, { layers: ["no-data"] })[0];
          const region = f && regionsRef.current.find((r) => r.id === f.properties.id);
          if (region) router.push(`/atlas/${region.id}`);
        });
        (window as unknown as { __coverageMap?: MapLibreMap }).__coverageMap = m;
        setReady(true);
      });
    })();
    return () => {
      cancelled = true;
      observer?.disconnect();
      map?.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, [router]);

  useEffect(() => {
    const m = mapRef.current;
    if (!ready || !m) return;
    m.setPaintProperty("water", "background-color", PALETTE[theme].water);
    m.updateImage("no-data", hatch(theme));
    m.setPaintProperty("coverage", "fill-color", fillExpression(regions, theme) as never);
    m.setPaintProperty("borders", "line-color", PALETTE[theme].land);
    m.setPaintProperty("other-land", "fill-color", PALETTE[theme].land);
    m.setPaintProperty("curated", "line-color", PALETTE[theme].accent);
    m.setFilter("curated", ["in", ["get", "id"], ["literal", regions.filter((r) => r.curated).map((r) => r.id)]]);
    m.setPaintProperty("hovered", "line-color", PALETTE[theme].marker);
  }, [ready, theme, regions]);

  const covered = regions.filter((r) => r.imported > 0).length;

  return (
    <figure className="m-0">
      <div className="relative overflow-hidden rounded-lg border border-line">
        <div ref={container} data-testid="coverage-map" data-ready={ready} className="h-[52vw] max-h-[560px] min-h-[260px] w-full" role="img"
          aria-label={`World map of imported events per country. ${covered} of 197 countries have imported events. The list below has the same information.`} />
        {hover && (
          <div role="tooltip" className="pointer-events-none absolute z-10 min-w-[11rem] rounded-md border border-line bg-paper px-3 py-2 text-sm shadow-lg"
            style={{ left: Math.min(hover.x + 14, (container.current?.clientWidth ?? 400) - 200), top: Math.max(hover.y - 12, 4) }}>
            <p className="font-serif text-base leading-tight text-ink">{hover.name}</p>
            {hover.region ? (
              <>
                <p className="mt-1 text-ink"><span className="font-medium">{hover.region.imported.toLocaleString("en")}</span> imported events</p>
                <p className="text-xs text-ink-2">{hover.region.curated ? "Also has hand-checked records" : "Imported, not reviewed"}</p>
                <p className="mt-1 text-xs text-bronze">Click to open its atlas</p>
              </>
            ) : hover.other ? (
              <p className="mt-1 text-xs text-ink-2">Not one of the 197 sovereign states in this atlas</p>
            ) : (
              <p className="mt-1 text-xs text-ink-2">No events imported yet</p>
            )}
          </div>
        )}
      </div>
      <figcaption className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-2">
        <span className="text-ink">Imported events per country</span>
        <ul className="flex flex-wrap items-center gap-x-3 gap-y-1" data-testid="coverage-legend">
          {STEPS.map((s, i) => (
            <li key={s.min} className="flex items-center gap-1.5"><span aria-hidden className="inline-block h-3 w-4 rounded-sm" style={{ background: RAMP[theme][i] }} />{s.label}</li>
          ))}
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-3 w-4 rounded-sm border border-line" style={{ background: `repeating-linear-gradient(135deg, ${NO_DATA[theme].hatch} 0 2px, ${NO_DATA[theme].fill} 2px 6px)` }} />
            None yet
          </li>
          <li className="flex items-center gap-1.5"><span aria-hidden className="inline-block h-3 w-4 rounded-sm border-2" style={{ borderColor: PALETTE[theme].accent }} />Has hand-checked records</li>
        </ul>
        <span className="basis-full">This shows how much Wikidata has tagged to each country, not how much history happened there. Present-day borders.</span>
      </figcaption>
    </figure>
  );
}
