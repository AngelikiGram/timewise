"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CATEGORY_LABELS, categoryVar } from "@/lib/categories";
import { dailyChallenge, FORMATS } from "@/lib/challenges";
import { formatImportedDate, type Precision } from "@/lib/dates";
import { useProgress } from "@/lib/progress";
import { atlasHref, CONTINENT_LABELS, loadIndex, type IndexEvent } from "@/lib/world-index";
import { pickMeanwhile } from "./Meanwhile";

/** Today's challenge, as a card. The day is the reader's own, so it's chosen in the browser. */
export function DailyTeaser() {
  const [today, setToday] = useState<ReturnType<typeof dailyChallenge> | null>(null);
  const p = useProgress();
  useEffect(() => setToday(dailyChallenge()), []);
  if (!today) return <div className="skeleton h-48" />;
  const done = p.results.some((r) => r.id === `daily:${today.day}`);
  const c = today.challenge;
  return (
    <Link href="/challenges#today" className="card flex h-full flex-col p-6" data-testid="daily-teaser">
      <span className="flex items-center justify-between">
        <span className="eyebrow">Today&rsquo;s challenge</span>
        {done && <span className="badge text-navy">✓ Done</span>}
      </span>
      <span className="mt-3 text-sm text-ink-2">{FORMATS[c.kind].label} · {c.minutes} min</span>
      <span className="mt-1 font-serif text-2xl leading-snug">{c.title}</span>
      <span className="mt-2 text-ink-2">{c.prompt}</span>
      <span className="btn btn-primary mt-auto self-start">{done ? "Play again" : "Play now"}</span>
    </Link>
  );
}

const YEARS = [1492, 1789, 1848, 1914, 1969];

/** "Meanwhile, elsewhere…" for a chosen year: one documented event from each continent. */
export function MeanwhileYears() {
  const [events, setEvents] = useState<IndexEvent[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [year, setYear] = useState(1848);
  useEffect(() => {
    loadIndex().then(setEvents).catch(() => setFailed(true));
  }, []);
  const picks = useMemo(() => (events ? pickMeanwhile(events, { id: "", title: String(year), start: `${String(year).padStart(4, "0")}-01-01`, end: `${year}-12-31` }, null, 6) : []), [events, year]);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Choose a year">
        {YEARS.map((y) => <button key={y} type="button" aria-pressed={year === y} onClick={() => setYear(y)} className="chip">{y}</button>)}
      </div>
      {failed && <p className="mt-4 text-ink-2">The world index couldn&rsquo;t be loaded.</p>}
      {!events && !failed && <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton h-28" />)}</div>}
      {events && (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="meanwhile-years">
          {picks.map((e) => (
            <li key={e.i}>
              <Link href={atlasHref(e)} className="card flex h-full flex-col p-4">
                <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-2">
                  <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: categoryVar(e.c) }} />
                  {CONTINENT_LABELS[e.ct!]}
                </span>
                <span className="mt-2 font-serif text-lg leading-snug">{e.t}</span>
                <span className="mt-auto pt-2 text-xs text-ink-2">{formatImportedDate(e.s, e.e, e.p as Precision)} · {CATEGORY_LABELS[e.c] ?? e.c}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-ink-2">Events from the same few years on different continents. A shared date is a coincidence in time, not a connection. Imported from Wikidata.</p>
    </div>
  );
}
