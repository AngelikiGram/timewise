"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { recordSurprise, recordThing } from "@/lib/explorer";
import { decades, peopleOf, personById, type Topic, TOPIC_NOUN, TOPIC_YEAR, TOPICS, topicById, wd } from "@/lib/explore";
import { FEATURED_THINGS, pick } from "@/lib/featured";
import { loadThing, searchEntities } from "@/lib/live";
import { prefetch } from "@/lib/cache";
import { enrich, type Enrichment } from "@/lib/wikidata";
import { Icon } from "../icons";
import { ExploreMap, type MapItem } from "./ExploreMap";
import { BadgeToast } from "./Gamify";
import { LiveSearch } from "./LiveSearch";
import { MoreSources } from "./MoreSources";
import { Working } from "./Working";
import { ModeBar, NextSteps, SaveInterest } from "./shared";

/**
 * Follow a thing: where and when it appears, decade by decade. Three are prebuilt; anything else on Wikidata
 * (a style, a kind of building, a movement, a field or an occupation) is looked up now: ?q=<QID>, or ?find=<words>.
 */
export function ThingView() {
  const sp = useSearchParams();
  const q = sp.get("q"), find = sp.get("find");
  if (q && /^Q\d+$/.test(q)) return TOPICS.some((t) => t.qid === q) ? <Thing t={TOPICS.find((t) => t.qid === q)!} key={q} /> : <LiveThing qid={q} key={q} />;
  if (find) return <FindThing words={find} key={find} />;
  const t = topicById(sp.get("id") ?? TOPICS[0].id) ?? TOPICS[0];
  return <Thing t={t} key={t.id} />;
}

function LiveThing({ qid }: { qid: string }) {
  const [t, setT] = useState<Topic | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [preview, setPreview] = useState<Enrichment | null>(null);
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    const ac = new AbortController();
    // The summary and picture arrive in under a second: something to read while the map is gathered.
    enrich(qid).then((e) => { if (!ac.signal.aborted) setPreview(e); }, () => {});
    searchEntities(qid, ac.signal, 1).then((h) => setName(h[0]?.label ?? null), () => {});
    // A quick first answer (direct members) appears in seconds; the full answer replaces it when it arrives.
    loadThing(qid, ac.signal, (partial) => setT((cur) => cur ?? partial)).then(setT, (e: Error) => { if (e.name !== "AbortError") setErr(e.message); });
    return () => ac.abort();
  }, [qid]);
  if (err && !t) return <Waiting><p className="rounded-xl border border-line bg-paper-2 p-4 text-ink-2" role="alert">{err}</p></Waiting>;
  if (!t) return <Waiting><Working title={name ?? "Following it"} preview={preview} steps={[
    { label: "Reading what Wikidata says about it", state: name ? "done" : "doing" },
    { label: "Finding where and when it appears", state: name ? "doing" : "todo", detail: "the first few hundred show as soon as they arrive" },
    { label: "Putting them on the map and the timeline", state: "todo" },
  ]} /></Waiting>;
  if (!t.items.length) return <Waiting><p className="rounded-xl border border-line bg-paper-2 p-4 text-ink-2">Wikidata has nothing for <strong>{t.label}</strong> with both a place and a year. Try a style, a kind of building, a movement or an occupation.</p></Waiting>;
  return <Thing t={t} live />;
}

/** Words from the featured list, matched to the best Wikidata item, then opened by its id. */
function FindThing({ words }: { words: string }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    const ac = new AbortController();
    searchEntities(words, ac.signal, 1).then((h) => { if (h[0]) router.replace(`/explore/thing?q=${h[0].id}`); else setErr(`Nothing on Wikidata matches “${words}”.`); }, (e: Error) => { if (e.name !== "AbortError") setErr(e.message); });
    return () => ac.abort();
  }, [words, router]);
  return <Waiting>{err ? <p className="text-ink-2" role="alert">{err}</p> : <p className="text-ink-2" role="status">Finding “{words}” on Wikidata…</p>}</Waiting>;
}

const Waiting = ({ children }: { children: React.ReactNode }) => (
  <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6"><ModeBar on="thing" /><div className="mt-5"><ThingFinder /></div><div className="mt-6">{children}</div></div>
);

/** Search for any thing, take a surprise, or pick a suggestion. */
function ThingFinder() {
  const router = useRouter();
  const local = useMemo(() => [
    ...TOPICS.map((t) => ({ id: t.qid, label: t.label, sub: `Prebuilt · ${t.items.length} ${TOPIC_NOUN[t.kind][1]}`, href: `/explore/thing?id=${t.id}` })),
    ...FEATURED_THINGS.map((f) => ({ id: `f-${f.search}`, label: f.search[0].toUpperCase() + f.search.slice(1), sub: f.hint, href: `/explore/thing?find=${encodeURIComponent(f.search)}` })),
  ], []);
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1 sm:max-w-xl"><LiveSearch label="Find a thing to follow" placeholder="Follow anything: lighthouses, Baroque, Impressionism, astronomers…" local={local} live={(s, sig) => searchEntities(s, sig)} hrefFor={(h) => `/explore/thing?q=${h.id}`} prefetch={(h) => prefetch(() => loadThing(h.id))} testId="thing-search" /></div>
      <button type="button" className="btn btn-primary" onClick={() => { recordSurprise(); router.push(`/explore/thing?find=${encodeURIComponent(pick(FEATURED_THINGS).search)}`); }} data-testid="thing-surprise"><span aria-hidden>🎲</span>Surprise me</button>
    </div>
  );
}

function Thing({ t, live = false }: { t: Topic; live?: boolean }) {
  const all = t.items;
  useEffect(() => { recordThing(live ? t.qid : t.id, t.label); }, [t.id, t.qid, t.label, live]);
  const [min, max] = [all[0]?.year ?? 1800, all[all.length - 1]?.year ?? 2000];
  const bars = useMemo(() => decades(all.map((x) => x.year)), [all]);
  const [range, setRange] = useState<[number, number] | null>(null);
  const [lo, hi] = range ?? [min, max];
  const shown = all.filter((x) => x.year >= lo && x.year <= hi);
  const top = Math.max(1, ...bars.map((b) => b[1]));
  const places = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of shown) { const k = x.place ?? x.country; if (k) m.set(k, (m.get(k) ?? 0) + 1); }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [shown]);
  const people = live ? [] : peopleOf(t);
  const [one, many] = TOPIC_NOUN[t.kind];
  const peak = bars.slice().sort((a, b) => b[1] - a[1])[0];
  const first = all[0];
  const [focus, setFocus] = useState<string | null>(null);
  const lifeLink = (id: string) => (personById(id) ? `/explore/life?id=${id}` : `/explore/life?q=${id}`);
  const mapItems: MapItem[] = shown.filter((x) => x.point).map((x) => ({
    id: x.id, label: x.label, lng: x.point![0], lat: x.point![1], layer: t.id, year: x.year,
    sub: [x.year, x.place].filter(Boolean).join(" · "),
    links: [{ href: `/explore/year?y=${x.year}`, label: `Explore ${x.year}` }, ...(t.kind === "field" ? [{ href: lifeLink(x.id), label: "Follow this life" }] : []), ...(x.people ?? []).map((id) => ({ href: lifeLink(id), label: personById(id)?.label ?? "A life" })), { href: x.source, label: "Source", external: true }],
  }));
  const key = live ? t.qid : t.id;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6" data-testid="thing">
      <BadgeToast />
      <ModeBar on="thing" here={{ href: live ? `/explore/thing?q=${t.qid}` : `/explore/thing?id=${t.id}`, label: t.label, mode: "thing" }} context={{ ...(peak ? { year: { href: `/explore/year?y=${peak[0] + 5}`, label: String(peak[0] + 5) } } : {}), ...(people[0] ? { life: { href: `/explore/life?id=${people[0].id}`, label: people[0].label } } : {}) }} />
      <div className="mt-5"><ThingFinder /></div>
      <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Follow a thing{live && <span className="ml-2 rounded-full bg-navy/10 px-2 py-0.5 text-[10px] normal-case tracking-normal text-navy [[data-theme=dark]_&]:text-ink">Looked up live on Wikidata</span>}</p>
          <h1 className="mt-1 font-serif text-4xl leading-tight">{t.label[0].toUpperCase() + t.label.slice(1)}</h1>
          {t.description && <p className="mt-1 text-lg text-ink-2">{t.description} <span className="text-xs">(Wikidata&rsquo;s description)</span></p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {TOPICS.filter((x) => x.id !== t.id).map((x) => <Link key={x.id} href={`/explore/thing?id=${x.id}`} className="chip">{x.label}</Link>)}
          {FEATURED_THINGS.slice(0, 5).map((f) => <Link key={f.search} href={`/explore/thing?find=${encodeURIComponent(f.search)}`} className="chip">{f.search[0].toUpperCase() + f.search.slice(1)}</Link>)}
        </div>
      </div>
      <p className="mt-3 max-w-3xl text-sm text-ink-2">
        {all.length} {many} on Wikidata with a place and a year {TOPIC_YEAR[t.kind]}, from {first ? `${first.label} (${first.year})` : "—"} on. These are the documented ones, not all there were: the record grows where people have written it down.{live && all.length >= 2900 ? " Wikidata has more; this shows the first 3,000 it returned." : ""}
      </p>
      {t.partial && <p className="mt-3 flex items-center gap-2 rounded-xl bg-bronze-soft/40 px-3 py-2 text-sm" role="status" data-testid="thing-partial">{t.partial === "loading" && <span className="tw-spin inline-block h-3 w-3 rounded-full border-2 border-bronze border-t-transparent" />}{t.partial === "loading" ? <>Showing the first {all.length} found. Wikidata is still gathering the rest; they appear here when it&rsquo;s done.</> : <>Wikidata took too long to list every one, so these are the first {all.length} it returned.</>}<style>{".tw-spin{animation:tw-spin 1s linear infinite}@keyframes tw-spin{to{transform:rotate(360deg)}}@media (prefers-reduced-motion:reduce){.tw-spin{animation:none}}"}</style></p>}
      <div className="mt-3 flex flex-wrap gap-2"><SaveInterest kind="topic" id={key} label={t.label} /><a href={wd(t.qid)} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">Wikidata ↗</a></div>

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
          <div className="mt-3"><ExploreMap items={mapItems} layers={[{ id: t.id, label: `${t.label}: ${many}`, color: "#8a5a1c" }]} colorByYear label={`${shown.length} ${many} on a map`} focusId={focus} height={460} /></div>
          {places.length > 0 && <p className="mt-2 text-sm text-ink-2">Most often in: {places.map(([pl, n]) => `${pl} (${n})`).join(", ")}.</p>}
        </section>
        <section aria-labelledby="spread-list">
          <h2 id="spread-list" className="font-serif text-2xl">{shown.length} {shown.length === 1 ? one : many}</h2>
          <ul className="mt-3 max-h-[26rem] divide-y divide-line overflow-y-auto rounded-lg border border-line bg-paper-2" data-testid="thing-items">
            {shown.slice(0, 200).map((x) => (
              <li key={x.id} className="flex items-baseline gap-3 px-3 py-2 text-sm">
                <Link href={`/explore/year?y=${x.year}`} className="w-12 shrink-0 tabular-nums text-bronze hover:underline" title={`Explore ${x.year}`}>{x.year}</Link>
                <span className="min-w-0 flex-1"><button type="button" onClick={() => setFocus(x.id)} className="text-left hover:text-bronze" title="Show on the map">{x.label}</button>{x.place && <span className="text-ink-2"> · {x.place}</span>}{t.kind === "field" && <Link href={lifeLink(x.id)} className="ml-1 text-xs text-bronze hover:underline">life →</Link>}</span>
                <a href={x.source} target="_blank" rel="noopener noreferrer" className="shrink-0 text-[11px] text-bronze hover:underline">source</a>
              </li>
            ))}
          </ul>
          {shown.length > 200 && <p className="mt-1 text-xs text-ink-2">The first 200 by year; choose a decade to see the rest.</p>}
        </section>
      </div>

      <NextSteps items={[
        ...people.slice(0, 3).map((p) => ({ href: `/explore/life?id=${p.id}`, icon: "person" as const, title: p.label, why: `A life tied to ${t.label.toLowerCase()} by Wikidata.` })),
        ...(t.kind === "field" ? shown.slice(0, 2).map((x) => ({ href: lifeLink(x.id), icon: "person" as const, title: x.label, why: `Born ${x.year}${x.place ? ` in ${x.place}` : ""}. Follow the life.` })) : []),
        ...(peak ? [{ href: `/explore/year?y=${peak[0] + 5}`, icon: "timeline" as const, title: `The world in ${peak[0] + 5}`, why: `In the busiest decade for ${t.label.toLowerCase()}: what else was happening.` }] : []),
        ...TOPICS.filter((x) => x.id !== t.id).slice(0, 1).map((x) => ({ href: `/explore/thing?id=${x.id}`, icon: "network" as const, title: `Follow ${x.label.toLowerCase()}`, why: "Another thing to follow." })),
      ]} />
      <MoreSources query={t.label} label={t.label.toLowerCase()} />
      <p className="mt-6 flex items-center gap-1.5 text-xs text-ink-2"><Icon name="source" size={14} />Each item links to the Wikidata statement that ties it to {t.label.toLowerCase()}.{live ? " Made just now from Wikidata (CC0)." : ""}</p>
    </div>
  );
}
