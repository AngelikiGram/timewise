"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatYear } from "@/lib/dates";
import { asset } from "@/lib/paths";
import { GROUPS, yearOfIso, type Link, type NodeFacts, type RecordData } from "@/lib/record";
import { GROUP_ORDER } from "./ConnectionCards";

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(900);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(300, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

function niceStep(span: number) {
  for (const s of [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000]) if (span / s <= 8) return s;
  return 2000;
}

/** Linked records on a time axis, one row per kind of link. Only records Wikidata dates appear. */
export function TimelineView({ record, links, facts, selected, onSelect, loading }: {
  record: RecordData; links: Link[]; facts: Record<string, NodeFacts>; selected?: string; onSelect: (id: string) => void; loading: boolean;
}) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const self = yearOfIso(record.when.start);
  const dated = links.filter((l) => facts[l.target]?.year !== undefined);
  const years = [...dated.map((l) => facts[l.target].year!), ...(self !== undefined ? [self] : [])];
  const rows = GROUP_ORDER.filter((g) => dated.some((l) => l.group === g));
  const left = W < 640 ? 12 : 170;
  const right = W < 640 ? 24 : 110;
  const top = 34;
  const rowH = 44;
  const H = top + Math.max(rows.length, 1) * rowH + 40;

  if (!years.length) {
    return (
      <div ref={ref} className="grid min-h-64 place-items-center rounded-lg border border-dashed border-line p-6 text-center text-ink-2" data-testid="timeline-view">
        {loading ? "Reading dates from Wikidata…" : "Wikidata gives no dates for this record or its links, so there is no timeline to draw. The network and the list still work."}
      </div>
    );
  }
  let lo = Math.min(...years);
  let hi = Math.max(...years);
  if (hi - lo < 10) { lo -= 5; hi += 5; }
  const pad = (hi - lo) * 0.04;
  lo -= pad; hi += pad;
  const x = (y: number) => left + ((y - lo) / (hi - lo)) * (W - left - right);
  const step = niceStep(hi - lo);
  const ticks: number[] = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) ticks.push(t);

  return (
    <div ref={ref} className="w-full min-w-0 overflow-hidden" data-testid="timeline-view">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="group" aria-label="Linked records on a timeline">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={top - 8} y2={H - 30} stroke="var(--line)" />
            <text x={x(t)} y={H - 12} textAnchor="middle" className="fill-ink-2 text-[11px] tabular-nums">{formatYear(t)}</text>
          </g>
        ))}
        {self !== undefined && (
          <g>
            <line x1={x(self)} x2={x(self)} y1={top - 18} y2={H - 30} stroke="var(--bronze)" strokeWidth={2} />
            <text x={x(self)} y={top - 22} textAnchor="middle" className="fill-ink text-[12px] font-semibold">{record.label.length > 30 ? `${record.label.slice(0, 29)}…` : record.label}</text>
          </g>
        )}
        {rows.map((g, r) => {
          const y = top + r * rowH + rowH / 2;
          let lastLabel = -Infinity;
          const members = dated.filter((l) => l.group === g).sort((a, b) => facts[a.target].year! - facts[b.target].year!);
          return (
            <g key={g}>
              {W >= 640 && <text x={8} y={y + 4} className="fill-ink-2 text-[12px]">{GROUPS[g].label}</text>}
              <line x1={left} x2={W - right} y1={y} y2={y} stroke="var(--line)" strokeDasharray="2 4" />
              {members.map((l) => {
                const px = x(facts[l.target].year!);
                const on = l.target === selected;
                const showLabel = on || px - lastLabel > 130;
                if (showLabel) lastLabel = px;
                return (
                  <g key={l.target} role="button" tabIndex={0} aria-label={`${l.label}, ${formatYear(facts[l.target].year!)}: ${l.relation}`} onClick={() => onSelect(l.target)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect(l.target))} className="cursor-pointer outline-none [&:focus-visible_circle]:stroke-[var(--bronze)]">
                    <circle cx={px} cy={y} r={on ? 9 : 6.5} fill={l.documented ? "var(--navy)" : "var(--paper-2)"} stroke={l.documented ? "var(--paper-2)" : "var(--bronze)"} strokeWidth={2} />
                    <circle cx={px} cy={y} r={16} fill="transparent" />
                    {showLabel && (
                      <text x={px + 10} y={y - 10} className={`text-[11px] ${on ? "fill-ink font-semibold" : "fill-ink-2"}`} paintOrder="stroke" stroke="var(--paper)" strokeWidth={3}>
                        {l.label.length > 22 ? `${l.label.slice(0, 21)}…` : l.label}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
      <p className="mt-2 text-xs text-ink-2">
        Years are the earliest date Wikidata gives each record (point in time, start, founding or birth). {links.length - dated.length > 0 && `${links.length - dated.length} linked records have no date and aren't shown.`}
        {loading && " Still reading dates…"}
      </p>
    </div>
  );
}

export type Feature = { geometry: { type: "Polygon" | "MultiPolygon"; coordinates: number[][][] | number[][][][] } };
let countries: Promise<Feature[]> | null = null;
export const loadCountries = () => (countries ??= fetch(asset("/data/world-countries.json")).then((r) => r.json()).then((d: { features: Feature[] }) => d.features));

/** Linked records with coordinates on today's map. A simple projection, enough to see where links lead. */
export function MapView({ record, links, facts, selected, onSelect, loading }: {
  record: RecordData; links: Link[]; facts: Record<string, NodeFacts>; selected?: string; onSelect: (id: string) => void; loading: boolean;
}) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const [shapes, setShapes] = useState<Feature[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { loadCountries().then(setShapes, () => setFailed(true)); }, []);
  const H = Math.round(W * 0.52);
  const px = ([lng, lat]: [number, number]) => [((lng + 180) / 360) * W, ((84 - lat) / 144) * H] as const;
  const outline = useMemo(() => {
    if (!shapes) return "";
    const ring = (r: number[][]) => r.map((p, i) => `${i ? "L" : "M"}${(((p[0] + 180) / 360) * W).toFixed(1)},${(((84 - p[1]) / 144) * H).toFixed(1)}`).join("") + "Z";
    return shapes.map((f) => (f.geometry.type === "Polygon" ? (f.geometry.coordinates as number[][][]).map(ring) : (f.geometry.coordinates as number[][][][]).flatMap((p) => p.map(ring))).join("")).join("");
  }, [shapes, W, H]);

  const placed = links.filter((l) => facts[l.target]?.coord);
  const points = [...placed.map((l) => px(facts[l.target].coord!)), ...(record.coord ? [px(record.coord)] : [])];
  // Frame the points, with room around them, but never zoom in closer than a region.
  let view = `0 0 ${W} ${H}`;
  if (points.length) {
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    let w = Math.max(...xs) - Math.min(...xs);
    let h = Math.max(...ys) - Math.min(...ys);
    w = Math.max(w * 1.3, W * 0.18);
    h = Math.max(h * 1.3, H * 0.18);
    if (w / h > W / H) h = w / (W / H); else w = h * (W / H);
    const mx = (Math.max(...xs) + Math.min(...xs)) / 2;
    const my = (Math.max(...ys) + Math.min(...ys)) / 2;
    if (w < W) view = `${(mx - w / 2).toFixed(1)} ${(my - h / 2).toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`;
  }
  const scale = points.length ? Number(view.split(" ")[2]) / W : 1;
  const center = record.coord ? px(record.coord) : null;

  return (
    <div ref={ref} className="w-full min-w-0 overflow-hidden" data-testid="map-view">
      <div className="relative overflow-hidden rounded-lg border border-line bg-paper-3/40">
        <svg viewBox={view} className="block h-auto w-full" role="group" aria-label="Linked records on today's map">
          <path d={outline} fill="var(--paper-3)" stroke="var(--line)" strokeWidth={0.6 * scale} />
          {center && placed.map((l) => {
            const [x, y] = px(facts[l.target].coord!);
            return <line key={`m-${l.target}`} x1={center[0]} y1={center[1]} x2={x} y2={y} stroke={l.documented ? "var(--navy)" : "var(--bronze)"} strokeOpacity={0.5} strokeWidth={1.2 * scale} strokeDasharray={l.documented ? undefined : `${4 * scale} ${4 * scale}`} />;
          })}
          {placed.map((l) => {
            const [x, y] = px(facts[l.target].coord!);
            const on = l.target === selected;
            return (
              <g key={l.target} role="button" tabIndex={0} aria-label={`${l.label}: ${l.relation}`} onClick={() => onSelect(l.target)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect(l.target))} className="cursor-pointer outline-none">
                <circle cx={x} cy={y} r={(on ? 7 : 5) * scale} fill={l.documented ? "var(--navy)" : "var(--paper-2)"} stroke={l.documented ? "var(--paper-2)" : "var(--bronze)"} strokeWidth={1.6 * scale} />
                <circle cx={x} cy={y} r={12 * scale} fill="transparent" />
                {on && <text x={x + 9 * scale} y={y - 7 * scale} style={{ fontSize: 12 * scale }} className="fill-ink font-semibold" paintOrder="stroke" stroke="var(--paper)" strokeWidth={3 * scale}>{l.label}</text>}
              </g>
            );
          })}
          {center && (
            <g>
              <circle cx={center[0]} cy={center[1]} r={8 * scale} fill="var(--bronze)" stroke="var(--paper-2)" strokeWidth={2 * scale} />
              <text x={center[0] + 11 * scale} y={center[1] + 4 * scale} style={{ fontSize: 13 * scale }} className="fill-ink font-semibold" paintOrder="stroke" stroke="var(--paper)" strokeWidth={3 * scale}>{record.label}</text>
            </g>
          )}
        </svg>
        <span className="absolute bottom-2 left-2 rounded bg-paper-2/90 px-2 py-0.5 text-[11px] text-ink-2">Today&rsquo;s borders, not historical ones</span>
      </div>
      <p className="mt-2 text-xs text-ink-2">
        {failed ? "The country outlines couldn't be loaded; points are still placed by their coordinates. " : ""}
        Coordinates come from Wikidata. {!record.coord && "This record has none, so it isn't marked. "}
        {links.length - placed.length > 0 && `${links.length - placed.length} linked records have no coordinates and aren't shown.`}
        {loading && " Still reading places…"}
      </p>
    </div>
  );
}
