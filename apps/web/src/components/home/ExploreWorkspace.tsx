"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import { CATEGORY_LABELS } from "@/lib/categories";
import { formatImportedDate, formatYear, yearOf, type Precision } from "@/lib/dates";
import { asset } from "@/lib/paths";
import { fetchNodeFacts, fetchRecord, type Group, type RecordData } from "@/lib/record";
import { atlasHref, loadRegions, type RegionRow } from "@/lib/world-index";
import { applyBasemapPalette, STYLE_URL } from "../AtlasMap";
import { categoryIcon, Icon, iconPath, type IconName } from "../icons";
import { useAppearance } from "../ThemeToggle";

type W = {
  id: string; title: { en?: string; de?: string }; description?: string; category: string; start: string; end?: string;
  precision: Precision; lng?: number; lat?: number; links: number; home?: string; multi?: boolean; nopin?: boolean; url: string;
};
type Bubble = { id: string; label: string; relation: string; documented: boolean; lng: number; lat: number; icon: IconName; inWorld: boolean };

const PERIODS: { label: string; from: number; to: number }[] = [
  { label: "Antiquity · to 500", from: -3500, to: 499 },
  { label: "Middle Ages · 500–1500", from: 500, to: 1499 },
  { label: "Early modern · 1500–1800", from: 1500, to: 1799 },
  { label: "1800–1914", from: 1800, to: 1913 },
  { label: "1914–1945", from: 1914, to: 1945 },
  { label: "Since 1945", from: 1946, to: 2026 },
];
const GROUP_ICON: Partial<Record<Group, IconName>> = { cause: "cause", sequence: "sequence", parts: "parts", people: "people", places: "place", ideas: "idea" };
const windowFor = (y: number) => (y < 500 ? 60 : y < 1500 ? 25 : y < 1800 ? 10 : 4);
const titleOf = (e: W) => e.title.en ?? e.title.de ?? e.id;
const located = (e: W) => e.lng !== undefined && e.lat !== undefined && !e.multi && !e.nopin && !!e.title.en;

let world: Promise<W[]> | null = null;
const loadWorld = () => (world ??= fetch(asset("/data/regions/world.json")).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))).then((d: { events: W[] }) => d.events).catch((e) => { world = null; throw e; }));

function svgIcon(name: IconName, size: number) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${iconPath(name)}"/></svg>`;
}

/** A gentle arc between two points, so lines from the focus fan out instead of overlapping. */
function arc(a: [number, number], b: [number, number], bend = 0.18): [number, number][] {
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const c: [number, number] = [mx - dy * bend, my + dx * bend];
  return Array.from({ length: 25 }, (_, i) => {
    const t = i / 24;
    return [(1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]];
  });
}

function WorkspaceMap({ focus, bubbles, onPick, period, onFocus, rangeKey }: { focus: W | null; bubbles: Bubble[]; onPick: (b: Bubble) => void; period: W[]; onFocus: (id: string) => void; rangeKey: string }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const markers = useRef<Marker[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lib = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const theme = useAppearance();
  const pick = useRef(onPick);
  pick.current = onPick;
  const focusRef = useRef(onFocus);
  focusRef.current = onFocus;

  useEffect(() => {
    let m: MapLibreMap | undefined;
    let cancelled = false;
    (async () => {
      try {
        lib.current = (await import("maplibre-gl")).default;
      } catch { setFailed(true); return; }
      if (cancelled || !box.current) return;
      const created: MapLibreMap = new lib.current.Map({ container: box.current, style: STYLE_URL, center: [15, 35], zoom: 1.6, attributionControl: { compact: true }, cooperativeGestures: false });
      m = created;
      map.current = created;
      created.addControl(new lib.current.NavigationControl({ showCompass: false }), "top-right");
      created.on("error", (e) => { if (String(e.error?.message ?? "").includes("styles/")) setFailed(true); });
      created.once("style.load", () => {
        applyBasemapPalette(m!, document.documentElement.dataset.theme === "dark" ? "dark" : "light");
        m!.addSource("ws-lines", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        m!.addLayer({ id: "ws-doc", type: "line", source: "ws-lines", filter: ["==", ["get", "documented"], true], paint: { "line-color": "#8a5a1c", "line-width": 2.2, "line-opacity": 0.85 } });
        m!.addLayer({ id: "ws-ctx", type: "line", source: "ws-lines", filter: ["==", ["get", "documented"], false], paint: { "line-color": "#8a5a1c", "line-width": 1.6, "line-opacity": 0.7, "line-dasharray": [2, 2] } });
        // Every well-documented record of the period: a dot each, and names where there's room for them.
        m!.addSource("ws-events", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        m!.addLayer({ id: "ws-dots", type: "circle", source: "ws-events", paint: {
          "circle-radius": ["interpolate", ["linear"], ["get", "links"], 10, 3.5, 60, 6, 150, 8],
          "circle-color": "#8a5a1c", "circle-opacity": 0.75, "circle-stroke-width": 1.2, "circle-stroke-color": "#f4ecdc",
        } });
        m!.addLayer({ id: "ws-names", type: "symbol", source: "ws-events", filter: ["<", ["get", "rank"], 40], layout: {
          "text-field": ["get", "title"], "text-font": ["Noto Sans Regular"], "text-size": 11.5, "text-max-width": 9,
          "text-variable-anchor": ["top", "bottom", "left", "right"], "text-radial-offset": 0.9, "text-optional": true,
          "symbol-sort-key": ["-", 0, ["get", "links"]],
        }, paint: { "text-color": "#3a2d1c", "text-halo-color": "#f4ecdc", "text-halo-width": 1.6 } });
        m!.on("click", "ws-dots", (e) => { const id = e.features?.[0]?.properties?.id; if (id) focusRef.current(id); });
        m!.on("mouseenter", "ws-dots", () => { m!.getCanvas().style.cursor = "pointer"; });
        m!.on("mouseleave", "ws-dots", () => { m!.getCanvas().style.cursor = ""; });
        setReady(true);
      });
    })();
    return () => { cancelled = true; markers.current.forEach((x) => x.remove()); m?.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    applyBasemapPalette(m, theme);
    m.setPaintProperty("ws-names", "text-color", theme === "dark" ? "#ebe4d4" : "#3a2d1c");
    m.setPaintProperty("ws-names", "text-halo-color", theme === "dark" ? "#1c2230" : "#f4ecdc");
    m.setPaintProperty("ws-dots", "circle-color", theme === "dark" ? "#d9a35b" : "#8a5a1c");
    m.setPaintProperty("ws-dots", "circle-stroke-color", theme === "dark" ? "#1c2230" : "#f4ecdc");
  }, [ready, theme]);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const shown = new Set([focus?.id, ...bubbles.map((b) => b.id)]);
    (m.getSource("ws-events") as import("maplibre-gl").GeoJSONSource).setData({
      type: "FeatureCollection",
      features: period.filter((e) => !shown.has(e.id)).map((e, rank) => ({ type: "Feature", properties: { id: e.id, title: titleOf(e), links: e.links, rank }, geometry: { type: "Point", coordinates: [e.lng!, e.lat!] } })),
    });
  }, [ready, period, focus, bubbles]);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m || !lib.current || !focus) return;
    markers.current.forEach((x) => x.remove());
    markers.current = [];
    const from: [number, number] = [focus.lng!, focus.lat!];
    (m.getSource("ws-lines") as import("maplibre-gl").GeoJSONSource).setData({
      type: "FeatureCollection",
      features: bubbles.map((b, i) => ({ type: "Feature", properties: { documented: b.documented }, geometry: { type: "LineString", coordinates: arc(from, [b.lng, b.lat], i % 2 ? 0.18 : -0.18) } })),
    });
    // Linked records sit above their point, the focus below it, so the two never cover each other.
    const add = (el: HTMLElement, at: [number, number], anchor: "bottom" | "top" = "bottom") => markers.current.push(new lib.current.Marker({ element: el, anchor, offset: [0, anchor === "top" ? 6 : -6] }).setLngLat(at).addTo(m));
    const dot = (at: [number, number], focusDot = false) => { const d = document.createElement("span"); d.className = focusDot ? "tw-dot tw-dot-focus" : "tw-dot"; d.setAttribute("aria-hidden", "true"); markers.current.push(new lib.current.Marker({ element: d }).setLngLat(at).addTo(m)); };
    for (const b of bubbles) {
      const el = document.createElement("button");
      el.type = "button";
      el.className = `tw-bubble ${b.documented ? "" : "tw-bubble-ctx"}`;
      el.setAttribute("aria-label", `${b.label}: ${b.relation}${b.documented ? "" : " (a coincidence of time, not a documented link)"}`);
      el.innerHTML = `${svgIcon(b.icon, 16)}<span>${b.label.replace(/[<>&]/g, "")}</span>`;
      el.addEventListener("click", () => pick.current(b));
      dot([b.lng, b.lat]);
      add(el, [b.lng, b.lat]);
    }
    const f = document.createElement("div");
    f.className = "tw-bubble tw-bubble-focus";
    f.setAttribute("aria-hidden", "true");
    f.innerHTML = `${svgIcon(categoryIcon(focus.category), 18)}<span>${titleOf(focus).replace(/[<>&]/g, "")}</span>`;
    dot(from, true);
    add(f, from, "top");
    // Keep the zoom the reader chose: only pan when the new focus is off screen.
    if (!m.getBounds().contains(from)) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      m.easeTo({ center: from, duration: reduce ? 0 : 700 });
    }
  }, [ready, focus, bubbles]);

  // A new period or range: frame its records once.
  useEffect(() => {
    const m = map.current;
    if (!ready || !m || !period.length) return;
    const xs = period.map((e) => e.lng!), ys = period.map((e) => e.lat!);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const side = Math.min(80, m.getContainer().clientWidth * 0.08);
    m.fitBounds([[Math.min(...xs), Math.max(-60, Math.min(...ys))], [Math.max(...xs), Math.min(75, Math.max(...ys))]], { padding: { top: 70, bottom: 50, left: side, right: side }, maxZoom: 5, duration: reduce ? 0 : 800 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, rangeKey]);

  return (
    <div className="absolute inset-0">
      {/* MapLibre makes its container position: relative, so it fills a positioned wrapper instead of being one. */}
      <div ref={box} className="h-full w-full" data-testid="workspace-map" data-ready={ready} />
      {failed && <div className="absolute inset-0 grid place-items-center bg-paper-3 p-6 text-center text-sm text-ink-2">The base map couldn&rsquo;t be loaded. The timeline and the record still work.</div>}
    </div>
  );
}

/**
 * The home workspace: one record in focus on a map, a few of its links drawn as labelled bubbles,
 * a timeline of the period underneath, and a short record panel. Records are imported from Wikidata;
 * documented links come from Wikidata statements, the rest are labelled as shared time.
 */
export function ExploreWorkspace() {
  const [events, setEvents] = useState<W[] | null>(null);
  const [regions, setRegions] = useState<RegionRow[]>([]);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [period, setPeriod] = useState(3);
  const [custom, setCustom] = useState<[number, number] | null>(null);
  const [draft, setDraft] = useState<[number, number] | null>(null);
  const dragFrom = useRef<number | null>(null);
  const axis = useRef<HTMLDivElement>(null);
  const [fromText, setFromText] = useState("");
  const [toText, setToText] = useState("");
  const [focusId, setFocusId] = useState<string | null>(null);
  const [record, setRecord] = useState<RecordData | null>(null);
  const [documented, setDocumented] = useState<Bubble[]>([]);
  const [linkState, setLinkState] = useState<"idle" | "loading" | "done" | "failed">("idle");

  useEffect(() => {
    setFailed(false);
    loadWorld().then(setEvents, () => setFailed(true));
    loadRegions().then(setRegions, () => {});
  }, [retry]);

  const p = custom ? { label: `${formatYear(custom[0])}–${formatYear(custom[1])}`, from: custom[0], to: custom[1] } : PERIODS[period];
  useEffect(() => { setFromText(String(p.from)); setToText(String(Math.min(p.to, 2026))); }, [p.from, p.to]);
  const inPeriod = useMemo(() => (events ?? []).filter((e) => located(e) && yearOf(e.start) >= p.from && yearOf(e.start) <= p.to).sort((a, b) => b.links - a.links), [events, p]);
  const focus = useMemo(() => (events ?? []).find((e) => e.id === focusId) ?? inPeriod[0] ?? null, [events, focusId, inPeriod]);
  const country = (k?: string) => regions.find((r) => r.id === k)?.label.en ?? "";

  // Documented links of the focus, with places, from Wikidata.
  useEffect(() => {
    if (!focus) return;
    const ac = new AbortController();
    setRecord(null);
    setDocumented([]);
    setLinkState("loading");
    fetchRecord(focus.id, ac.signal)
      .then(async (r) => {
        setRecord(r);
        const links = r.links.filter((l) => l.documented && GROUP_ICON[l.group] && l.group !== "places").slice(0, 10);
        const facts = await fetchNodeFacts(links.map((l) => l.target), ac.signal).catch(() => ({} as Awaited<ReturnType<typeof fetchNodeFacts>>));
        const ids = new Set((events ?? []).map((e) => e.id));
        setDocumented(
          links.filter((l) => facts[l.target]?.coord).slice(0, 4).map((l) => ({
            id: l.target, label: l.label, relation: l.relation, documented: true, lng: facts[l.target].coord![0], lat: facts[l.target].coord![1], icon: GROUP_ICON[l.group]!, inWorld: ids.has(l.target),
          })),
        );
        setLinkState("done");
      })
      .catch((e) => { if (e.name !== "AbortError") setLinkState("failed"); });
    return () => ac.abort();
  }, [focus, events]);

  // Same time, elsewhere: from the index, clearly not a documented link.
  const contextual = useMemo<Bubble[]>(() => {
    if (!focus) return [];
    const y = yearOf(focus.start);
    const w = windowFor(y);
    const out: W[] = [];
    for (const e of inPeriod) {
      if (e.id === focus.id || Math.abs(yearOf(e.start) - y) > w || out.some((o) => o.home === e.home) || e.home === focus.home) continue;
      out.push(e);
      if (out.length === 3) break;
    }
    return out.map((e) => ({ id: e.id, label: titleOf(e), relation: "same time", documented: false, lng: e.lng!, lat: e.lat!, icon: categoryIcon(e.category), inWorld: true }));
  }, [focus, inPeriod]);

  const [narrow, setNarrow] = useState(false);
  useEffect(() => { const q = window.matchMedia("(max-width: 639px)"); setNarrow(q.matches); const on = () => setNarrow(q.matches); q.addEventListener("change", on); return () => q.removeEventListener("change", on); }, []);
  // A phone map has room for fewer labels; the full list stays in the panel.
  const all = useMemo(() => [...documented, ...contextual.filter((c) => !documented.some((d) => d.id === c.id))].slice(0, 6), [documented, contextual]);
  const bubbles = all;
  const onMap = useMemo(() => all.slice(0, narrow ? 3 : 5), [all, narrow]);
  /** The period's best-documented records, all on the map: the top 150 by Wikipedia languages. */
  const mapEvents = useMemo(() => inPeriod.slice(0, 150), [inPeriod]);
  // Timeline markers: one row, the best documented first, leaving out any that would crowd another.
  const timeline = useMemo(() => {
    const span = Math.max(1, Math.min(p.to, 2026) - p.from);
    const placed: { e: W; row: number; x: number }[] = [];
    const must = focus ? [focus, ...inPeriod.filter((e) => e.id !== focus.id)] : inPeriod;
    for (const e of must.slice(0, 40)) {
      const x = ((yearOf(e.start) - p.from) / span) * 100;
      const gap = typeof window !== "undefined" && window.innerWidth < 640 ? 14 : 6;
      if (placed.some((q) => Math.abs(q.x - x) < gap)) continue;
      placed.push({ e, row: 0, x });
      if (placed.length >= 12) break;
    }
    return placed;
  }, [inPeriod, focus, p]);

  const choose = (id: string) => {
    const e = events?.find((x) => x.id === id);
    if (!e) return;
    const y = yearOf(e.start);
    if (!(y >= p.from && y <= p.to)) {
      setCustom(null);
      const i = PERIODS.findIndex((q) => y >= q.from && y <= q.to);
      if (i >= 0) setPeriod(i);
    }
    setFocusId(id);
  };
  const pickBubble = (b: Bubble) => { if (b.inWorld) choose(b.id); else window.location.assign(`${asset("")}/connections?id=${b.id}`); };
  const movePeriod = (d: number) => {
    if (custom) {
      // Step a custom range by its own length.
      const len = custom[1] - custom[0];
      const a = Math.max(-3500, Math.min(2026 - len, custom[0] + d * (len + 1)));
      setCustom([a, a + len]);
    } else setPeriod((x) => Math.max(0, Math.min(PERIODS.length - 1, x + d)));
    setFocusId(null);
  };
  const applyYears = () => {
    const a = Number(fromText), b = Number(toText);
    if (!Number.isFinite(a) || !Number.isFinite(b) || !fromText.trim() || !toText.trim()) return;
    setCustom([Math.max(-3500, Math.min(a, b)), Math.min(2026, Math.max(a, b))]);
    setFocusId(null);
  };
  const yearAt = (clientX: number) => {
    const r = axis.current!.getBoundingClientRect();
    return Math.round(p.from + Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * (Math.min(p.to, 2026) - p.from));
  };

  // The timeline axis covers the period; ticks at a readable step.
  const span = Math.max(1, Math.min(p.to, 2026) - p.from);
  const xOf = (y: number) => ((y - p.from) / span) * 100;
  const step = [10, 20, 25, 50, 100, 250, 500, 1000].find((s) => span / s <= 7) ?? 1000;
  const ticks: number[] = [];
  for (let t = Math.ceil(p.from / step) * step; t <= Math.min(p.to, 2026); t += step) ticks.push(t);
  const fy = focus ? yearOf(focus.start) : null;



  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]" data-testid="workspace">
      <div className="min-w-0">
        {/* Map */}
        <div className="relative h-[340px] overflow-hidden rounded-2xl border border-line bg-paper-3 shadow-sm sm:h-[440px] xl:h-[480px]">
          {focus && <WorkspaceMap focus={focus} bubbles={onMap} onPick={pickBubble} period={mapEvents} onFocus={choose} rangeKey={`${p.from}:${p.to}`} />}
          {!events && !failed && <div className="absolute inset-0 grid place-items-center text-ink-2" role="status">Loading the map…</div>}
          {failed && <div className="absolute inset-0 grid place-items-center p-6 text-center"><div><p>The records couldn&rsquo;t be loaded.</p><button type="button" className="btn btn-secondary mt-2" onClick={() => setRetry((r) => r + 1)}>Try again</button></div></div>}
          <label className="absolute left-3 top-3 z-10 flex items-center gap-2 rounded-full border border-line bg-paper-2/95 py-1 pl-3 pr-1 text-sm shadow-sm">
            <Icon name="timeline" size={16} className="text-bronze" />
            <span className="sr-only">Period</span>
            <select value={period} onChange={(e) => { setPeriod(Number(e.target.value)); setCustom(null); setFocusId(null); }} className="cursor-pointer rounded-full bg-transparent py-1 pr-1 font-medium outline-none" data-testid="period">
              {PERIODS.map((q, i) => <option key={q.label} value={i}>{q.label}</option>)}
            </select>
          </label>
          <p className="absolute bottom-2 left-3 z-10 flex items-center gap-3 rounded-full bg-paper-2/90 px-3 py-1 text-[11px] text-ink-2">
            <span className="inline-flex items-center gap-1"><span aria-hidden className="inline-block w-5 border-t-2 border-bronze" />documented link</span>
            <span className="inline-flex items-center gap-1"><span aria-hidden className="inline-block w-5 border-t-2 border-dashed border-bronze" />same time</span>
            <span className="hidden sm:inline">· today&rsquo;s map</span>
          </p>
        </div>

        {/* Timeline */}
        <div className="mt-4 flex items-center gap-2" data-testid="workspace-timeline">
          <button type="button" className="btn btn-secondary btn-icon !rounded-full" onClick={() => movePeriod(-1)} disabled={!custom && period === 0} aria-label="Earlier period"><Icon name="back" size={18} /></button>
          <div
            ref={axis}
            className="relative h-24 flex-1 cursor-crosshair touch-none"
            data-testid="workspace-axis"
            onPointerDown={(e) => { if ((e.target as HTMLElement).closest("button")) return; dragFrom.current = yearAt(e.clientX); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }}
            onPointerMove={(e) => { if (dragFrom.current === null) return; const y = yearAt(e.clientX); setDraft([Math.min(dragFrom.current, y), Math.max(dragFrom.current, y)]); }}
            onPointerUp={() => {
              if (draft && draft[1] - draft[0] >= 2) { setCustom(draft); setFocusId(null); }
              dragFrom.current = null;
              setDraft(null);
            }}
          >
            {/* Every record of the period as a faint tick: where the records are, not how eventful it was. */}
            {mapEvents.map((e) => <span key={`t-${e.id}`} aria-hidden className="absolute top-[38px] h-3 w-px bg-bronze/40" style={{ left: `${xOf(yearOf(e.start))}%` }} />)}
            {draft && <span aria-hidden className="pointer-events-none absolute top-[30px] h-9 rounded-md border-2 border-bronze bg-bronze/15" style={{ left: `${xOf(draft[0])}%`, width: `${Math.max(0.5, xOf(draft[1]) - xOf(draft[0]))}%` }} />}
            <span aria-hidden className="absolute inset-x-0 top-[50px] h-px bg-ink-2/40" />
            {ticks.filter((t) => fy === null || Math.abs(xOf(t) - xOf(fy)) > 7).map((t) => (
              <span key={t} aria-hidden className="absolute top-[56px] -translate-x-1/2 text-center" style={{ left: `${xOf(t)}%` }}>
                <span className="mx-auto block h-2.5 w-px bg-ink-2/50" />
                <span className="mt-1.5 block whitespace-nowrap text-xs tabular-nums text-ink-2">{formatYear(t)}</span>
              </span>
            ))}
            {fy !== null && (
              <span className="pointer-events-none absolute top-[56px] -translate-x-1/2 whitespace-nowrap rounded-full bg-oxblood px-2 py-0.5 text-xs font-semibold tabular-nums text-white" style={{ left: `${Math.min(97, Math.max(3, xOf(fy)))}%` }} data-testid="focus-year">{formatYear(fy)}</span>
            )}
            <ul aria-label={`The best-documented records of ${p.label}`}>
              {timeline.map(({ e, row }) => {
                const on = e.id === focus?.id;
                return (
                  <li key={e.id} className="absolute -translate-x-1/2" style={{ left: `${Math.min(98, Math.max(2, xOf(yearOf(e.start))))}%`, top: 0 }}>
                    <button
                      type="button"
                      onClick={() => setFocusId(e.id)}
                      aria-pressed={on}
                      aria-label={`${titleOf(e)}, ${formatImportedDate(e.start, e.end, e.precision)}`}
                      title={`${titleOf(e)} · ${formatImportedDate(e.start, e.end, e.precision)}`}
                      className={`grid place-items-center rounded-full transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-bronze motion-reduce:transition-none ${on ? "h-9 w-9 bg-oxblood text-paper shadow" : "h-8 w-8 border border-line bg-paper-2 text-ink-2 hover:border-bronze hover:text-ink"}`}
                    >
                      <Icon name={categoryIcon(e.category)} size={on ? 18 : 15} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
          <button type="button" className="btn btn-secondary btn-icon !rounded-full" onClick={() => movePeriod(1)} disabled={!custom && period === PERIODS.length - 1} aria-label="Later period"><Icon name="forward" size={18} /></button>
        </div>
        <form className="mt-1 flex flex-wrap items-center gap-2 pl-12 text-sm text-ink-2" onSubmit={(e) => { e.preventDefault(); applyYears(); }} data-testid="workspace-range">
          <span>Showing <strong className="tabular-nums text-ink">{p.label.replace(/^.* · /, "")}</strong>. Drag on the timeline to narrow it, or type years:</span>
          <label className="sr-only" htmlFor="ws-from">From year</label>
          <input id="ws-from" inputMode="numeric" value={fromText} onChange={(e) => setFromText(e.target.value)} className="field !w-20 !py-1 text-sm tabular-nums" />
          <span aria-hidden>–</span>
          <label className="sr-only" htmlFor="ws-to">To year</label>
          <input id="ws-to" inputMode="numeric" value={toText} onChange={(e) => setToText(e.target.value)} className="field !w-20 !py-1 text-sm tabular-nums" />
          <button type="submit" className="btn btn-secondary btn-sm">Show</button>
          {custom && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setCustom(null); setFocusId(null); }}>Back to {PERIODS[period].label}</button>}
        </form>
      </div>

      {/* Record */}
      <aside className="card self-start p-5" aria-label="The record in focus" data-testid="workspace-record">
        {!focus ? (
          <div className="space-y-3" role="status"><div className="skeleton h-8 w-3/4 rounded" /><div className="skeleton h-40 rounded" /><div className="skeleton h-4 w-full rounded" /></div>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-bronze text-paper"><Icon name={categoryIcon(focus.category)} size={24} /></span>
              <div className="min-w-0">
                <h2 className="font-serif text-2xl leading-tight [overflow-wrap:anywhere]">{titleOf(focus)}</h2>
                <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-bronze-soft/60 px-2.5 py-0.5 text-sm font-medium"><Icon name="timeline" size={14} />{formatImportedDate(focus.start, focus.end, focus.precision)}</p>
              </div>
            </div>
            {record?.image ? (
              <figure className="mt-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={record.image.url} alt={titleOf(focus)} className="aspect-[16/9] w-full rounded-xl object-cover" />
                <figcaption className="mt-1 truncate text-[11px] text-ink-2">Image: {record.image.artist ?? "Wikimedia Commons"}{record.image.license ? ` · ${record.image.license}` : ""} · <a className="link" href={record.image.page} target="_blank" rel="noopener noreferrer">source</a></figcaption>
              </figure>
            ) : (
              <div className="mt-4 grid aspect-[16/9] place-items-center rounded-xl border border-dashed border-line bg-paper-3/60 text-ink-2">
                <span className="flex flex-col items-center gap-1 text-xs"><Icon name={categoryIcon(focus.category)} size={40} />{record ? "No openly licensed image" : "Loading…"}</span>
              </div>
            )}
            <ul className="mt-4 grid gap-2.5 text-[0.95rem] leading-snug">
              {focus.description && <li className="flex gap-2.5"><Icon name="info" size={18} className="mt-0.5 shrink-0 text-bronze" /><span>{focus.description[0].toUpperCase() + focus.description.slice(1)}.</span></li>}
              <li className="flex gap-2.5"><Icon name="place" size={18} className="mt-0.5 shrink-0 text-bronze" /><span>{country(focus.home) || "Location from Wikidata"} · {CATEGORY_LABELS[focus.category] ?? focus.category}</span></li>
            </ul>
            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              <a className="chip" href={focus.url} target="_blank" rel="noopener noreferrer"><Icon name="source" size={15} />Wikidata</a>
              {record?.summary && <a className="chip" href={record.summary.url} target="_blank" rel="noopener noreferrer"><Icon name="book" size={15} />Wikipedia</a>}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Link href={`/connections?id=${focus.id}`} className="btn btn-primary"><Icon name="network" size={17} />Connections</Link>
              <Link href={atlasHref({ i: focus.id, k: focus.home, n: 1 })} className="btn btn-secondary"><Icon name="map" size={17} />On the map</Link>
            </div>
            <details className="mt-4 rounded-xl bg-paper-3/70 p-3 text-sm">
              <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold"><Icon name="info" size={16} className="text-bronze" />Why this record?</summary>
              <p className="mt-1.5 text-ink-2">It&rsquo;s one of the best-documented records of this period in TIMEWISE (written about in {focus.links} Wikipedia languages), which is not the same as most important. Imported from Wikidata, not checked by hand. Solid lines are Wikidata statements; dashed ones only share the time.</p>
            </details>
            <div className="mt-4">
              <p className="flex items-center gap-2 text-sm font-semibold"><Icon name="network" size={16} className="text-bronze" />Linked records</p>
              {linkState === "loading" && <p className="mt-1 text-xs text-ink-2">Reading documented links…</p>}
              {linkState === "failed" && <p className="mt-1 text-xs text-ink-2">Wikidata couldn&rsquo;t be reached, so only same-time records are shown.</p>}
              <ul className="mt-2 flex flex-wrap gap-1.5" data-testid="workspace-related">
                {bubbles.map((b) => (
                  <li key={b.id}>
                    <button type="button" onClick={() => pickBubble(b)} className={`chip !text-xs ${b.documented ? "" : "border-dashed"}`} title={`${b.relation}${b.documented ? ", documented" : ", same time only"}`}>
                      <Icon name={b.icon} size={14} />{b.label}
                    </button>
                  </li>
                ))}
                {!bubbles.length && linkState !== "loading" && <li className="text-xs text-ink-2">No linked records with a location.</li>}
              </ul>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
