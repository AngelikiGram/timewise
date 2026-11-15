"use client";

// Reusable visuals: a small drawing of a dated, attributed shape, and a then-and-now comparison slider.
// They only draw shapes that carry a source, a licence and a date; nothing here is invented.
import { useId, useState } from "react";
import { geometries, DERIVATION_LABELS } from "@/lib/collection";

type Geo = (typeof geometries)[number];
type Ring = number[][];

function rings(g: Geo["geometry"]): Ring[] {
  switch (g.type) {
    case "LineString": return [g.coordinates as Ring];
    case "MultiLineString": return g.coordinates as Ring[];
    case "Polygon": return g.coordinates as Ring[];
    case "MultiPolygon": return (g.coordinates as Ring[][]).flat();
    default: return [];
  }
}

/** A shared projection for one or more shapes: equirectangular, corrected for latitude. */
function projector(shapes: Geo[], width: number, height: number, pad = 8) {
  let w = 180, e = -180, s = 90, n = -90;
  for (const g of shapes) for (const r of rings(g.geometry)) for (const [x, y] of r) { w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y); }
  const k = Math.cos((((s + n) / 2) * Math.PI) / 180);
  const sx = (width - 2 * pad) / ((e - w) * k || 1), sy = (height - 2 * pad) / ((n - s) || 1);
  const scale = Math.min(sx, sy);
  const ox = (width - (e - w) * k * scale) / 2, oy = (height - (n - s) * scale) / 2;
  return (r: Ring) => r.map(([x, y], i) => `${i ? "L" : "M"}${(ox + (x - w) * k * scale).toFixed(1)},${(oy + (n - y) * scale).toFixed(1)}`).join("");
}

const pathOf = (g: Geo, project: (r: Ring) => string) => rings(g.geometry).map((r) => project(r) + (g.geometry.type.includes("Polygon") ? "Z" : "")).join("");

export const geometry = (id: string) => geometries.find((g) => g.id === id);

/** A drawing of one shape, with its source and what kind of shape it is. */
export function GeometrySketch({ id, label, className = "" }: { id: string; label: string; className?: string }) {
  const g = geometry(id);
  if (!g) return null;
  const project = projector([g], 400, 240);
  const area = g.geometry.type.includes("Polygon");
  return (
    <figure className={className}>
      <svg viewBox="0 0 400 240" role="img" aria-label={label} className="w-full rounded-md border border-line bg-paper-3">
        <path d={pathOf(g, project)} fill={area ? "var(--bronze)" : "none"} fillOpacity={area ? 0.18 : 0} stroke="var(--navy)" strokeWidth={area ? 1.5 : 3} strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <figcaption className="mt-1 text-xs text-ink-2">
        {g.name}. {DERIVATION_LABELS[g.derivation].label}: {DERIVATION_LABELS[g.derivation].help} Source: {g.sourceName}, {g.license}.
      </figcaption>
    </figure>
  );
}

/**
 * Then and now: two dated shapes on one projection, revealed with a slider. Works with the keyboard
 * (it's a range input) and without motion.
 */
export function CompareSlider({ beforeId, afterId, beforeLabel, afterLabel, title }: { beforeId: string; afterId: string; beforeLabel: string; afterLabel: string; title: string }) {
  const [pos, setPos] = useState(50);
  const id = useId();
  const before = geometry(beforeId), after = geometry(afterId);
  if (!before || !after) return null;
  const project = projector([before, after], 480, 300);
  const sources = [...new Set([before, after].map((g) => `${g.sourceName} (${g.license})`))].join("; ");
  return (
    <figure data-testid="compare-slider">
      <div className="relative overflow-hidden rounded-md border border-line bg-paper-3">
        <svg viewBox="0 0 480 300" role="img" aria-label={`${title}: ${beforeLabel} and ${afterLabel}`} className="block w-full">
          <defs>
            <clipPath id={`${id}-l`}><rect x="0" y="0" width={(480 * pos) / 100} height="300" /></clipPath>
            <clipPath id={`${id}-r`}><rect x={(480 * pos) / 100} y="0" width={480 - (480 * pos) / 100} height="300" /></clipPath>
          </defs>
          <g clipPath={`url(#${id}-l)`}>
            <path d={pathOf(before, project)} fill="var(--cat-state)" fillOpacity="0.22" stroke="var(--cat-state)" strokeWidth="1.4" />
          </g>
          <g clipPath={`url(#${id}-r)`}>
            <path d={pathOf(before, project)} fill="none" stroke="var(--line)" strokeWidth="1" strokeDasharray="3 3" />
            <path d={pathOf(after, project)} fill="var(--cat-politics)" fillOpacity="0.28" stroke="var(--cat-politics)" strokeWidth="1.6" />
          </g>
          <line x1={(480 * pos) / 100} x2={(480 * pos) / 100} y1="0" y2="300" stroke="var(--ink)" strokeWidth="2" />
        </svg>
        <span className="pointer-events-none absolute left-2 top-2 rounded bg-paper-2/90 px-2 py-0.5 text-xs font-semibold">{beforeLabel}</span>
        <span className="pointer-events-none absolute right-2 top-2 rounded bg-paper-2/90 px-2 py-0.5 text-xs font-semibold">{afterLabel}</span>
      </div>
      <label className="mt-2 flex items-center gap-3 text-sm">
        <span className="shrink-0 text-ink-2">{beforeLabel}</span>
        <input type="range" min={0} max={100} value={pos} onChange={(e) => setPos(Number(e.target.value))} className="w-full accent-[var(--bronze)]" aria-label={`Slide between ${beforeLabel} and ${afterLabel}`} />
        <span className="shrink-0 text-ink-2">{afterLabel}</span>
      </label>
      <figcaption className="mt-1 text-xs leading-relaxed text-ink-2">
        Coarse, community-digitized outlines for orientation, not exact borders. Source: {sources}.
      </figcaption>
    </figure>
  );
}
