"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatYear, yearOf } from "@/lib/dates";
import { recordWholeLife } from "@/lib/explorer";
import type { Moment, MomentKind, Related } from "@/lib/live";
import { atlasHref, loadIndex, type IndexEvent } from "@/lib/world-index";
import { OWID_SOURCE, people, population, populationAt } from "@/lib/opendata";
import { Icon } from "../icons";

export const KIND: Record<MomentKind, { label: string; color: string }> = {
  life: { label: "Birth and death", color: "#7a1f2b" },
  work: { label: "Works", color: "#8a5a1c" },
  study: { label: "Studies", color: "#2f4d7a" },
  job: { label: "Work and membership", color: "#4b6b3a" },
  office: { label: "Offices", color: "#6b3f8a" },
  award: { label: "Awards", color: "#b8901c" },
  family: { label: "Family", color: "#b5476b" },
  home: { label: "Homes", color: "#2f7a7a" },
  event: { label: "Events", color: "#5a5a5a" },
};
type Frame = 1 | 5 | 10 | "all";
const FRAMES: { id: Frame; label: string }[] = [{ id: 1, label: "One year" }, { id: 5, label: "5 years" }, { id: 10, label: "A decade" }, { id: "all", label: "Whole life" }];

/**
 * The life, in time: scrub through the years and see, at each point, how old they were, what they did, who
 * around them was alive, and what was happening in the world. The frame sets how much time each stop shows,
 * up to the whole life at once. `onWindow` tells the page which years are in view, so the map can follow.
 */
export function LifeTime({ personId, name, born, died, moments, related, onWindow, onWhole }: {
  personId: string; name: string; born: number | null; died: number | null; moments: Moment[]; related: Related[]; onWindow?: (lo: number, hi: number, all: boolean) => void; onWhole?: () => void;
}) {
  const years = moments.map((m) => m.year);
  const lo = born ?? (years.length ? Math.min(...years) : 1900);
  const hi = died ?? Math.max(lo + 1, Math.min(new Date().getFullYear(), years.length ? Math.max(...years) : lo + 1));
  const span = Math.max(1, hi - lo);
  const [year, setYear] = useState(lo);
  const [frame, setFrame] = useState<Frame>(5);
  const [playing, setPlaying] = useState(false);
  const [world, setWorld] = useState<IndexEvent[] | null>(null);
  const seen = useRef({ min: Infinity, max: -Infinity });
  useEffect(() => { loadIndex().then(setWorld, () => setWorld([])); }, []);
  const [pop, setPop] = useState<[number, number][] | null>(null);
  useEffect(() => { population("OWID_WRL").then(setPop, () => setPop([])); }, []);

  const all = frame === "all";
  const a = all ? lo : year;
  const b = all ? hi : Math.min(hi, year + (frame as number) - 1);
  useEffect(() => { onWindow?.(a, b, all); }, [a, b, all]); // eslint-disable-line react-hooks/exhaustive-deps

  // Count a whole life once the reader has been at both ends of it.
  useEffect(() => {
    seen.current = { min: Math.min(seen.current.min, a), max: Math.max(seen.current.max, b) };
    if (died != null && seen.current.min <= lo && seen.current.max >= hi && !all) { recordWholeLife(personId); onWhole?.(); }
  }, [a, b, lo, hi, died, personId, all]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setYear((y) => Math.min(hi, y + 1)), 280);
    return () => clearInterval(t);
  }, [playing, hi]);
  useEffect(() => { if (year >= hi) setPlaying(false); }, [year, hi]);

  const inView = moments.filter((m) => m.year >= a && m.year <= b);
  const byYear = useMemo(() => {
    const g = new Map<number, Moment[]>();
    for (const m of inView) g.set(m.year, [...(g.get(m.year) ?? []), m]);
    return [...g.entries()].sort((x, y) => x[0] - y[0]);
  }, [inView]);
  const alive = related.filter((r) => r.born != null && r.born <= b && (r.died == null || r.died >= a));
  const meanwhile = useMemo(() => (world ?? []).filter((e) => { const y = yearOf(e.s); return y >= a && y <= b && (e.n ?? 1) < 8; }).sort((x, y) => y.l - x.l).slice(0, all ? 8 : 5), [world, a, b, all]);
  const age = (y: number) => (born != null ? y - born : null);
  const at = (y: number) => ((y - lo) / span) * 100;
  const kinds = [...new Set(moments.map((m) => m.kind))];
  const decadeTicks = Array.from({ length: Math.floor(hi / 10) - Math.ceil(lo / 10) + 1 }, (_, i) => (Math.ceil(lo / 10) + i) * 10).filter((t) => t >= lo && t <= hi);
  const ticks = decadeTicks.length > 12 ? decadeTicks.filter((t) => t % 20 === 0) : decadeTicks;

  return (
    <section className="mt-8 rounded-2xl border border-line bg-paper-2 p-4 sm:p-5" aria-labelledby="life-line" data-testid="life-line">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="life-line" className="font-serif text-2xl">The life, in time</h2>
          <p className="text-sm text-ink-2">Scrub through the years, or set the frame to see the whole life at once.</p>
        </div>
        <div role="radiogroup" aria-label="How much time to show" className="flex flex-wrap gap-1" data-testid="life-frame">
          {FRAMES.map((f) => <button key={String(f.id)} type="button" role="radio" aria-checked={frame === f.id} data-on={frame === f.id} className="chip" onClick={() => setFrame(f.id)}>{f.label}</button>)}
        </div>
      </div>

      {/* Where we are */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-primary btn-sm" disabled={all} onClick={() => { if (year >= hi) setYear(lo); setPlaying(!playing); }} aria-label={playing ? "Pause" : "Play the life"} data-testid="life-play">
          {playing ? "❚❚ Pause" : "▶ Play"}
        </button>
        <button type="button" className="btn btn-ghost btn-sm !px-2" disabled={all || year <= lo} onClick={() => setYear(Math.max(lo, year - 1))} aria-label="Year before"><Icon name="back" size={16} /></button>
        <p className="font-serif text-3xl tabular-nums" aria-live="polite" data-testid="life-now">
          {all ? `${formatYear(lo)}–${formatYear(hi)}` : a === b ? formatYear(a) : `${formatYear(a)}–${formatYear(b)}`}
          {!all && age(a) != null && <span className="ml-2 align-middle text-base text-ink-2">{name.split(" ")[0]} is {age(a)! < 0 ? "not yet born" : a === b || age(a) === age(b) ? `${age(a)}` : `${age(a)}–${age(b)}`}{age(a)! >= 0 ? " years old" : ""}</span>}
        </p>
        <button type="button" className="btn btn-ghost btn-sm !px-2" disabled={all || year >= hi} onClick={() => setYear(Math.min(hi, year + 1))} aria-label="Next year"><Icon name="forward" size={16} /></button>
      </div>

      {/* The track: every moment as a dot, the window as a band, a slider on top */}
      <div className="relative mx-2 mt-4 h-20 select-none">
        <span aria-hidden className="absolute inset-x-0 top-9 h-1.5 rounded-full bg-bronze/25" />
        <span aria-hidden className="absolute top-6 h-7 rounded-md bg-bronze/20 ring-2 ring-bronze/60 transition-[left,width] duration-200" style={{ left: `${at(a)}%`, width: `${Math.max(0.8, at(b) - at(a))}%` }} />
        {moments.map((m) => (
          <span key={m.id} aria-hidden title={`${m.year}: ${m.label}`} className={`absolute top-[2.15rem] -translate-x-1/2 rounded-full border border-paper ${m.kind === "life" ? "h-4 w-4 -mt-1" : "h-2.5 w-2.5"}`} style={{ left: `${at(m.year)}%`, background: KIND[m.kind].color, opacity: m.year >= a && m.year <= b ? 1 : 0.45 }} />
        ))}
        {ticks.map((t) => <span key={t} aria-hidden className="absolute top-14 -translate-x-1/2 text-[10px] tabular-nums text-ink-2" style={{ left: `${at(t)}%` }}>{t}</span>)}
        <span aria-hidden className="absolute top-0 -translate-x-1/2 text-[11px] font-semibold text-oxblood" style={{ left: "0%" }}>{born != null ? "Born" : formatYear(lo)}</span>
        {died != null && <span aria-hidden className="absolute right-0 top-0 translate-x-1/2 text-[11px] font-semibold text-oxblood">Died</span>}
        <input type="range" min={lo} max={hi} step={1} value={all ? lo : year} disabled={all} onChange={(e) => { setPlaying(false); setYear(Number(e.target.value)); }}
          aria-label={`Year in the life of ${name}`} aria-valuetext={`${formatYear(year)}${age(year) != null ? `, age ${age(year)}` : ""}`}
          className="absolute inset-x-0 top-5 h-10 w-full cursor-ew-resize opacity-0 disabled:cursor-default" data-testid="life-scrub" />
      </div>
      <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-2">{kinds.map((k) => <li key={k} className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: KIND[k].color }} />{KIND[k].label}</li>)}</ul>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-2">In {name}&rsquo;s life</h3>
          {byYear.length ? (
            <ol className={`mt-2 grid gap-2 ${all ? "max-h-[28rem] overflow-y-auto pr-1" : ""}`} data-testid="life-moments">
              {byYear.map(([y, ms]) => (
                <li key={y} className="flex gap-3">
                  <button type="button" onClick={() => { setFrame(frame === "all" ? 1 : frame); setYear(y); }} className="w-14 shrink-0 text-right font-serif text-lg tabular-nums text-bronze hover:underline" title="Jump here">{formatYear(y)}</button>
                  <ul className="min-w-0 flex-1 border-l-2 border-line pl-3">
                    {ms.map((m) => (
                      <li key={m.id} className="py-0.5 text-sm">
                        <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: KIND[m.kind].color }} />
                        {m.href ? (m.external ? <a href={m.href} target="_blank" rel="noopener noreferrer" className="hover:text-bronze">{m.label}</a> : <Link href={m.href} className="hover:text-bronze">{m.label}</Link>) : m.label}
                        {m.end != null && m.end !== y && <span className="text-ink-2"> (until {formatYear(m.end)})</span>}
                        {age(y) != null && age(y)! >= 0 && <span className="text-xs text-ink-2"> · age {age(y)}</span>}
                        <a href={m.source} target="_blank" rel="noopener noreferrer" className="ml-1 text-[11px] text-bronze hover:underline">source</a>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          ) : <p className="mt-2 text-sm text-ink-2">Wikidata records nothing dated in these years. Widen the frame, or play on.</p>}
        </div>
        <div className="grid content-start gap-5">
          {alive.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-2">People around them, alive then</h3>
              <ul className="mt-2 flex flex-wrap gap-1.5" data-testid="life-alive">
                {alive.slice(0, 12).map((r) => <li key={r.id}><Link href={/^Q\d+$/.test(r.id) ? `/explore/life?q=${r.id}` : `/explore/life?id=${r.id}`} className="chip !min-h-7 !text-xs">{r.label}{r.born != null && !all && <span className="text-ink-2">, {Math.max(0, a - r.born)}</span>}</Link></li>)}
              </ul>
            </div>
          )}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-2">Meanwhile in the world</h3>
            {pop && populationAt(pop, a) != null && <p className="mt-1 text-sm">About {people(populationAt(pop, a)!)} people alive on Earth{all ? ` at the start, ${people(populationAt(pop, b) ?? 0)} at the end` : ""}. <a className="text-[11px] text-bronze hover:underline" href={OWID_SOURCE} target="_blank" rel="noopener noreferrer">Our World in Data</a></p>}
            {!world ? <p className="mt-2 text-sm text-ink-2">Loading…</p> : meanwhile.length ? (
              <ul className="mt-2 grid gap-1.5" data-testid="life-meanwhile">
                {meanwhile.map((e) => <li key={e.i} className="text-sm"><span className="tabular-nums text-ink-2">{formatYear(yearOf(e.s))}</span> · <Link href={atlasHref(e)} className="hover:text-bronze">{e.t}</Link></li>)}
              </ul>
            ) : <p className="mt-2 text-sm text-ink-2">No well-documented events start in these years.</p>}
            {!all && <Link href={`/explore/year?y=${a}`} className="link mt-2 inline-block text-sm">Explore {formatYear(a)} →</Link>}
          </div>
        </div>
      </div>
    </section>
  );
}
