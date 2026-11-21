"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatYear } from "@/lib/dates";
import { MET_SOURCE, metObjects, onThisDay, type DayEvent, type MuseumObject } from "@/lib/opendata";

/** Wikipedia's picks for today's date, oldest first, each opening its year or its causes. */
export function OnThisDay() {
  const [list, setList] = useState<DayEvent[] | null>(null);
  const [date, setDate] = useState<Date | null>(null);
  useEffect(() => {
    const d = new Date(); setDate(d);
    const ac = new AbortController();
    onThisDay(d.getMonth() + 1, d.getDate(), ac.signal).then(setList, () => setList([]));
    return () => ac.abort();
  }, []);
  if (list && !list.length) return null;
  return (
    <section aria-labelledby="otd-title" data-testid="on-this-day">
      <h2 id="otd-title" className="font-serif text-3xl">On this day{date ? `, ${date.toLocaleDateString("en-GB", { day: "numeric", month: "long" })}` : ""}</h2>
      <p className="text-sm text-ink-2">Picked by Wikipedia editors. Click a year to see what else was happening then.</p>
      {!list ? <p className="mt-3 text-sm text-ink-2" role="status">Loading…</p> : (
        <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.slice(0, 6).map((e) => (
            <li key={`${e.year}${e.text.slice(0, 20)}`} className="flex gap-3 rounded-lg border border-line bg-paper-2 p-3">
              {e.page?.thumb ? <img src={e.page.thumb} alt="" loading="lazy" className="h-16 w-16 shrink-0 rounded-md object-cover" /> : null}
              <div className="min-w-0">
                <Link href={`/explore/year?y=${e.year}`} className="font-serif text-2xl leading-none tabular-nums text-navy underline decoration-1 underline-offset-4">{formatYear(e.year)}</Link>
                <p className="mt-1 line-clamp-3 text-sm">{e.text}</p>
                {e.page?.qid && <Link href={`/explore/why?q=${e.page.qid}`} className="mt-1 inline-block text-xs font-semibold text-ink-2 hover:text-navy hover:underline">Why did it happen?</Link>}
              </div>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-2 text-[11px] text-ink-2">From <a className="link" href="https://en.wikipedia.org/wiki/Wikipedia:Selected_anniversaries" target="_blank" rel="noopener noreferrer">Wikipedia&rsquo;s selected anniversaries</a>, CC BY-SA 4.0.</p>
    </section>
  );
}

/** Public-domain objects in The Met made around a year: what people held, wore and looked at then. */
export function MadeAround({ year }: { year: number }) {
  const [items, setItems] = useState<MuseumObject[] | null>(null);
  useEffect(() => {
    setItems(null);
    const ac = new AbortController();
    metObjects(year, ac.signal).then(setItems, () => setItems([]));
    return () => ac.abort();
  }, [year]);
  if (items && !items.length) return null;
  return (
    <section className="mt-8" aria-labelledby="made-title" data-testid="made-around">
      <h2 id="made-title" className="font-serif text-2xl">Made around {formatYear(year)}</h2>
      <p className="text-sm text-ink-2">Objects from The Metropolitan Museum of Art dated near this year. Every image is in the public domain.</p>
      {!items ? <p className="mt-3 text-sm text-ink-2" role="status">Asking the museum…</p> : (
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((o) => (
            <li key={o.id}>
              <a href={o.link} target="_blank" rel="noopener noreferrer" className="card group block h-full overflow-hidden">
                <span className="block aspect-square overflow-hidden bg-paper-3"><img src={o.image} alt={o.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none" /></span>
                <span className="block p-2.5"><span className="line-clamp-2 text-sm font-semibold group-hover:underline">{o.title}</span><span className="block truncate text-xs text-ink-2">{[o.date, o.culture ?? o.artist].filter(Boolean).join(", ")}</span></span>
              </a>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[11px] text-ink-2">From <a className="link" href={MET_SOURCE} target="_blank" rel="noopener noreferrer">The Met Collection API</a>, CC0.</p>
    </section>
  );
}
