"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CATEGORY_LABELS, categoryVar } from "@/lib/categories";
import { formatImportedDate, formatYear, yearOf, type Precision } from "@/lib/dates";
import { atlasHref, CONTINENT_LABELS, loadIndex, type IndexEvent } from "@/lib/world-index";

type Anchor = { id: string; title: string; start: string; end?: string; continent?: string | null };

/** How far apart two events may be and still count as "meanwhile": wider for periods known less precisely. */
function windowFor(y: number) {
  if (y < 500) return 25;
  if (y < 1500) return 10;
  if (y < 1800) return 5;
  return 2;
}

const span = (start: string, end?: string): [number, number] => [yearOf(start), end ? yearOf(end) : yearOf(start)];

/** Years between two spans; 0 when they overlap. Negative: the other is earlier. */
function gap(a: [number, number], b: [number, number]) {
  if (b[1] < a[0]) return b[1] - a[0];
  if (b[0] > a[1]) return b[0] - a[1];
  return 0;
}

function overlapText(g: number, other: [number, number], self: [number, number]) {
  if (g === 0) {
    if (other[0] === self[0] && other[1] === self[1] && self[0] === self[1]) return "Same year";
    return "Overlapping years";
  }
  const n = Math.abs(g);
  return `${n} year${n === 1 ? "" : "s"} ${g < 0 ? "earlier" : "later"}`;
}

export type MeanwhilePick = IndexEvent & { gap: number };

export function pickMeanwhile(events: IndexEvent[], anchor: Anchor, continent: string | null, limit = 4): MeanwhilePick[] {
  const self = span(anchor.start, anchor.end);
  const w = windowFor(self[0]);
  const out: MeanwhilePick[] = [];
  const seenContinent = new Map<string, number>();
  // The index is sorted by documentation, so the first matches per continent are the best known.
  for (const e of events) {
    if (e.i === anchor.id || !e.ct || (e.n ?? 1) >= 5) continue;
    if (continent ? e.ct === continent : false) continue;
    const other = span(e.s, e.e);
    if (other[1] - other[0] > 50) continue; // a centuries-long state isn't a "meanwhile"
    const g = gap(self, other);
    if (Math.abs(g) > w) continue;
    // One per continent, so the list goes around the world.
    if (seenContinent.has(e.ct)) continue;
    seenContinent.set(e.ct, 1);
    out.push({ ...e, gap: g });
    if (out.length >= limit) break;
  }
  return out.sort((a, b) => Math.abs(a.gap) - Math.abs(b.gap));
}

/**
 * "Meanwhile, elsewhere…": well-documented events on other continents in the same years. A shared date is
 * a coincidence in time, so nothing here is presented as a cause or an influence.
 */
export function Meanwhile({ anchor, compact = false }: { anchor: Anchor; compact?: boolean }) {
  const [events, setEvents] = useState<IndexEvent[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [compare, setCompare] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadIndex().then(setEvents).catch(() => setFailed(true));
  }, []);
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("compare");
    setCompare(c && CONTINENT_LABELS[c] ? c : "");
  }, [anchor.id]);

  const continent = anchor.continent ?? null;
  const picks = useMemo(() => (events ? pickMeanwhile(events, anchor, continent) : []), [events, anchor, continent]);
  const self = span(anchor.start, anchor.end);
  const w = windowFor(self[0]);

  // The side-by-side comparison: this event against one other continent, over the same window.
  const lanes = useMemo(() => {
    if (!events || !compare) return null;
    const from = self[0] - w, to = self[1] + w;
    const inWindow = (e: IndexEvent, ct: string) => e.ct === ct && (e.n ?? 1) < 5 && span(e.s, e.e)[1] - span(e.s, e.e)[0] <= 50 && span(e.s, e.e)[1] >= from && span(e.s, e.e)[0] <= to;
    const other = events.filter((e) => inWindow(e, compare)).slice(0, 8);
    const here = continent ? events.filter((e) => e.i !== anchor.id && inWindow(e, continent)).slice(0, 5) : [];
    return { from, to, other, here };
  }, [events, compare, continent, anchor.id, self, w]);

  const share = async () => {
    const url = new URL(window.location.href);
    if (compare) url.searchParams.set("compare", compare);
    else url.searchParams.delete("compare");
    try {
      await navigator.clipboard.writeText(url.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link", url.toString());
    }
  };

  const pct = (y: number) => (lanes ? ((y - lanes.from) / Math.max(1, lanes.to - lanes.from)) * 100 : 0);

  return (
    <section aria-labelledby="meanwhile-title" data-testid="meanwhile" className="overflow-hidden rounded-lg border border-bronze/50 bg-paper-2">
      <header className="flex items-start justify-between gap-3 border-b border-line bg-paper-3/60 px-4 py-3">
        <div>
          <h3 id="meanwhile-title" className="font-serif text-xl italic">Meanwhile, elsewhere…</h3>
          <p className="mt-0.5 text-xs text-ink-2">
            Within {w} years of {formatYear(self[0])}{self[1] !== self[0] ? `–${formatYear(self[1])}` : ""}, on other continents. A shared date is a coincidence in time, not a connection.
          </p>
        </div>
        <button type="button" onClick={share} className="btn btn-sm btn-ghost shrink-0" aria-live="polite">{copied ? "Link copied" : "Share"}</button>
      </header>
      {failed && <p className="p-4 text-sm text-ink-2">The world index couldn&rsquo;t be loaded. <button type="button" className="link" onClick={() => { setFailed(false); loadIndex().then(setEvents).catch(() => setFailed(true)); }}>Try again</button></p>}
      {!events && !failed && <div className="space-y-2 p-4" aria-busy aria-label="Loading"><div className="skeleton h-5 w-3/4" /><div className="skeleton h-5 w-2/3" /><div className="skeleton h-5 w-4/5" /></div>}
      {events && picks.length === 0 && <p className="p-4 text-sm text-ink-2">No well-documented event elsewhere falls this close in time. That says more about what has been recorded than about what happened.</p>}
      {picks.length > 0 && (
        <ul className="divide-y divide-line">
          {picks.map((e) => (
            <li key={e.i}>
              <Link href={atlasHref(e)} className="group flex gap-3 px-4 py-3 hover:bg-paper-3/60">
                <span aria-hidden className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: categoryVar(e.c) }} />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-ink-2">
                    <span className="font-semibold text-ink">{CONTINENT_LABELS[e.ct!]}</span> · {formatImportedDate(e.s, e.e, e.p as Precision)} · {CATEGORY_LABELS[e.c] ?? e.c}
                  </span>
                  <span className="block font-serif text-[1.05rem] leading-snug group-hover:text-bronze">{e.t}</span>
                </span>
                <span className="shrink-0 self-center rounded-full bg-paper-3 px-2 py-0.5 text-xs text-ink-2">{overlapText(e.gap, span(e.s, e.e), self)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {!compact && events && (
        <div className="border-t border-line px-4 py-3">
          <label className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-ink-2">Compare timelines with</span>
            <select value={compare} onChange={(e) => setCompare(e.target.value)} className="field !min-h-9 !w-auto !py-1 text-sm" data-testid="meanwhile-compare">
              <option value="">choose a continent</option>
              {Object.entries(CONTINENT_LABELS).filter(([id]) => id !== continent).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </label>
          {lanes && (
            <div className="mt-3" data-testid="meanwhile-lanes">
              <div className="flex justify-between text-xs tabular-nums text-ink-2"><span>{formatYear(lanes.from)}</span><span>{formatYear(lanes.to)}</span></div>
              {[{ name: continent ? CONTINENT_LABELS[continent] ?? "Here" : "Here", items: lanes.here, self: true }, { name: CONTINENT_LABELS[compare], items: lanes.other, self: false }].map((lane) => (
                <div key={lane.name} className="mt-2">
                  <p className="text-xs font-semibold text-ink-2">{lane.name}</p>
                  <div className="relative mt-1 h-7 rounded bg-paper-3">
                    {lane.self && (
                      <span title={anchor.title} className="absolute top-0 h-7 rounded border-2 border-bronze bg-bronze/25" style={{ left: `${pct(self[0])}%`, width: `max(6px, ${pct(self[1] + 1) - pct(self[0])}%)` }} />
                    )}
                    {lane.items.map((e) => {
                      const [a, b] = span(e.s, e.e);
                      return <span key={e.i} title={`${e.t} (${formatImportedDate(e.s, e.e, e.p as Precision)})`} className="absolute top-1.5 h-4 rounded-sm opacity-80" style={{ left: `${Math.max(0, pct(a))}%`, width: `max(4px, ${Math.min(100, pct(b + 1)) - Math.max(0, pct(a))}%)`, background: categoryVar(e.c) }} />;
                    })}
                  </div>
                </div>
              ))}
              <ul className="mt-3 space-y-1 text-sm">
                {lanes.other.map((e) => (
                  <li key={e.i} className="flex gap-2">
                    <span className="w-24 shrink-0 text-xs tabular-nums text-ink-2">{formatImportedDate(e.s, e.e, e.p as Precision)}</span>
                    <Link href={atlasHref(e)} className="min-w-0 flex-1 hover:text-bronze">{e.t}</Link>
                  </li>
                ))}
                {lanes.other.length === 0 && <li className="text-ink-2">Nothing from {CONTINENT_LABELS[compare]} is in the index for these years.</li>}
              </ul>
            </div>
          )}
        </div>
      )}
      <p className="border-t border-line px-4 py-2 text-xs text-ink-2">Chosen by date and by how widely each is documented, from imported Wikidata records. Each opens its own record.</p>
    </section>
  );
}
