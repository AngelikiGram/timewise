"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { formatImportedDate, formatYear, yearOf, type Precision } from "@/lib/dates";
import { aliveIn, personById, TOPICS, WORKS, wd } from "@/lib/explore";
import { atlasHref, CONTINENT_LABELS, loadIndex, type IndexEvent } from "@/lib/world-index";
import { recordYear } from "@/lib/explorer";
import { OWID_SOURCE, people, population, populationAt } from "@/lib/opendata";
import { Icon } from "../icons";
import { BadgeToast } from "./Gamify";
import { ExploreMap, type MapItem } from "./ExploreMap";
import { ModeBar, NextSteps, SaveInterest } from "./shared";

/** Explore a year: the same year in different places, from documented records, with the collection's people and things. */
export function YearView() {
  const params = useSearchParams();
  const router = useRouter();
  const y = Math.max(-3000, Math.min(2025, Math.round(Number(params.get("y") ?? 1900)) || 1900));
  const [events, setEvents] = useState<IndexEvent[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [draft, setDraft] = useState(String(y));
  useEffect(() => setDraft(String(y)), [y]);
  useEffect(() => { loadIndex().then(setEvents, () => setFailed(true)); }, []);
  useEffect(() => { recordYear(y); }, [y]);
  const [world, setWorld] = useState<[number, number][] | null>(null);
  useEffect(() => { population("OWID_WRL").then(setWorld, () => setWorld([])); }, []);
  const pop = world ? populationAt(world, y) : null;
  // A new history entry for each year, so the browser's Back returns to the last one.
  const go = (n: number) => router.push(`/explore/year?y=${n}`, { scroll: false });

  // Events that began this year, or ran through it and lasted no more than ten years.
  const byContinent = useMemo(() => {
    if (!events) return [];
    const m = new Map<string, IndexEvent[]>();
    for (const e of events) {
      if (!e.ct || (e.n ?? 1) >= 5) continue;
      const a = yearOf(e.s), b = e.e ? yearOf(e.e) : a;
      if (!(a === y || (a <= y && b >= y && b - a <= 10))) continue;
      const list = m.get(e.ct) ?? [];
      if (list.length < 4) list.push(e);
      m.set(e.ct, list);
    }
    return Object.keys(CONTINENT_LABELS).filter((c) => m.has(c)).map((c) => [c, m.get(c)!] as const);
  }, [events, y]);

  const alive = aliveIn(y);
  const works = WORKS.filter((w) => w.year === y);
  const things = TOPICS.map((t) => ({ t, items: t.items.filter((x) => x.year === y) })).filter((x) => x.items.length);
  const points: MapItem[] = [
    ...works.filter((w) => w.point).map((w) => ({ id: w.id, label: w.label, lng: w.point![0], lat: w.point![1], layer: "works", year: w.year, image: w.image,
      sub: [w.people.map((x) => personById(x.id)?.label).filter(Boolean).join(", "), w.place].filter(Boolean).join(" · "),
      links: [...w.people.map((x) => ({ href: `/explore/life?id=${x.id}`, label: personById(x.id)?.label ?? "A life" })), { href: wd(w.id), label: "Wikidata", external: true }] })),
    ...things.flatMap(({ t, items }) => items.filter((x) => x.point).map((x) => ({ id: x.id, label: x.label, lng: x.point![0], lat: x.point![1], layer: t.id, year: x.year, sub: [t.label, x.place].filter(Boolean).join(" · "),
      links: [{ href: `/explore/thing?id=${t.id}`, label: `Follow ${t.label.toLowerCase()}` }, { href: x.source, label: "Source", external: true }] }))),
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6" data-testid="year">
      <BadgeToast />
      <ModeBar on="year" here={{ href: `/explore/year?y=${y}`, label: formatYear(y), mode: "year" }} context={{ ...(things[0] ? { thing: { href: `/explore/thing?id=${things[0].t.id}`, label: things[0].t.label } } : {}), ...(alive[0] ? { life: { href: `/explore/life?id=${alive[0].person.id}`, label: alive[0].person.label } } : {}) }} />
      <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Explore a year</p>
          <h1 className="mt-1 font-serif text-5xl tabular-nums leading-none" data-testid="year-title">{formatYear(y)}</h1>
        </div>
        <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); const n = Number(draft); if (Number.isFinite(n)) go(Math.round(n)); }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => go(y - 1)} aria-label="Previous year"><Icon name="back" size={15} />{y - 1}</button>
          <label className="sr-only" htmlFor="year-input">Year</label>
          <input id="year-input" inputMode="numeric" value={draft} onChange={(e) => setDraft(e.target.value.replace(/[^\d-]/g, ""))} className="field !w-24 !py-1 text-sm tabular-nums" />
          <button type="submit" className="btn btn-secondary btn-sm">Go</button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => go(y + 1)} aria-label="Next year">{y + 1}<Icon name="forward" size={15} /></button>
          <SaveInterest kind="year" id={y} label={String(y)} />
        </form>
      </div>
      {pop != null && <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-paper-2 px-3 py-1 text-sm" data-testid="year-population"><Icon name="people" size={16} className="text-bronze" />About <b>{people(pop)}</b> people lived on Earth in {formatYear(y)}<a className="text-[11px] text-bronze hover:underline" href={OWID_SOURCE} target="_blank" rel="noopener noreferrer">Our World in Data estimate</a></p>}
      <p className="mt-2 max-w-3xl text-sm text-ink-2">The same year in different places, from the best-documented records of each continent. Records tell of events more than of everyday life, so what shows here is what was written down.</p>

      <section className="mt-6" aria-labelledby="year-world">
        <h2 id="year-world" className="font-serif text-2xl">Around the world</h2>
        {failed && <p className="mt-2 text-sm text-ink-2">The world index couldn&rsquo;t be loaded.</p>}
        {!events && !failed && <p className="mt-2 text-sm text-ink-2" role="status">Loading records…</p>}
        {events && !byContinent.length && <p className="mt-2 text-sm text-ink-2">No well-documented event is dated to {formatYear(y)} in the index.</p>}
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="year-continents">
          {byContinent.map(([c, list]) => (
            <li key={c} className="card p-4">
              <p className="text-xs font-semibold text-bronze">{CONTINENT_LABELS[c]}</p>
              <ul className="mt-2 grid gap-2">
                {list.map((e) => <li key={e.i} className="text-sm"><Link href={atlasHref(e)} className="font-medium hover:text-bronze">{e.t}</Link><span className="block text-xs text-ink-2">{formatImportedDate(e.s, e.e, e.p as Precision)}</span></li>)}
              </ul>
            </li>
          ))}
        </ul>
      </section>

      {(alive.length > 0 || works.length > 0 || things.length > 0) && (
        <section className="mt-8" aria-labelledby="year-collection">
          <h2 id="year-collection" className="font-serif text-2xl">In Vienna around 1900, and beyond</h2>
          <div className="mt-3 grid gap-6 lg:grid-cols-2">
            <div>
              {alive.length > 0 && (
                <>
                  <h3 className="text-sm font-semibold">Alive in {formatYear(y)}</h3>
                  <ul className="mt-2 flex flex-wrap gap-1.5" data-testid="year-alive">{alive.map(({ person, age }) => <li key={person.id}><Link href={`/explore/life?id=${person.id}`} className="chip !min-h-8 !text-sm"><Icon name="person" size={14} className="text-bronze" />{person.label}, {age}</Link></li>)}</ul>
                </>
              )}
              {works.length > 0 && (
                <>
                  <h3 className="mt-4 text-sm font-semibold">Works dated {formatYear(y)}</h3>
                  <ul className="mt-2 grid gap-1 text-sm">{works.map((w) => <li key={w.id}><a href={wd(w.id)} target="_blank" rel="noopener noreferrer" className="hover:text-bronze">{w.label}</a>{w.place ? <span className="text-ink-2"> · {w.place}</span> : null} <span className="text-ink-2">by</span> {w.people.map((x, i) => <span key={x.id}>{i ? ", " : ""}<Link className="link" href={`/explore/life?id=${x.id}`}>{personById(x.id)?.label}</Link></span>)}</li>)}</ul>
                </>
              )}
              {things.map(({ t, items }) => (
                <p key={t.id} className="mt-4 text-sm"><Link href={`/explore/thing?id=${t.id}`} className="font-semibold hover:text-bronze">{t.label}</Link>: {items.length} dated {formatYear(y)}, among them {items.slice(0, 3).map((x) => x.label).join(", ")}.</p>
              ))}
            </div>
            {points.length > 0 && <ExploreMap items={points} layers={[{ id: "works", label: "Works of these people", color: "#7a1f2b" }, ...TOPICS.map((t, i) => ({ id: t.id, label: t.label, color: ["#8a5a1c", "#2f6f8f", "#3d7f4e"][i % 3] }))]} label={`Works and records dated ${formatYear(y)}`} />}
          </div>
        </section>
      )}

      <NextSteps items={[
        ...alive.slice(0, 2).map(({ person, age }) => ({ href: `/explore/life?id=${person.id}`, icon: "person" as const, title: person.label, why: `Aged ${age} in ${formatYear(y)}. Follow the life.` })),
        ...things.slice(0, 2).map(({ t }) => ({ href: `/explore/thing?id=${t.id}`, icon: "network" as const, title: `Follow ${t.label.toLowerCase()}`, why: `See it across places and centuries, not just ${formatYear(y)}.` })),
        { href: `/explore/year?y=${y + 10}`, icon: "timeline" as const, title: `Ten years on: ${formatYear(y + 10)}`, why: "Compare the same places a decade later." },
      ]} />
    </div>
  );
}
