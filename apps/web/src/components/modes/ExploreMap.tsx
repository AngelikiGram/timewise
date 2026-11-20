"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { artistOf, type Credit } from "@/lib/explore";
import { applyBasemapPalette } from "../AtlasMap";
import { MiniMap } from "../lessons/activities";
import { useAppearance } from "../ThemeToggle";
import { enrich, type Enrichment } from "@/lib/wikidata";

export type MapItem = {
  id: string; label: string; lng: number; lat: number;
  /** Which switchable layer it belongs to. */
  layer: string;
  year?: number | null;
  /** One line under the name: "architect · 1907 · Hütteldorf". */
  sub?: string;
  links?: { href: string; label: string; external?: boolean }[];
  image?: Credit;
};
export type MapLayer = { id: string; label: string; color: string };

const BASES = [
  { id: "muted", label: "Muted", url: "https://tiles.openfreemap.org/styles/positron" },
  { id: "detailed", label: "Detailed", url: "https://tiles.openfreemap.org/styles/liberty" },
  { id: "dark", label: "Dark", url: "https://tiles.openfreemap.org/styles/dark" },
] as const;
type Base = (typeof BASES)[number]["id"];
/** Earlier years cooler, later warmer; always shown with its legend. */
const RAMP = ["#2f6f8f", "#3d7f4e", "#a8642a", "#9b2f2f"];

/**
 * An interactive map for the four ways in: zoom and full screen, a choice of base map, layers to switch,
 * crowded points grouped until you zoom in, names on hover, and a card with links on click.
 * Falls back to a static outline map when WebGL isn't available.
 */
export function ExploreMap({ items, layers, label, height = 440, colorByYear = false, focusId }: { items: MapItem[]; layers: MapLayer[]; label: string; height?: number; colorByYear?: boolean; focusId?: string | null }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const theme = useAppearance();
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [base, setBase] = useState<Base>("muted");
  const [off, setOff] = useState<Set<string>>(new Set());
  const [hover, setHover] = useState<{ x: number; y: number; text: string; sub?: string } | null>(null);
  const [selected, setSelected] = useState<MapItem | null>(null);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const visible = useMemo(() => items.filter((i) => !off.has(i.layer)), [items, off]);
  const years = items.map((i) => i.year).filter((y): y is number => y != null);
  const [y0, y1] = [Math.min(...years), Math.max(...years)];
  const colorOf = useMemo(() => Object.fromEntries(layers.map((l) => [l.id, l.color])), [layers]);
  const cluster = items.length > 60;

  const data = useMemo(() => ({
    type: "FeatureCollection" as const,
    features: visible.map((i) => ({ type: "Feature" as const, properties: { id: i.id, color: colorOf[i.layer] ?? "#8a5a1c", year: i.year ?? y0 }, geometry: { type: "Point" as const, coordinates: [i.lng, i.lat] } })),
  }), [visible, colorOf, y0]);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const dataRef = useRef(data);
  dataRef.current = data;

  // Sources and layers, added again whenever the base style changes.
  const install = (m: MapLibreMap) => {
    if (m.getSource("items")) return;
    m.addSource("items", { type: "geojson", data: dataRef.current, cluster, clusterRadius: 38, clusterMaxZoom: 11 });
    m.addLayer({ id: "clusters", type: "circle", source: "items", filter: ["has", "point_count"], paint: {
      "circle-color": ["step", ["get", "point_count"], "#a8642a", 10, "#8a4f1c", 50, "#7a1f2b"], "circle-opacity": 0.95, "circle-stroke-width": 3, "circle-stroke-color": "#ffffff",
      "circle-radius": ["step", ["get", "point_count"], 16, 10, 20, 50, 25, 200, 31],
    } });
    m.addLayer({ id: "cluster-count", type: "symbol", source: "items", filter: ["has", "point_count"], layout: { "text-field": ["get", "point_count_abbreviated"], "text-font": ["Noto Sans Bold"], "text-size": ["step", ["get", "point_count"], 14, 50, 16, 200, 18], "text-allow-overlap": true, "text-ignore-placement": true }, paint: { "text-color": "#ffffff", "text-halo-color": "rgba(40,20,5,0.85)", "text-halo-width": 1.6 } });
    const span = Math.max(1, y1 - y0);
    m.addLayer({ id: "pts", type: "circle", source: "items", filter: ["!", ["has", "point_count"]], paint: {
      "circle-color": colorByYear && years.length ? ["interpolate", ["linear"], ["get", "year"], y0, RAMP[0], y0 + span / 3, RAMP[1], y0 + (2 * span) / 3, RAMP[2], y1, RAMP[3]] : ["get", "color"],
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 4.5, 10, 7.5], "circle-stroke-width": 1.5, "circle-stroke-color": "#f4ecdc",
    } });
    m.addLayer({ id: "picked", type: "circle", source: "items", filter: ["==", ["get", "id"], ""], paint: { "circle-radius": 13, "circle-color": "rgba(0,0,0,0)", "circle-stroke-width": 3, "circle-stroke-color": "#7a1f2b" } });
  };

  const fit = (m: MapLibreMap, list = visible) => {
    if (!list.length) return;
    if (list.length === 1) { m.easeTo({ center: [list[0].lng, list[0].lat], zoom: 11 }); return; }
    const xs = list.map((i) => i.lng), ys = list.map((i) => i.lat);
    m.fitBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]], { padding: 48, maxZoom: 12, duration: 600 });
  };

  useEffect(() => {
    let m: MapLibreMap | undefined;
    let cancelled = false;
    (async () => {
      let lib;
      try { lib = (await import("maplibre-gl")).default; } catch { setFailed(true); return; }
      if (cancelled || !box.current) return;
      try {
        m = new lib.Map({ container: box.current, style: BASES[0].url, center: [15, 47], zoom: 3, attributionControl: { compact: true } });
      } catch { setFailed(true); return; }
      map.current = m;
      m.addControl(new lib.NavigationControl({ showCompass: false }), "top-right");
      m.addControl(new lib.FullscreenControl(), "top-right");
      m.addControl(new lib.ScaleControl({ maxWidth: 100 }), "bottom-left");
      m.on("style.load", () => {
        if (document.documentElement.dataset.theme === "dark" && m!.getStyle().name?.toLowerCase().includes("positron")) applyBasemapPalette(m!, "dark");
        const fresh = !m!.getSource("items");
        install(m!);
        setReady(true);
        // A new base map comes with the points framed again.
        if (fresh && m!.loaded()) fit(m!, visibleRef.current);
      });
      m.once("load", () => fit(m!));
      m.on("mousemove", (e) => {
        const f = m!.queryRenderedFeatures(e.point, { layers: ["pts", "clusters"].filter((l) => m!.getLayer(l)) })[0];
        m!.getCanvas().style.cursor = f ? "pointer" : "";
        if (!f) { setHover(null); return; }
        if (f.properties?.cluster) {
          const at = { x: e.point.x, y: e.point.y };
          setHover({ ...at, text: `${f.properties.point_count} places here`, sub: "Click to zoom in" });
          (m!.getSource("items") as GeoJSONSource).getClusterLeaves(f.properties.cluster_id, 4, 0).then((leaves) => {
            const names = leaves.map((l) => byIdRef.current.get(l.properties?.id)?.label).filter(Boolean);
            setHover((h) => (h && h.x === at.x && h.y === at.y ? { ...h, sub: `${names.join(" · ")}${f.properties!.point_count > names.length ? " …" : ""} · click to zoom in` } : h));
          }, () => {});
        }
        else { const it = byIdRef.current.get(f.properties?.id); if (it) setHover({ x: e.point.x, y: e.point.y, text: it.label, sub: it.sub }); }
      });
      m.on("mouseout", () => setHover(null));
      m.on("click", async (e) => {
        const f = m!.queryRenderedFeatures(e.point, { layers: ["pts", "clusters"].filter((l) => m!.getLayer(l)) })[0];
        if (!f) { setSelected(null); return; }
        if (f.properties?.cluster) {
          const z = await (m!.getSource("items") as GeoJSONSource).getClusterExpansionZoom(f.properties.cluster_id);
          m!.easeTo({ center: (f.geometry as GeoJSON.Point).coordinates as [number, number], zoom: z + 0.3 });
          return;
        }
        setSelected(byIdRef.current.get(f.properties?.id) ?? null);
      });
      m.on("error", (ev) => { if (String(ev.error?.message ?? "").includes("styles/")) setFailed(true); });
    })();
    return () => { cancelled = true; m?.remove(); map.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const byIdRef = useRef(byId);
  byIdRef.current = byId;

  // New data: update the source and frame it.
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    (m.getSource("items") as GeoJSONSource | undefined)?.setData(data);
    fit(m);
    setSelected((s) => (s && visible.some((v) => v.id === s.id) ? s : null));
  }, [ready, data]); // eslint-disable-line react-hooks/exhaustive-deps

  // Base map: swap the style; layers return on style.load.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const url = BASES.find((b) => b.id === base)!.url;
    setReady(false);
    m.setStyle(url);
  }, [base]);
  useEffect(() => { const m = map.current; if (ready && m && base === "muted") applyBasemapPalette(m, theme); }, [theme, ready, base]);

  useEffect(() => { const m = map.current; if (ready && m?.getLayer("picked")) m.setFilter("picked", ["==", ["get", "id"], selected?.id ?? ""]); }, [selected, ready]);

  // Something chosen outside the map (a list row): fly there and open its card.
  useEffect(() => {
    const m = map.current;
    const it = focusId ? byId.get(focusId) : undefined;
    if (!ready || !m || !it) return;
    setSelected(it);
    m.flyTo({ center: [it.lng, it.lat], zoom: Math.max(m.getZoom(), 10), duration: 800 });
  }, [focusId, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  if (failed) return <MiniMap points={visible.map((i) => ({ label: "", lng: i.lng, lat: i.lat }))} label={label} />;

  return (
    <div className="relative overflow-hidden rounded-lg border border-line bg-paper-3" style={{ height }} role="region" aria-label={label} data-testid="explore-map" data-ready={ready}>
      {/* MapLibre makes its container position: relative, so it sits inside an absolute wrapper to keep its height. */}
      <div className="absolute inset-0"><div ref={box} className="h-full w-full" /></div>
      {!ready && <div className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-ink-2" role="status">Loading the map…</div>}

      {/* Layers and base map */}
      <div className="absolute left-2 top-2 z-10 max-w-[14rem] rounded-lg border border-line bg-paper/95 p-2 text-xs shadow-sm" data-testid="map-layers">
        <p className="font-semibold">Layers</p>
        <ul className="mt-1 grid gap-0.5">
          {layers.map((l) => {
            const n = items.filter((i) => i.layer === l.id).length;
            if (!n) return null;
            return (
              <li key={l.id}>
                <label className="flex cursor-pointer items-center gap-1.5">
                  <input type="checkbox" checked={!off.has(l.id)} onChange={() => setOff((s) => { const x = new Set(s); if (x.has(l.id)) x.delete(l.id); else x.add(l.id); return x; })} />
                  {!colorByYear && <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />}
                  <span className="truncate">{l.label}</span><span className="ml-auto tabular-nums text-ink-2">{n}</span>
                </label>
              </li>
            );
          })}
        </ul>
        {colorByYear && years.length > 0 && (
          <div className="mt-1.5" aria-label={`Colour shows the year, from ${y0} to ${y1}`}>
            <span aria-hidden className="block h-2 rounded" style={{ background: `linear-gradient(90deg, ${RAMP.join(",")})` }} />
            <span className="mt-0.5 flex justify-between tabular-nums text-ink-2"><span>{y0}</span><span>{y1}</span></span>
          </div>
        )}
        <label className="mt-1.5 flex items-center gap-1.5 border-t border-line pt-1.5">Base
          <select value={base} onChange={(e) => setBase(e.target.value as Base)} className="min-w-0 flex-1 rounded border border-line bg-paper-2 px-1 py-0.5" data-testid="map-base">
            {BASES.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
          </select>
        </label>
        <button type="button" className="link mt-1 text-xs" onClick={() => map.current && fit(map.current)}>Show all</button>
      </div>

      {/* Hover: the name, at the pointer */}
      {hover && (
        <div className="pointer-events-none absolute z-20 max-w-[16rem] -translate-x-1/2 -translate-y-full rounded-md border border-line bg-paper px-2 py-1 text-xs shadow" style={{ left: hover.x, top: hover.y - 10 }} data-testid="map-hover">
          <p className="font-semibold">{hover.text}</p>{hover.sub && <p className="text-ink-2">{hover.sub}</p>}
        </div>
      )}

      {/* Click: a card with what's known and where to go next */}
      {selected && (
        <div className="absolute bottom-8 left-2 right-2 z-10 max-h-[75%] max-w-md overflow-y-auto rounded-lg border border-bronze/60 bg-paper p-3 shadow-md sm:right-auto" data-testid="map-card">
          <button type="button" onClick={() => setSelected(null)} className="absolute right-1.5 top-1 px-1 text-ink-2 hover:text-ink" aria-label="Close">✕</button>
          <div className="flex gap-3">
            {selected.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selected.image.url} alt="" className="h-16 w-16 shrink-0 rounded object-cover" />
            )}
            <div className="min-w-0 pr-4">
              <p className="font-serif text-lg leading-tight">{selected.label}</p>
              {selected.sub && <p className="text-xs text-ink-2">{selected.sub}</p>}
              {selected.image && <p className="truncate text-[10px] text-ink-2">Image: {[artistOf(selected.image.artist), selected.image.license].filter(Boolean).join(", ") || "Wikimedia Commons"}</p>}
            </div>
          </div>
          <Details id={selected.id} hasImage={!!selected.image} />
          {(() => { const links = [...(selected.links ?? []), ...(/^Q\d+$/.test(selected.id) && !(selected.links ?? []).some((l) => l.href.includes("/stories/live")) ? [{ href: `/stories/live?q=${selected.id}`, label: "Its story" }, { href: `/explore/why?q=${selected.id}`, label: "Why?" }] : [])]; return links.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {links.map((l) => l.external
                ? <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm !min-h-7 !px-2 !text-xs">{l.label} ↗</a>
                : <Link key={l.href} href={l.href} className="btn btn-secondary btn-sm !min-h-7 !px-2 !text-xs">{l.label}</Link>)}
            </div>
          ); })()}
        </div>
      )}
    </div>
  );
}

/**
 * What is known about a record, fetched when its card opens: Wikidata's key facts, Wikipedia's summary
 * (quoted under CC BY-SA, with its link) and a picture. Shared cache, so a second click is instant.
 */
function Details({ id, hasImage }: { id: string; hasImage: boolean }) {
  const [d, setD] = useState<Enrichment | null | "none">(null);
  const [more, setMore] = useState(false);
  useEffect(() => {
    setD(null); setMore(false);
    if (!/^Q\d+$/.test(id)) { setD("none"); return; }
    let live = true;
    enrich(id).then((x) => { if (live) setD(x); }, () => { if (live) setD("none"); });
    return () => { live = false; };
  }, [id]);
  if (d === "none") return null;
  if (!d) return <p className="mt-2 text-xs text-ink-2" role="status"><span className="inline-block h-2 w-2 animate-pulse rounded-full bg-bronze align-middle" /> Reading about it…</p>;
  const text = d.summary?.text ?? "";
  const short = text.length > 280 && !more ? `${text.slice(0, 270).replace(/\s\S*$/, "")}…` : text;
  return (
    <div className="mt-2 border-t border-line pt-2 text-sm" data-testid="map-card-details">
      {!hasImage && d.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={d.image.url} alt={d.image.caption ?? ""} className="mb-2 max-h-36 w-full rounded object-cover" />
      )}
      {text ? (
        <p className="leading-snug">{short}{text.length > 280 && <button type="button" className="link ml-1 text-xs" onClick={() => setMore(!more)}>{more ? "less" : "more"}</button>}
          <span className="mt-0.5 block text-[10px] text-ink-2">Wikipedia, <a className="hover:underline" href={d.summary!.url} target="_blank" rel="noopener noreferrer">{d.summary!.title}</a>, CC BY-SA 4.0{!hasImage && d.image ? <> · image <a className="hover:underline" href={d.image.page} target="_blank" rel="noopener noreferrer">Commons</a>{d.image.license ? `, ${d.image.license}` : ""}</> : null}</span></p>
      ) : <p className="text-xs text-ink-2">Wikipedia has no English article on this yet.</p>}
      {d.facts.length > 0 && (
        <dl className="mt-2 grid gap-0.5 text-xs">
          {d.facts.slice(0, 4).map((f) => <div key={f.label} className="flex gap-2"><dt className="w-24 shrink-0 text-ink-2">{f.label}</dt><dd className="min-w-0">{f.text ?? f.values.map((x) => x.label).join(", ")}</dd></div>)}
        </dl>
      )}
    </div>
  );
}
