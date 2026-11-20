"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { formatYear } from "@/lib/dates";
import { recordPlace, recordSurprise } from "@/lib/explorer";
import { personById, wd } from "@/lib/explore";
import { pick } from "@/lib/featured";
import { searchEntities } from "@/lib/live";
import { placeBasics, placeEvents, placeLandmarks, placePeople, type Landmark, type Native, type PlaceBasics, type PlaceEvent } from "@/lib/live-more";
import { enrich, type Enrichment } from "@/lib/wikidata";
import { Icon, type IconName } from "../icons";
import { ExploreMap, type MapItem } from "./ExploreMap";
import { BadgeToast, LevelBar } from "./Gamify";
import { LiveSearch } from "./LiveSearch";

export const PLACES = ["Vienna", "Salzburg", "Graz", "Athens", "Rome", "London", "Paris", "Prague", "Istanbul", "Venice", "Jerusalem", "Cairo", "Kyoto", "Beijing", "Delhi", "Samarkand", "Timbuktu", "Cusco", "Mexico City", "New York City", "Rio de Janeiro", "Saint Petersburg", "Kraków", "Lisbon"];
const century = (y: number) => (y < 0 ? -Math.ceil(-y / 100) : Math.floor(y / 100) + 1);
const centuryLabel = (c: number) => { const n = Math.abs(c), s = n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th"; return `${n}${s} century${c < 0 ? " BC" : ""}`; };
const lifeHref = (id: string) => (personById(id) ? `/explore/life?id=${id}` : `/explore/life?q=${id}`);

/** Explain this place: any city or town, through the centuries, from Wikidata now; and a short guide for a visit. */
export function PlaceView() {
  const sp = useSearchParams();
  const q = sp.get("q"), find = sp.get("find");
  if (q && /^Q\d+$/.test(q)) return <Place qid={q} key={q} />;
  if (find) return <FindPlace words={find} key={find} />;
  return <Frame><Intro /></Frame>;
}

function FindPlace({ words }: { words: string }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    const ac = new AbortController();
    searchEntities(words, ac.signal, 1).then((h) => { if (h[0]) router.replace(`/explore/place?q=${h[0].id}`); else setErr(`Nothing on Wikidata matches “${words}”.`); }, (e: Error) => { if (e.name !== "AbortError") setErr(e.message); });
    return () => ac.abort();
  }, [words, router]);
  return <Frame>{err ? <p role="alert" className="text-ink-2">{err}</p> : <p role="status" className="text-ink-2">Finding “{words}”…</p>}</Frame>;
}

function Frame({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6" data-testid="place">
      <BadgeToast />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1 sm:max-w-xl"><LiveSearch label="Find a place" placeholder="Any city, town or village: Vienna, Athens, your home town…" local={PLACES.map((p) => ({ id: p, label: p, href: `/explore/place?find=${encodeURIComponent(p)}` }))} live={(s, sig) => searchEntities(s, sig)} hrefFor={(h) => `/explore/place?q=${h.id}`} testId="place-search" /></div>
        <button type="button" className="btn btn-primary" onClick={() => { recordSurprise(); router.push(`/explore/place?find=${encodeURIComponent(pick(PLACES))}`); }}><span aria-hidden>🎲</span>Surprise me</button>
        <span className="sm:ml-auto"><LevelBar compact /></span>
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}

function Intro() {
  return (
    <div>
      <p className="eyebrow">Explain this place</p>
      <h1 className="mt-1 font-serif text-4xl">Any place, through the centuries</h1>
      <p className="mt-1 max-w-2xl text-ink-2">Search where you live, where you grew up, or where you&rsquo;re going. See how it grew: its landmarks as they were built, the events that happened there, the people born there, and its population, century by century. Planning a trip? Each place has a short guide for your visit.</p>
      <ul className="mt-5 flex flex-wrap gap-2">{PLACES.map((p) => <li key={p}><Link href={`/explore/place?find=${encodeURIComponent(p)}`} className="chip"><Icon name="place" size={14} />{p}</Link></li>)}</ul>
    </div>
  );
}

type Load<T> = T | null | "failed";
function useLoad<T>(qid: string, f: (q: string, s: AbortSignal) => Promise<T>): Load<T> {
  const [x, setX] = useState<Load<T>>(null);
  useEffect(() => { const ac = new AbortController(); setX(null); f(qid, ac.signal).then(setX, (e: Error) => { if (e.name !== "AbortError") setX("failed"); }); return () => ac.abort(); }, [qid]); // eslint-disable-line react-hooks/exhaustive-deps
  return x;
}
const ok = <T,>(x: Load<T>): T | null => (x && x !== "failed" ? x : null);

type Row = { year: number; label: string; kind: "founded" | "built" | "event" | "born"; href: string; external?: boolean; sub?: string };
const ROW: Record<Row["kind"], { icon: IconName; label: string; color: string }> = {
  founded: { icon: "city", label: "Founded", color: "#7a1f2b" }, built: { icon: "city", label: "Built", color: "#8a5a1c" },
  event: { icon: "event", label: "Event", color: "#2f4d7a" }, born: { icon: "person", label: "Born here", color: "#4b6b3a" },
};

function Place({ qid }: { qid: string }) {
  const more = useLoad<Enrichment>(qid, enrich);
  const basics = useLoad<PlaceBasics>(qid, placeBasics);
  const marks = useLoad<Landmark[]>(qid, placeLandmarks);
  const people = useLoad<Native[]>(qid, placePeople);
  const events = useLoad<PlaceEvent[]>(qid, placeEvents);
  const [title, setTitle] = useState<{ label: string; description?: string } | null>(null);
  const [visiting, setVisiting] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => {
    const ac = new AbortController();
    fetch(`https://www.wikidata.org/w/api.php?format=json&origin=*&action=wbgetentities&ids=${qid}&props=labels|descriptions&languages=en|de|fr|mul&languagefallback=1`, { signal: ac.signal })
      .then((r) => r.json()).then((d: { entities: Record<string, { labels?: Record<string, { value: string }>; descriptions?: Record<string, { value: string }> }> }) => { const e = d.entities[qid]; const label = e?.labels?.en?.value ?? Object.values(e?.labels ?? {})[0]?.value ?? qid; setTitle({ label, description: e?.descriptions?.en?.value }); recordPlace(qid, label); }, () => {});
    return () => ac.abort();
  }, [qid]);
  const b = ok(basics), L = ok(marks) ?? [], P = ok(people) ?? [], E = ok(events) ?? [];
  const name = title?.label ?? "This place";

  const rows = useMemo<Row[]>(() => [
    ...(b?.founded != null ? [{ year: b.founded, label: `${name} is founded or first recorded`, kind: "founded" as const, href: wd(qid) + "#P571", external: true }] : []),
    ...L.filter((l) => l.year != null).map((l) => ({ year: l.year!, label: l.label, kind: "built" as const, href: wd(l.id), external: true, sub: l.kind })),
    ...E.map((e) => ({ year: e.year, label: e.label, kind: "event" as const, href: `/stories/live?q=${e.id}`, sub: e.description })),
    ...P.filter((p) => p.born != null).map((p) => ({ year: p.born!, label: p.label, kind: "born" as const, href: lifeHref(p.id), sub: p.description })),
  ].sort((x, y) => x.year - y.year), [b, L, E, P, name, qid]);
  const centuries = useMemo(() => { const m = new Map<number, Row[]>(); for (const r of rows) m.set(century(r.year), [...(m.get(century(r.year)) ?? []), r]); return [...m.entries()].sort((x, y) => x[0] - y[0]); }, [rows]);
  const points: MapItem[] = L.filter((l) => l.point).map((l) => ({ id: l.id, label: l.label, lng: l.point![0], lat: l.point![1], layer: "landmarks", year: l.year, image: l.image, sub: [l.kind, l.year != null ? formatYear(l.year) : null].filter(Boolean).join(" · "), links: [{ href: wd(l.id), label: "Wikidata", external: true }, ...(l.year != null ? [{ href: `/explore/year?y=${l.year}`, label: `Explore ${formatYear(l.year)}` }] : [])] }));
  const loading = [basics, marks, people, events].some((x) => x === null);

  const visit = (
    <section className="rounded-2xl border-2 border-bronze/40 bg-paper p-5" aria-labelledby="visit" data-testid="place-visit">
      <h2 id="visit" className="flex items-center gap-2 font-serif text-2xl"><Icon name="compass" size={22} className="text-bronze" />Visiting {name}?</h2>
      <p className="text-sm text-ink-2">A short guide from the record: the best-documented landmarks, the stories to read before you go, and people from here. Ranked by how many Wikipedias describe them, not by a travel critic.</p>
      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <ol className="grid gap-2 sm:grid-cols-2">
          {L.slice(0, 8).map((l, n) => (
            <li key={l.id} className="flex gap-3 rounded-xl border border-line bg-paper-2 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {l.image ? <img src={l.image.url} alt="" loading="lazy" className="h-16 w-16 shrink-0 rounded-lg object-cover" /> : <span className="grid h-16 w-16 shrink-0 place-items-center rounded-lg bg-paper-3 font-serif text-xl text-bronze">{n + 1}</span>}
              <span className="min-w-0 text-sm"><a href={wd(l.id)} target="_blank" rel="noopener noreferrer" className="font-semibold hover:text-bronze">{l.label}</a><span className="block text-xs text-ink-2">{[l.kind, l.year != null ? `from ${formatYear(l.year)}` : null].filter(Boolean).join(" · ")}</span>{l.image?.page && <a href={l.image.page} target="_blank" rel="noopener noreferrer" className="text-[10px] text-ink-2 hover:underline">Image: Commons</a>}</span>
            </li>
          ))}
          {!L.length && <li className="text-sm text-ink-2">{marks === null ? "Finding landmarks…" : "Wikidata lists no landmarks located here."}</li>}
        </ol>
        <div className="grid content-start gap-4">
          <div><h3 className="text-xs font-semibold uppercase tracking-wider text-ink-2">Stories to read before you go</h3>
            <ul className="mt-2 grid gap-1">{E.slice(0, 5).map((e) => <li key={e.id}><Link href={`/stories/live?q=${e.id}`} className="text-sm hover:text-bronze"><span className="tabular-nums text-ink-2">{formatYear(e.year)}</span> · {e.label}</Link></li>)}{!E.length && <li className="text-sm text-ink-2">{events === null ? "Loading…" : "None recorded here."}</li>}</ul></div>
          <div><h3 className="text-xs font-semibold uppercase tracking-wider text-ink-2">People from {name}</h3>
            <ul className="mt-2 flex flex-wrap gap-1.5">{P.slice(0, 8).map((p) => <li key={p.id}><Link href={lifeHref(p.id)} className="chip !min-h-7 !text-xs">{p.label}</Link></li>)}</ul></div>
        </div>
      </div>
    </section>
  );

  return (
    <Frame>
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div>
          <p className="eyebrow">Explain this place <span className="ml-2 rounded-full bg-navy/10 px-2 py-0.5 text-[10px] normal-case tracking-normal text-navy [[data-theme=dark]_&]:text-ink">Looked up live on Wikidata</span></p>
          <h1 className="mt-1 font-serif text-4xl leading-tight">{name}</h1>
          {title?.description && <p className="mt-1 text-lg text-ink-2">{title.description}</p>}
          <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {b?.country && <div><dt className="text-xs uppercase tracking-wider text-ink-2">Country today</dt><dd className="font-medium">{b.country}</dd></div>}
            {b?.founded != null && <div><dt className="text-xs uppercase tracking-wider text-ink-2">Founded or first recorded</dt><dd className="font-medium">{formatYear(b.founded)}</dd></div>}
            {b && b.population.length > 0 && <div><dt className="text-xs uppercase tracking-wider text-ink-2">Population {b.population[b.population.length - 1].year}</dt><dd className="font-medium tabular-nums">{b.population[b.population.length - 1].n.toLocaleString("en")}</dd></div>}
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" aria-pressed={visiting} className={`btn btn-sm ${visiting ? "btn-primary" : "btn-secondary"}`} onClick={() => setVisiting(!visiting)} data-testid="place-visiting"><Icon name="compass" size={15} />{visiting ? "Showing the visit guide first" : "I'm visiting"}</button>
            <a href={wd(qid)} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">Wikidata ↗</a>
          </div>
          {more && more !== "failed" && more.summary && (
            <blockquote className="mt-4 rounded-xl border-l-4 border-bronze bg-paper-2 p-4 text-sm leading-relaxed">{more.summary.text}<footer className="mt-2 text-xs text-ink-2">From <a className="link" href={more.summary.url} target="_blank" rel="noopener noreferrer">Wikipedia: {more.summary.title}</a>, CC BY-SA 4.0.</footer></blockquote>
          )}
        </div>
        <div>
          {b?.image ? (
            <figure>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={b.image.url} alt={name} className="max-h-72 w-full rounded-xl object-cover" /><figcaption className="mt-1 text-[11px] text-ink-2"><a className="link" href={b.image.page} target="_blank" rel="noopener noreferrer">Image on Wikimedia Commons</a>, where its licence is</figcaption></figure>
          ) : basics === null ? <div className="skeleton h-72 rounded-xl" /> : null}
          {b && b.population.length > 2 && <Population data={b.population} />}
        </div>
      </div>

      {visiting && <div className="mt-6">{visit}</div>}

      <section className="mt-8" aria-labelledby="centuries">
        <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 id="centuries" className="font-serif text-2xl">Through the centuries</h2>{loading && <span className="text-sm text-ink-2" role="status">Still gathering records…</span>}</div>
        <p className="text-sm text-ink-2">What Wikidata records for {name}: when its landmarks were built, events that happened here, and people born here. Click a century to open it.</p>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">{(Object.keys(ROW) as Row["kind"][]).map((k) => <li key={k} className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: ROW[k].color }} />{ROW[k].label}</li>)}</ul>
        {centuries.length > 0 && (
          <div className="mt-3 flex h-24 items-end gap-1 rounded-xl border border-line bg-paper-2 p-2" data-testid="place-centuries" role="group" aria-label="Records per century">
            {centuries.map(([c, rs]) => {
              const max = Math.max(...centuries.map((x) => x[1].length));
              return (
                <button key={c} type="button" onClick={() => setOpen(open === c ? null : c)} aria-pressed={open === c} title={`${centuryLabel(c)}: ${rs.length} records`} className="flex min-w-[14px] flex-1 flex-col-reverse overflow-hidden rounded-t hover:opacity-80" style={{ height: `${Math.max(8, (rs.length / max) * 100)}%`, outline: open === c ? "2px solid var(--oxblood)" : undefined }}>
                  {(Object.keys(ROW) as Row["kind"][]).map((k) => { const n = rs.filter((r) => r.kind === k).length; return n ? <span key={k} style={{ height: `${(n / rs.length) * 100}%`, background: ROW[k].color }} /> : null; })}
                </button>
              );
            })}
          </div>
        )}
        {centuries.length > 0 && <div className="mt-1 flex justify-between text-xs text-ink-2"><span>{centuryLabel(centuries[0][0])}</span><span>{centuryLabel(centuries[centuries.length - 1][0])}</span></div>}
        <ol className="mt-4 grid gap-3">
          {centuries.filter(([c]) => open == null || c === open).map(([c, rs]) => (
            <li key={c} className="rounded-xl border border-line bg-paper-2 p-4">
              <h3 className="font-serif text-xl">{centuryLabel(c)} <span className="text-sm text-ink-2">· {rs.length} record{rs.length === 1 ? "" : "s"}</span></h3>
              <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {(open == null ? rs.slice(0, 8) : rs).map((r) => (
                  <li key={`${r.kind}${r.href}`} className="flex gap-2 text-sm">
                    <span className="w-12 shrink-0 text-right tabular-nums text-ink-2">{formatYear(r.year)}</span>
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: ROW[r.kind].color }} title={ROW[r.kind].label} />
                    <span className="min-w-0">{r.external ? <a href={r.href} target="_blank" rel="noopener noreferrer" className="hover:text-bronze">{r.label}</a> : <Link href={r.href} className="hover:text-bronze">{r.label}</Link>}{r.sub && <span className="block truncate text-xs text-ink-2">{r.sub}</span>}</span>
                  </li>
                ))}
              </ul>
              {open == null && rs.length > 8 && <button type="button" className="link mt-2 text-sm" onClick={() => setOpen(c)}>All {rs.length} →</button>}
            </li>
          ))}
          {!loading && !centuries.length && <li className="text-ink-2">Wikidata records nothing dated for this place yet.</li>}
        </ol>
      </section>

      {points.length > 0 && <section className="mt-8" aria-labelledby="place-map"><h2 id="place-map" className="font-serif text-2xl">Landmarks on the map</h2><div className="mt-3"><ExploreMap items={points} layers={[{ id: "landmarks", label: "Landmarks", color: "#8a5a1c" }]} colorByYear label={`Landmarks of ${name}`} height={420} /></div></section>}
      {!visiting && <div className="mt-8">{visit}</div>}
      <p className="mt-6 flex items-center gap-1.5 text-xs text-ink-2"><Icon name="source" size={14} />Made just now from Wikidata (CC0): items located in {name} (P131), events with it as location (P276), people born here (P19), population (P1082). Every item links to its record. Sports results are left out.</p>
    </Frame>
  );
}

/** Population over time, as Wikidata records it: a simple line with its first and last values. */
function Population({ data }: { data: { year: number; n: number }[] }) {
  const W = 400, H = 90;
  const x0 = data[0].year, x1 = data[data.length - 1].year, max = Math.max(...data.map((d) => d.n));
  const x = (y: number) => ((y - x0) / Math.max(1, x1 - x0)) * (W - 10) + 5, y = (n: number) => H - 8 - (n / max) * (H - 20);
  return (
    <figure className="mt-3 rounded-xl border border-line bg-paper-2 p-3" data-testid="place-population">
      <figcaption className="text-xs font-semibold uppercase tracking-wider text-ink-2">Population, {x0}–{x1}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 h-auto w-full" role="img" aria-label={`Population from ${data[0].n.toLocaleString("en")} in ${x0} to ${data[data.length - 1].n.toLocaleString("en")} in ${x1}`}>
        <path d={data.map((d, i) => `${i ? "L" : "M"}${x(d.year).toFixed(1)},${y(d.n).toFixed(1)}`).join("")} fill="none" stroke="var(--bronze)" strokeWidth={2} />
        {data.map((d) => <circle key={d.year} cx={x(d.year)} cy={y(d.n)} r={2.2} fill="var(--oxblood)"><title>{`${d.year}: ${d.n.toLocaleString("en")}`}</title></circle>)}
        <text x={4} y={H - 1} fontSize={10} fill="var(--ink-2)">{x0}</text><text x={W - 4} y={H - 1} fontSize={10} textAnchor="end" fill="var(--ink-2)">{x1}</text>
        <text x={4} y={10} fontSize={10} fill="var(--ink-2)">{max.toLocaleString("en")}</text>
      </svg>
    </figure>
  );
}
