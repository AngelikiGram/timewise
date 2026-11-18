"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { formatYear } from "@/lib/dates";
import { linksOf, PEOPLE, type Person, personById, sharedWorks, topicsOf, wd, worksOf } from "@/lib/explore";
import { Icon } from "../icons";
import { ExploreMap, type MapItem } from "./ExploreMap";
import { artistOf, ModeBar, NextSteps, Pictured, SaveInterest, Src } from "./shared";

/** Follow a life: a documented person's years, works, places and the people around them. */
export function LifeView() {
  const id = useSearchParams().get("id");
  const p = id ? personById(id) : undefined;
  return p ? <Life p={p} key={p.id} /> : <LifeIndex />;
}

function Life({ p }: { p: Person }) {
  const works = worksOf(p.id);
  const dated = works.filter((w) => w.year != null);
  const b = p.born?.year, d = p.died?.year;
  const points: MapItem[] = [
    ...(p.born?.point ? [{ id: "born", label: `Born in ${p.born.place}`, lng: p.born.point[0], lat: p.born.point[1], layer: "life", year: p.born.year, sub: `${p.born.year}`, links: [{ href: `/explore/year?y=${p.born.year}`, label: `Explore ${p.born.year}` }, { href: p.born.source, label: "Source", external: true }] }] : []),
    ...(p.died?.point ? [{ id: "died", label: `Died in ${p.died.place}`, lng: p.died.point[0], lat: p.died.point[1], layer: "life", year: p.died.year, sub: `${p.died.year}`, links: [{ href: `/explore/year?y=${p.died.year}`, label: `Explore ${p.died.year}` }, { href: p.died.source, label: "Source", external: true }] }] : []),
    ...works.filter((w) => w.point).map((w) => {
      const me = w.people.find((x) => x.id === p.id)!;
      return { id: w.id, label: w.label, lng: w.point![0], lat: w.point![1], layer: "works", year: w.year, image: w.image, sub: [me.role, w.year, w.place].filter(Boolean).join(" · "),
        links: [...(w.year ? [{ href: `/explore/year?y=${w.year}`, label: `Explore ${w.year}` }] : []), ...w.people.filter((x) => x.id !== p.id).map((x) => ({ href: `/explore/life?id=${x.id}`, label: personById(x.id)?.label ?? "Another life" })), { href: me.source, label: "Source", external: true }] };
    }),
  ];
  const raw = [...(b != null ? [{ y: b, label: "Born", id: "born", life: true }] : []), ...dated.map((w) => ({ y: w.year!, label: w.label, id: w.id, life: false })), ...(d != null ? [{ y: d, label: "Died", id: "died", life: true }] : [])].sort((x, z) => x.y - z.y);
  const lo = raw[0]?.y ?? 1850, hi = raw[raw.length - 1]?.y ?? 1950;
  const span = Math.max(1, hi - lo);
  // Year labels only where there's room: never closer than 5% of the line to the last one shown.
  let last = -Infinity;
  const marks = raw.map((x) => { const at = ((x.y - lo) / span) * 100; const show = x.life || at - last >= 5; if (show) last = at; return { ...x, show }; });
  const people = linksOf(p.id);
  const together = sharedWorks(p.id);
  const topics = topicsOf(p.id);
  const [focus, setFocus] = useState<string | null>(null);
  const peak = dated.length ? dated[Math.floor(dated.length / 2)].year! : b ? b + 40 : 1900;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6" data-testid="life">
      <ModeBar on="life" here={{ href: `/explore/life?id=${p.id}`, label: p.label, mode: "life" }} context={{ year: { href: `/explore/year?y=${peak}`, label: String(peak) }, ...(topics[0] ? { thing: { href: `/explore/thing?id=${topics[0].id}`, label: topics[0].label } } : {}) }} />
      <div className="mt-5 grid gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
        <Pictured image={p.image} alt={`Portrait of ${p.label}`} />
        <div>
          <p className="eyebrow">Follow a life</p>
          <h1 className="mt-1 font-serif text-4xl leading-tight">{p.label}</h1>
          {p.description && <p className="mt-1 text-lg text-ink-2">{p.description} <span className="text-xs">(Wikidata&rsquo;s description)</span></p>}
          <dl className="mt-3 grid gap-1 text-sm">
            {p.born?.year != null && <div><dt className="inline font-semibold">Born </dt><dd className="inline">{p.born.date ? new Date(p.born.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : formatYear(p.born.year)}{p.born.place ? `, ${p.born.place}` : ""}<Src href={p.born.source} /></dd></div>}
            {p.died?.year != null && <div><dt className="inline font-semibold">Died </dt><dd className="inline">{p.died.date ? new Date(p.died.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : formatYear(p.died.year)}{p.died.place ? `, ${p.died.place}` : ""}<Src href={p.died.source} /></dd></div>}
          </dl>
          <ul className="mt-3 flex flex-wrap gap-1.5 text-xs">
            {[...(p.occupations ?? []), ...(p.movements ?? []), ...(p.memberOf ?? [])].slice(0, 10).map((x) => <li key={x.id}><a href={x.source} target="_blank" rel="noopener noreferrer" className="chip !min-h-7 !text-xs">{x.label}</a></li>)}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <SaveInterest kind="person" id={p.id} label={p.label} />
            <a href={wd(p.id)} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">Wikidata ↗</a>
          </div>
        </div>
      </div>

      {/* The life on one line: birth, dated works, death. Each mark opens that year; names are in the list below. */}
      <section className="mt-8" aria-labelledby="life-line">
        <h2 id="life-line" className="font-serif text-2xl">The life, in time</h2>
        <div className="relative mx-4 mt-4 h-16" data-testid="life-line">
          <span aria-hidden className="absolute inset-x-0 top-7 h-1 rounded bg-bronze/40" />
          {marks.map((x) => (
            <Link key={x.id} href={`/explore/year?y=${x.y}`} title={`${x.label}, ${x.y}: explore this year`} aria-label={`${x.label}, ${x.y}`} className="group absolute top-0 flex -translate-x-1/2 flex-col items-center" style={{ left: `${((x.y - lo) / span) * 100}%` }}>
              <span className={`text-[11px] tabular-nums ${x.show ? "text-ink-2" : "invisible"}`}>{x.y}</span>
              <span className={`mt-1 rounded-full border-2 group-hover:scale-125 ${x.life ? "h-5 w-5 border-oxblood bg-paper" : "h-3.5 w-3.5 border-bronze bg-bronze-soft"}`} />
              {x.life && <span className="mt-1 text-[11px] font-semibold">{x.label}</span>}
            </Link>
          ))}
        </div>
        <p className="mt-1 text-xs text-ink-2">Each mark opens that year. Some works are dated after the life: Wikidata dates them from when they were finished or opened.</p>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {points.length > 0 && (
          <section aria-labelledby="life-places">
            <h2 id="life-places" className="font-serif text-2xl">Where</h2>
            <div className="mt-3"><ExploreMap items={points} layers={[{ id: "life", label: "Birth and death", color: "#7a1f2b" }, { id: "works", label: "Works", color: "#8a5a1c" }]} label={`Places in the life of ${p.label}`} focusId={focus} /></div>
          </section>
        )}
        <section aria-labelledby="life-works">
          <h2 id="life-works" className="font-serif text-2xl">Works</h2>
          {works.length ? (
            <ul className="mt-3 grid gap-2" data-testid="life-works">
              {works.map((w) => (
                <li key={w.id} className="flex items-center gap-3 rounded-lg border border-line bg-paper-2 p-2">
                  {w.image ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={w.image.url} alt="" className="h-12 w-12 shrink-0 rounded object-cover" title={[artistOf(w.image.artist), w.image.license].filter(Boolean).join(" · ")} /> : <span className="grid h-12 w-12 shrink-0 place-items-center rounded bg-paper-3 text-bronze"><Icon name="city" size={20} /></span>}
                  <span className="min-w-0 flex-1 text-sm">
                    <a href={wd(w.id)} target="_blank" rel="noopener noreferrer" className="font-medium hover:text-bronze">{w.label}</a>{w.point && <button type="button" onClick={() => setFocus(w.id)} className="ml-2 text-xs text-bronze hover:underline">on the map</button>}
                    <span className="block text-xs text-ink-2">{w.people.find((x) => x.id === p.id)?.role}{w.year != null && <> · <Link className="link" href={`/explore/year?y=${w.year}`}>{w.year}</Link></>}{w.place ? ` · ${w.place}` : ""}<Src href={w.people.find((x) => x.id === p.id)!.source} /></span>
                    {w.image && <span className="block truncate text-[10px] text-ink-2">Image: {[artistOf(w.image.artist), w.image.license].filter(Boolean).join(", ")}{w.image.page && <> · <a className="hover:underline" href={w.image.page} target="_blank" rel="noopener noreferrer">Commons</a></>}</span>}
                  </span>
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-sm text-ink-2">Wikidata names no well-documented works for this person.</p>}
        </section>
      </div>

      {(people.length > 0 || together.length > 0) && (
        <section className="mt-8" aria-labelledby="life-people">
          <h2 id="life-people" className="font-serif text-2xl">People around them</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2" data-testid="life-people">
            {people.map((l) => {
              const o = personById(l.from === p.id ? l.to : l.from)!;
              return <li key={`${l.from}${l.label}${l.to}`} className="rounded-lg border border-line bg-paper-2 p-3 text-sm"><Link href={`/explore/life?id=${o.id}`} className="font-semibold hover:text-bronze">{o.label}</Link>: {l.from === p.id ? `${p.label} ${l.label} ${o.label}` : `${o.label} ${l.label} ${p.label}`}<Src href={l.source} /></li>;
            })}
            {together.map(({ person: o, work: w }) => <li key={`w${o.id}`} className="rounded-lg border border-line bg-paper-2 p-3 text-sm"><Link href={`/explore/life?id=${o.id}`} className="font-semibold hover:text-bronze">{o.label}</Link>: both named on {w.label}{w.year ? ` (${w.year})` : ""}<Src href={w.people.find((x) => x.id === o.id)!.source} /></li>)}
          </ul>
        </section>
      )}

      <NextSteps items={[
        ...topics.map((t) => ({ href: `/explore/thing?id=${t.id}`, icon: "network" as const, title: `Follow ${t.label.toLowerCase()}`, why: `${p.label} is part of it. See how it spread.` })),
        { href: `/explore/year?y=${peak}`, icon: "timeline" as const, title: `The world in ${peak}`, why: `What else was happening while ${p.label} worked.` },
        ...people.slice(0, 2).map((l) => { const o = personById(l.from === p.id ? l.to : l.from)!; return { href: `/explore/life?id=${o.id}`, icon: "person" as const, title: o.label, why: `Follow another life: ${l.label}.` }; }),
      ]} />
    </div>
  );
}

function LifeIndex() {
  const list = [...PEOPLE].sort((a, b) => (a.born?.year ?? 0) - (b.born?.year ?? 0));
  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6" data-testid="life-index">
      <ModeBar on="life" here={{ href: "/explore/life", label: "All lives", mode: "life" }} />
      <h1 className="mt-5 font-serif text-4xl">Follow a life</h1>
      <p className="mt-1 max-w-2xl text-ink-2">People of Vienna around 1900, each with their years, works, places and the people around them, all from Wikidata.</p>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {list.map((p) => (
          <li key={p.id}>
            <Link href={`/explore/life?id=${p.id}`} className="card card-link flex h-full flex-col overflow-hidden" data-testid="life-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {p.image ? <img src={p.image.url} alt="" loading="lazy" className="h-40 w-full object-cover object-top" /> : <span className="grid h-40 place-items-center bg-paper-3 text-bronze"><Icon name="person" size={44} /></span>}
              <span className="p-3"><span className="block font-serif text-lg leading-tight">{p.label}</span><span className="block text-xs text-ink-2">{[p.born?.year, p.died?.year].filter((x) => x != null).join("–")}{p.description ? ` · ${p.description}` : ""}</span></span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-ink-2">Portraits from Wikimedia Commons; the credit is on each person&rsquo;s page.</p>
    </div>
  );
}
