"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatYear } from "@/lib/dates";
import { GROUPS, yearOfIso, type Group, type Link, type NodeFacts, type RecordData } from "@/lib/record";
import { Icon, type IconName } from "../icons";
import { GROUP_ORDER, MoreSlider } from "./ConnectionCards";

const GROUP_ICON: Record<Group, IconName> = { cause: "cause", sequence: "sequence", parts: "parts", people: "people", places: "place", ideas: "idea", checked: "checked", period: "period", country: "country" };
const GUTTER = 156;
const ROW = 40;
/** What a chip's position means, by the kind of date it was placed at. */
const PLACED_AT: Record<NonNullable<NodeFacts["dateKind"]>, string> = { born: "at birth; the line runs to death", founded: "at founding; the line runs to its end", happened: "when it happened", published: "at publication" };
/** The chip's year, said plainly: "b. 1756", "1756–1791", "f. 1200". */
function when(f: NodeFacts) {
  if (f.year === undefined) return "";
  if (f.dateKind === "born") return f.end !== undefined ? `${formatYear(f.year)}–${formatYear(f.end)}` : `b. ${formatYear(f.year)}`;
  if (f.dateKind === "founded") return `f. ${formatYear(f.year)}`;
  return formatYear(f.year);
}
/** How a linked record stands in time to the one in focus, in words. */
function relative(f: NodeFacts, fy: number | undefined, focus: string) {
  if (fy === undefined || f.year === undefined) return "";
  if (f.dateKind === "born") {
    if (fy < f.year) return `born ${f.year - fy} years after ${focus}`;
    if (f.end !== undefined && fy > f.end) return `died ${fy - f.end} years before ${focus}`;
    return `aged about ${fy - f.year} at the time of ${focus}`;
  }
  const d = f.year - fy;
  return d === 0 ? `the same year as ${focus}` : `${Math.abs(d)} years ${d > 0 ? "after" : "before"} ${focus}`;
}
const LANE_PAD = 12;

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(900);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(320, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

const nice = (span: number) => [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000].find((s) => span / s <= 8) ?? 2000;

/**
 * Connections on a time axis: the record in focus is a vertical line at its date, each linked record sits
 * at its own date in a lane for its kind of link, and the overview underneath can be brushed (drag a
 * rectangle) to zoom into a span of years. Records Wikidata doesn't date are listed apart, not placed.
 */
export function TimeGraph({ record, links, facts, selected, onStep, onDetails, loading, totals, limitOf, setLimit }: {
  record: RecordData;
  /** The links shown: the first few of each group, as set below each lane. */
  links: Link[];
  totals: Partial<Record<Group, number>>;
  limitOf: (g: Group) => number;
  setLimit: (g: Group, n: number) => void;
  facts: Record<string, NodeFacts>;
  selected?: string;
  onStep: (link: Link) => void;
  onDetails: (target: string) => void;
  loading: boolean;
}) {
  const [box, W] = useWidth();
  const narrow = W < 640;
  const gutter = narrow ? 0 : GUTTER;
  const chip = Math.max(110, Math.min(176, (W - gutter) / 5));
  const fy = yearOfIso(record.when.start);
  const dated = links.filter((l) => facts[l.target]?.year !== undefined);
  const undated = links.filter((l) => facts[l.target]?.year === undefined);
  const years = [...dated.map((l) => facts[l.target].year!), ...(fy !== undefined ? [fy] : [])];
  const full = useMemo<[number, number]>(() => {
    if (!years.length) return [0, 1];
    let lo = Math.min(...years), hi = Math.max(...years);
    if (hi - lo < 10) { lo -= 5; hi += 5; }
    const pad = (hi - lo) * 0.04;
    return [Math.floor(lo - pad), Math.ceil(hi + pad)];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [years.join(",")]);
  const [view, setView] = useState<[number, number] | null>(null);
  useEffect(() => setView(null), [record.id]);
  const [d0, d1] = view ?? full;
  const left = gutter + chip / 2 + 8, right = W - chip / 2 - 8;
  const x = (y: number) => left + ((y - d0) / Math.max(1, d1 - d0)) * (right - left);

  // Lanes, and rows within each lane so chips never overlap.
  const lanes = GROUP_ORDER.filter((g) => dated.some((l) => l.group === g));
  const layout = useMemo(() => {
    let top = 34;
    return lanes.map((g) => {
      const members = dated.filter((l) => l.group === g).map((l) => ({ l, y: facts[l.target].year! })).sort((a, b) => a.y - b.y);
      const inView = members.filter((m) => m.y >= d0 && m.y <= d1);
      const rows: number[][] = [];
      const placed = inView.map((m) => {
        const cx = x(m.y);
        let r = rows.findIndex((row) => row.every((o) => Math.abs(o - cx) >= chip + 6));
        if (r < 0) { r = rows.length; rows.push([]); }
        rows[r].push(cx);
        return { ...m, cx, r };
      });
      const height = Math.max(narrow ? 1 : 2, rows.length) * ROW + LANE_PAD * 2 + (narrow && (totals[g] ?? 0) > 1 ? 28 : 0);
      const lane = { g, top, height, placed, before: members.filter((m) => m.y < d0).length, after: members.filter((m) => m.y > d1).length };
      top += height;
      return lane;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lanes.join(), dated, facts, d0, d1, W, chip, totals]);
  const H = (layout.at(-1) ? layout.at(-1)!.top + layout.at(-1)!.height : 60) + 8;
  const fx = fy !== undefined && fy >= d0 && fy <= d1 ? x(fy) : null;
  const step = nice(d1 - d0);
  const ticks: number[] = [];
  for (let t = Math.ceil(d0 / step) * step; t <= d1; t += step) ticks.push(t);

  // ---- The brushable overview.
  const ov = useRef<HTMLDivElement>(null);
  const drag = useRef<{ mode: "new" | "move" | "w" | "e"; start: number; from: [number, number] } | null>(null);
  const ox = (y: number) => ((y - full[0]) / Math.max(1, full[1] - full[0])) * 100;
  const yearAt = (clientX: number) => {
    const r = ov.current!.getBoundingClientRect();
    return Math.round(full[0] + Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * (full[1] - full[0]));
  };
  const onDown = (e: React.PointerEvent, mode: "new" | "move" | "w" | "e") => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const y = yearAt(e.clientX);
    drag.current = { mode, start: y, from: [d0, d1] };
    if (mode === "new") setView([y, y + 1]);
  };
  const onMove = (e: React.PointerEvent) => {
    const g = drag.current;
    if (!g) return;
    const y = yearAt(e.clientX);
    const span = g.from[1] - g.from[0];
    if (g.mode === "new") setView([Math.min(g.start, y), Math.max(g.start, y) + 1]);
    if (g.mode === "move") { const d = Math.max(full[0] - g.from[0], Math.min(full[1] - g.from[1], y - g.start)); setView([g.from[0] + d, g.from[0] + d + span]); }
    if (g.mode === "w") setView([Math.min(y, g.from[1] - 1), g.from[1]]);
    if (g.mode === "e") setView([g.from[0], Math.max(y, g.from[0] + 1)]);
  };
  const onUp = () => {
    const g = drag.current;
    drag.current = null;
    if (g && view && view[1] - view[0] < 2) setView(null); // a click, not a drag: show everything
  };
  const zoomFocus = () => fy !== undefined && setView([Math.max(full[0], fy - 30), Math.min(full[1], fy + 30)]);

  if (!dated.length) {
    return (
      <div ref={box} data-testid="time-graph" className="rounded-xl border border-dashed border-line p-6 text-center text-ink-2">
        {loading ? "Reading dates from Wikidata…" : "Wikidata gives no dates for these connections, so they can't be placed in time. The Cards view lists them all."}
      </div>
    );
  }

  return (
    <div ref={box} data-testid="time-graph" className="select-none">
      {/* Main view */}
      <div className="relative overflow-hidden rounded-xl border border-line bg-paper-2" style={{ height: H }}>
        <svg className="absolute inset-0 h-full w-full" aria-hidden>
          {layout.map((ln, i) => <rect key={ln.g} x={0} y={ln.top} width={W} height={ln.height} fill={i % 2 ? "var(--paper-3)" : "transparent"} opacity={0.45} />)}
          {ticks.map((t) => <g key={t}><line x1={x(t)} x2={x(t)} y1={26} y2={H} stroke="var(--line)" strokeDasharray="2 4" />{(fx === null || Math.abs(x(t) - fx) > 110) && <text x={x(t)} y={18} textAnchor="middle" className="fill-ink-2 text-[11px] tabular-nums">{formatYear(t)}</text>}</g>)}
          {layout.flatMap((ln) => ln.placed.map((p) => {
            const f = facts[p.l.target];
            if (f?.end === undefined) return null;
            const cy = ln.top + LANE_PAD + p.r * ROW + ROW / 2 - 4;
            const x2 = x(Math.min(f.end, d1));
            return <g key={`s-${p.l.target}`}><line x1={p.cx} x2={x2} y1={cy} y2={cy} stroke="var(--navy)" strokeWidth={4} strokeLinecap="round" opacity={0.35} />{f.end <= d1 && <line x1={x2} x2={x2} y1={cy - 7} y2={cy + 7} stroke="var(--navy)" strokeWidth={2} opacity={0.6} />}</g>;
          }))}
          {fx !== null && layout.flatMap((ln) => ln.placed.map((p) => {
            const cy = ln.top + LANE_PAD + p.r * ROW + ROW / 2 - 4;
            const dashed = !p.l.documented;
            const mid = (fx + p.cx) / 2;
            return <path key={`c-${p.l.target}`} d={`M ${fx} ${cy} C ${mid} ${cy}, ${mid} ${cy}, ${p.cx} ${cy}`} fill="none" stroke="var(--bronze)" strokeOpacity={selected && selected !== p.l.target ? 0.25 : 0.7} strokeWidth={p.l.target === selected ? 2.5 : 1.4} strokeDasharray={dashed ? "4 4" : undefined} />;
          }))}
          {fx !== null && <line x1={fx} x2={fx} y1={26} y2={H} stroke="var(--oxblood)" strokeWidth={2.5} />}
        </svg>
        {layout.map((ln) => {
          const kinds = ln.placed.map((p) => facts[p.l.target]?.dateKind).filter(Boolean) as NonNullable<NodeFacts["dateKind"]>[];
          const main = kinds.sort((a, b) => kinds.filter((k) => k === b).length - kinds.filter((k) => k === a).length)[0];
          const slider = <MoreSlider compact what={GROUPS[ln.g].label.toLowerCase()} shown={limitOf(ln.g)} total={totals[ln.g] ?? 0} onChange={(n) => setLimit(ln.g, n)} />;
          return narrow ? (
            <div key={`l-${ln.g}`} className="absolute left-2 right-2 z-10 flex items-center justify-between gap-2 text-[11px] font-semibold text-ink-2" style={{ top: ln.top + ln.height - 30 }}>
              <span className="flex items-center gap-1"><Icon name={GROUP_ICON[ln.g]} size={13} className="text-bronze" />{GROUPS[ln.g].label}</span>{slider}
            </div>
          ) : (
            <div key={`l-${ln.g}`} className="absolute left-0 z-10 px-3 text-xs text-ink-2" style={{ top: ln.top + LANE_PAD, width: GUTTER }}>
              <span className="flex items-start gap-2 font-semibold"><Icon name={GROUP_ICON[ln.g]} size={16} className="shrink-0 text-bronze" /><span className="leading-tight">{GROUPS[ln.g].label}{!GROUPS[ln.g].documented && <span className="block font-normal">same time or place</span>}</span></span>
              {main && <span className="mt-0.5 block text-[10px] leading-tight">Placed {PLACED_AT[main]}</span>}
              <div className="mt-1">{slider}</div>
            </div>
          );
        })}
        {fx !== null && (
          <span className="absolute z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-oxblood px-2.5 py-0.5 text-xs font-semibold text-white shadow" style={{ left: Math.min(W - 70, Math.max(70, fx)), top: 4 }}>
            {record.label.length > 28 ? `${record.label.slice(0, 27)}…` : record.label}, {formatYear(fy!)}
          </span>
        )}
        {layout.flatMap((ln) => ln.placed.map((p) => {
          const on = p.l.target === selected;
          return (
            <div key={p.l.target} className={`absolute flex items-center rounded-full border bg-paper shadow-sm transition-shadow hover:shadow-md ${p.l.documented ? "border-bronze/70" : "border-dashed border-bronze/60"} ${on ? "ring-2 ring-oxblood" : ""}`} style={{ left: p.cx - chip / 2, top: ln.top + LANE_PAD + p.r * ROW + 2, width: chip, height: ROW - 10 }} data-node={p.l.target} data-documented={p.l.documented}>
              <button type="button" onClick={() => onStep(p.l)} className="flex min-w-0 flex-1 items-center gap-1.5 pl-2.5 text-left text-xs outline-none focus-visible:underline" title={`${p.l.label} (${when(facts[p.l.target])}): ${p.l.relation}. ${relative(facts[p.l.target], fy, record.label)}`} aria-label={`${p.l.label}, ${when(facts[p.l.target])}: ${p.l.relation}${p.l.documented ? "" : ", not a documented link"}. ${relative(facts[p.l.target], fy, record.label)}. Explore from here`}>
                <span className="shrink-0 tabular-nums text-ink-2">{when(facts[p.l.target])}</span>
                <span className="truncate font-medium text-ink">{p.l.label}</span>
              </button>
              <button type="button" onClick={() => onDetails(p.l.target)} className="grid h-full w-7 shrink-0 place-items-center rounded-r-full text-ink-2 hover:text-ink focus-visible:ring-2 focus-visible:ring-bronze" aria-label={`Why is ${p.l.label} connected?`}><Icon name="info" size={13} /></button>
            </div>
          );
        }))}
        {layout.map((ln) => (ln.before > 0 || ln.after > 0) && (
          <span key={`o-${ln.g}`} className="pointer-events-none absolute right-2 text-[10px] text-ink-2" style={{ top: ln.top + 2 }}>{ln.before ? `${ln.before} earlier` : ""}{ln.before && ln.after ? ", " : ""}{ln.after ? `${ln.after} later` : ""} (outside the brushed range)</span>
        ))}
      </div>

      {/* Overview with a brush */}
      <div className="mt-3 flex items-center gap-2">
        <span className="hidden shrink-0 text-xs font-semibold text-ink-2 sm:block" style={{ width: narrow ? undefined : GUTTER - 8 }}>Drag to zoom in time</span>
        <div
          ref={ov}
          className="relative h-12 flex-1 cursor-crosshair rounded-lg border border-line bg-paper-3/60"
          onPointerDown={(e) => onDown(e, "new")}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onDoubleClick={() => setView(null)}
          role="group"
          aria-label="Overview of all dated connections. Drag across it to zoom the view to that span of years."
          data-testid="time-brush"
        >
          {dated.map((l) => <span key={`t-${l.target}`} aria-hidden className={`absolute top-2 h-8 w-0.5 rounded ${l.documented ? "bg-bronze" : "bg-bronze/40"}`} style={{ left: `${ox(facts[l.target].year!)}%` }} />)}
          {fy !== undefined && <span aria-hidden className="absolute top-0 h-full w-0.5 bg-oxblood" style={{ left: `${ox(fy)}%` }} />}
          {view && (
            <div className="absolute top-0 h-full cursor-grab rounded border-2 border-bronze bg-bronze/15 active:cursor-grabbing" style={{ left: `${ox(d0)}%`, width: `${Math.max(0.5, ox(d1) - ox(d0))}%` }} onPointerDown={(e) => onDown(e, "move")} data-testid="brush">
              <span className="absolute -left-1 top-0 h-full w-2 cursor-ew-resize" onPointerDown={(e) => onDown(e, "w")} />
              <span className="absolute -right-1 top-0 h-full w-2 cursor-ew-resize" onPointerDown={(e) => onDown(e, "e")} />
            </div>
          )}
          <span className="pointer-events-none absolute bottom-0.5 left-1.5 text-[10px] tabular-nums text-ink-2">{formatYear(full[0])}</span>
          <span className="pointer-events-none absolute bottom-0.5 right-1.5 text-[10px] tabular-nums text-ink-2">{formatYear(full[1])}</span>
        </div>
        <div className="flex shrink-0 gap-1">
          {fy !== undefined && <button type="button" className="btn btn-ghost btn-sm" onClick={zoomFocus}>Around it</button>}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setView(null)} disabled={!view}>All</button>
        </div>
      </div>

      {undated.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold text-ink-2">No date in Wikidata ({undated.length})</p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {undated.map((l) => (
              <li key={l.target}><button type="button" onClick={() => onStep(l)} className={`chip !text-xs ${l.documented ? "" : "border-dashed"}`} title={l.relation}><Icon name={GROUP_ICON[l.group]} size={13} />{l.label}</button></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
