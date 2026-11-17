"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { decades, peopleOf, TOPIC_NOUN, TOPIC_YEAR, TOPICS, topicById, wd } from "@/lib/explore";
import { Icon } from "../icons";
import { MiniMap } from "../lessons/activities";
import { ModeBar, NextSteps, SaveInterest } from "./shared";

/** Follow a thing: where and when it appears, decade by decade, from the Wikidata records that name it. */
export function ThingView() {
  const id = useSearchParams().get("id") ?? TOPICS[0].id;
  const t = topicById(id) ?? TOPICS[0];
  const all = t.items;
  const [min, max] = [all[0]?.year ?? 1800, all[all.length - 1]?.year ?? 2000];
  const bars = useMemo(() => decades(all.map((x) => x.year)), [all]);
  const [range, setRange] = useState<[number, number] | null>(null);
  const [lo, hi] = range ?? [min, max];
  const shown = all.filter((x) => x.year >= lo && x.year <= hi);
  const top = Math.max(1, ...bars.map((b) => b[1]));
  const places = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of shown) if (x.place) m.set(x.place, (m.get(x.place) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [shown]);
  const people = peopleOf(t);
  const [one, many] = TOPIC_NOUN[t.kind];
  const peak = bars.slice().sort((a, b) => b[1] - a[1])[0];
  const first = all[0];

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6" data-testid="thing">
      <ModeBar on="thing" />
      <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Follow a thing</p>
          <h1 className="mt-1 font-serif text-4xl leading-tight">{t.label}</h1>
          {t.description && <p className="mt-1 text-lg text-ink-2">{t.description} <span className="text-xs">(Wikidata&rsquo;s description)</span></p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {TOPICS.filter((x) => x.id !== t.id).map((x) => <Link key={x.id} href={`/explore/thing?id=${x.id}`} className="chip">{x.label}</Link>)}
        </div>
      </div>
      <p className="mt-3 max-w-3xl text-sm text-ink-2">
        {all.length} {many} on Wikidata with a place and a year {TOPIC_YEAR[t.kind]}, from {first ? `${first.label} (${first.year})` : "—"} on. These are the documented ones, not all there were: the record grows where people have written it down.
      </p>
      <div className="mt-3 flex flex-wrap gap-2"><SaveInterest kind="topic" id={t.id} label={t.label} /><a href={wd(t.qid)} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">Wikidata ↗</a></div>

      {/* Decade bars: click one to see that decade, or the whole span again. */}
      <section className="mt-6" aria-labelledby="spread-time">
        <div className="flex items-baseline justify-between gap-2"><h2 id="spread-time" className="font-serif text-2xl">When</h2>{range && <button type="button" className="link text-sm" onClick={() => setRange(null)}>All years</button>}</div>
        <div className="mt-2 flex h-28 items-end gap-px rounded-lg border border-line bg-paper-2 p-2" role="group" aria-label={`${many} per decade`} data-testid="thing-decades">
          {bars.map(([dec, n]) => {
            const on = lo <= dec && dec + 9 <= hi && range;
            return <button key={dec} type="button" title={`${dec}s: ${n} ${n === 1 ? one : many}`} aria-label={`${dec}s, ${n}`} aria-pressed={!!on} onClick={() => setRange([dec, dec + 9])} className={`min-w-[3px] flex-1 rounded-t ${on ? "bg-oxblood" : "bg-bronze/70 hover:bg-bronze"}`} style={{ height: `${Math.max(4, (n / top) * 100)}%` }} />;
          })}
        </div>
        <div className="mt-1 flex justify-between text-xs tabular-nums text-ink-2"><span>{bars[0]?.[0]}s</span>{peak && <span>Most in the {peak[0]}s ({peak[1]})</span>}<span>{bars[bars.length - 1]?.[0]}s</span></div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section aria-labelledby="spread-where">
          <h2 id="spread-where" className="font-serif text-2xl">Where{range ? `, ${lo}–${hi}` : ""}</h2>
          <MiniMap className="mt-3" points={shown.filter((x) => x.point).slice(0, 400).map((x) => ({ label: "", lng: x.point![0], lat: x.point![1] }))} label={`${shown.length} ${many} on a map`} />
          {places.length > 0 && <p className="mt-2 text-sm text-ink-2">Most often in: {places.map(([pl, n]) => `${pl} (${n})`).join(", ")}.</p>}
        </section>
        <section aria-labelledby="spread-list">
          <h2 id="spread-list" className="font-serif text-2xl">{shown.length} {shown.length === 1 ? one : many}</h2>
          <ul className="mt-3 max-h-[26rem] divide-y divide-line overflow-y-auto rounded-lg border border-line bg-paper-2" data-testid="thing-items">
            {shown.slice(0, 200).map((x) => (
              <li key={x.id} className="flex items-baseline gap-3 px-3 py-2 text-sm">
                <Link href={`/explore/year?y=${x.year}`} className="w-12 shrink-0 tabular-nums text-bronze hover:underline" title={`Explore ${x.year}`}>{x.year}</Link>
                <span className="min-w-0 flex-1"><a href={x.source} target="_blank" rel="noopener noreferrer" className="hover:text-bronze">{x.label}</a>{x.place && <span className="text-ink-2"> · {x.place}</span>}</span>
              </li>
            ))}
          </ul>
          {shown.length > 200 && <p className="mt-1 text-xs text-ink-2">The first 200 by year; choose a decade to see the rest.</p>}
        </section>
      </div>

      <NextSteps items={[
        ...people.slice(0, 3).map((p) => ({ href: `/explore/life?id=${p.id}`, icon: "person" as const, title: p.label, why: `A life tied to ${t.label.toLowerCase()} by Wikidata.` })),
        ...(peak ? [{ href: `/explore/year?y=${peak[0] + 5}`, icon: "timeline" as const, title: `The world in ${peak[0] + 5}`, why: `In the busiest decade for ${t.label.toLowerCase()}: what else was happening.` }] : []),
        ...TOPICS.filter((x) => x.id !== t.id).slice(0, 1).map((x) => ({ href: `/explore/thing?id=${x.id}`, icon: "network" as const, title: `Follow ${x.label.toLowerCase()}`, why: "Another thing to follow." })),
      ]} />
      <p className="mt-6 flex items-center gap-1.5 text-xs text-ink-2"><Icon name="source" size={14} />Each item links to the Wikidata statement that ties it to {t.label.toLowerCase()}.</p>
    </div>
  );
}
