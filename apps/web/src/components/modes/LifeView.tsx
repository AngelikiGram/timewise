"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatYear } from "@/lib/dates";
import { recordLife, recordSurprise } from "@/lib/explorer";
import { addCards, lifeCards } from "@/lib/memory";
import { linksOf, PEOPLE, type Person, personById, sharedWorks, topicsOf, wd, type Work, worksOf } from "@/lib/explore";
import { ERA_LABEL, FEATURED_PEOPLE, findHref, pick, type Era } from "@/lib/featured";
import { loadLife, randomPerson, resolvePerson, searchPeople, type LifeData, type Moment, type Related } from "@/lib/live";
import { Icon } from "../icons";
import { ExploreMap, type MapItem } from "./ExploreMap";
import { BadgeToast } from "./Gamify";
import { KIND, LifeTime } from "./LifeTime";
import { LiveSearch } from "./LiveSearch";
import { MoreSources } from "./MoreSources";
import { Working } from "./Working";
import { prefetch } from "@/lib/cache";
import { enrich, type Enrichment } from "@/lib/wikidata";
import { artistOf, ModeBar, NextSteps, Pictured, SaveInterest, Src } from "./shared";

/**
 * Follow a life: a person's years, works, places and the people around them. People in the prebuilt
 * collection open at once; anyone else on Wikidata is looked up now, by id (?q=) or by name and birth years (?find=).
 */
export function LifeView() {
  const sp = useSearchParams();
  const qid = sp.get("id") ?? sp.get("q");
  const find = sp.get("find");
  if (qid && personById(qid)) return <Premade p={personById(qid)!} key={qid} />;
  if (qid && /^Q\d+$/.test(qid)) return <LiveLife qid={qid} matched={sp.get("matched")} key={qid} />;
  if (find) return <Finder name={find} from={Number(sp.get("from") ?? -9999)} to={Number(sp.get("to") ?? 9999)} key={find} />;
  return <LifeIndex />;
}

// ------------------------------------------------------------------------------------------ Loading

/** The prebuilt life, shown at once, with dated moments added from Wikidata when they arrive. */
function Premade({ p }: { p: Person }) {
  const base = useMemo<LifeData>(() => {
    const related: Related[] = [
      ...linksOf(p.id).map((l) => { const o = personById(l.from === p.id ? l.to : l.from)!; return { id: o.id, label: o.label, relation: l.label, sentence: l.from === p.id ? `${p.label} ${l.label} ${o.label}` : `${o.label} ${l.label} ${p.label}`, born: o.born?.year, died: o.died?.year, source: l.source, image: o.image }; }),
      ...sharedWorks(p.id).map(({ person: o, work: w }) => ({ id: o.id, label: o.label, relation: "worked alongside", sentence: `Both named on ${w.label}${w.year ? ` (${w.year})` : ""}`, born: o.born?.year, died: o.died?.year, source: w.people.find((x) => x.id === o.id)!.source, image: o.image })),
    ];
    return { person: p, works: worksOf(p.id), related: related.filter((r, i, all) => all.findIndex((x) => x.id === r.id) === i), moments: [], live: false };
  }, [p]);
  const [extra, setExtra] = useState<LifeData | null>(null);
  useEffect(() => { const ac = new AbortController(); loadLife(p.id, ac.signal).then(setExtra, () => {}); return () => ac.abort(); }, [p.id]);
  const data = useMemo<LifeData>(() => !extra ? base : {
    ...base,
    moments: extra.moments,
    related: [...base.related, ...extra.related.filter((r) => !base.related.some((x) => x.id === r.id))],
  }, [base, extra]);
  return <Life data={data} />;
}

function LiveLife({ qid, matched }: { qid: string; matched: string | null }) {
  const [data, setData] = useState<LifeData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [preview, setPreview] = useState<Enrichment | null>(null);
  useEffect(() => {
    const ac = new AbortController();
    enrich(qid).then((e) => { if (!ac.signal.aborted) setPreview(e); }, () => {});
    loadLife(qid, ac.signal).then(setData, (e: Error) => { if (e.name !== "AbortError") setErr(e.message); });
    return () => ac.abort();
  }, [qid]);
  if (err) return <Shell><p className="mt-6 rounded-xl border border-line bg-paper-2 p-4 text-ink-2" role="alert">{err} <Link href="/explore/life" className="link">Back to all lives</Link></p></Shell>;
  if (!data) return <Shell><div className="mt-6"><Working title={matched ?? preview?.summary?.title ?? "Following a life"} preview={preview} steps={[
    { label: "Reading the person's record", state: preview ? "done" : "doing" },
    { label: "Works, homes, studies, offices and awards, with their years", state: preview ? "doing" : "todo" },
    { label: "The people around them", state: preview ? "doing" : "todo" },
  ]} /></div></Shell>;
  return <Life data={data} matched={matched} />;
}

/** A name from the featured list, matched on Wikidata, then opened by its id. */
function Finder({ name, from, to }: { name: string; from: number; to: number }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    const ac = new AbortController();
    resolvePerson(name, from, to, ac.signal).then((r) => {
      if (r) router.replace(`/explore/life?q=${r.id}&matched=${encodeURIComponent(name)}`);
      else setErr(`Wikidata has no person called “${name}” born in those years.`);
    }, (e: Error) => { if (e.name !== "AbortError") setErr(e.message); });
    return () => ac.abort();
  }, [name, from, to, router]);
  return <Shell>{err ? <p className="mt-6 rounded-xl border border-line bg-paper-2 p-4 text-ink-2" role="alert">{err} <Link href="/explore/life" className="link">Back to all lives</Link></p> : <div className="mt-6"><Working title={name} steps={[{ label: `Finding ${name} on Wikidata, by name and birth years`, state: "doing" }, { label: "Reading the life", state: "todo" }]} /></div>}</Shell>;
}

const Shell = ({ children }: { children: React.ReactNode }) => (
  <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6"><ModeBar on="life" />{children}</div>
);

// ------------------------------------------------------------------------------------------ The page

const lifeHref = (id: string) => (personById(id) ? `/explore/life?id=${id}` : `/explore/life?q=${id}`);

function Life({ data, matched }: { data: LifeData; matched?: string | null }) {
  const { person: p, works, related, live } = data;
  const b = p.born?.year ?? null, d = p.died?.year ?? null;
  useEffect(() => { recordLife(p.id, p.label, b); }, [p.id, p.label, b]);
  const moments = useMemo<Moment[]>(() => {
    const out: Moment[] = [];
    if (b != null) out.push({ id: "born", year: b, label: `Born${p.born?.place ? ` in ${p.born.place}` : ""}`, kind: "life", point: p.born?.point, source: p.born!.source });
    for (const w of works) if (w.year != null) { const me = w.people.find((x) => x.id === p.id); out.push({ id: `w-${w.id}`, year: w.year, label: `${w.label}${me?.role ? ` (${me.role})` : ""}`, kind: "work", point: w.point, place: w.place, source: me?.source ?? wd(w.id), href: wd(w.id), external: true }); }
    out.push(...data.moments.filter((m) => !out.some((o) => o.id === m.id)));
    if (d != null) out.push({ id: "died", year: d, label: `Dies${p.died?.place ? ` in ${p.died.place}` : ""}`, kind: "life", point: p.died?.point, source: p.died!.source });
    return out.sort((x, y) => x.year - y.year || (x.kind === "life" ? -1 : 1));
  }, [p, works, data.moments, b, d]);
  const [win, setWin] = useState<[number, number, boolean]>([-Infinity, Infinity, true]);
  const onWindow = useCallback((lo: number, hi: number, all: boolean) => setWin([lo, hi, all]), []);
  const [focus, setFocus] = useState<string | null>(null);

  const allPoints: MapItem[] = useMemo(() => [
    ...moments.filter((m) => m.point && m.kind !== "work").map((m) => ({ id: m.id, label: m.label, lng: m.point![0], lat: m.point![1], layer: m.kind === "life" ? "life" : "more", year: m.year, sub: `${formatYear(m.year)}${m.place ? ` · ${m.place}` : ""}`, links: [{ href: `/explore/year?y=${m.year}`, label: `Explore ${formatYear(m.year)}` }, { href: m.source, label: "Source", external: true }] })),
    ...works.filter((w) => w.point).map((w) => {
      const me = w.people.find((x) => x.id === p.id);
      return { id: w.id, label: w.label, lng: w.point![0], lat: w.point![1], layer: "works", year: w.year, image: w.image, sub: [me?.role, w.year, w.place].filter(Boolean).join(" · "),
        links: [...(w.year != null ? [{ href: `/explore/year?y=${w.year}`, label: `Explore ${formatYear(w.year)}` }] : []), ...w.people.filter((x) => x.id !== p.id).map((x) => ({ href: lifeHref(x.id), label: personById(x.id)?.label ?? "Another life" })), ...(me ? [{ href: me.source, label: "Source", external: true }] : [])] };
    }),
  ], [moments, works, p.id]);
  // While scrubbing, the map shows the life so far: everything up to the end of the frame.
  const points = win[2] ? allPoints : allPoints.filter((x) => x.year == null || x.year <= win[1]);
  const topics = live ? [] : topicsOf(p.id);
  const things = [...(p.movements ?? []), ...(p.fields ?? [])].slice(0, 3);
  const peak = works.filter((w) => w.year != null)[Math.floor(works.filter((w) => w.year != null).length / 2)]?.year ?? (b != null ? b + 35 : 1900);
  const allChips = [...(p.occupations ?? []), ...(p.movements ?? []), ...(p.fields ?? []), ...(p.memberOf ?? [])];
  const [allTags, setAllTags] = useState(false);
  const chips = allTags ? allChips : allChips.slice(0, 6);
  const followable = new Set([...(p.movements ?? []), ...(p.fields ?? [])].map((x) => x.id));
  const otherLife = related[0];

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6" data-testid="life">
      <BadgeToast />
      <ModeBar on="life" here={{ href: live ? `/explore/life?q=${p.id}` : `/explore/life?id=${p.id}`, label: p.label, mode: "life" }}
        context={{ year: { href: `/explore/year?y=${peak}`, label: formatYear(peak) }, ...(topics[0] ? { thing: { href: `/explore/thing?id=${topics[0].id}`, label: topics[0].label } } : things[0] ? { thing: { href: `/explore/thing?q=${things[0].id}`, label: things[0].label } } : {}) }} />
      <div className="mt-5 grid gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
        {p.image ? <Pictured image={p.image} alt={`Portrait of ${p.label}`} /> : <span className="grid h-56 place-items-center rounded-lg bg-paper-3 text-bronze"><Icon name="person" size={64} /></span>}
        <div>
          <p className="eyebrow">Follow a life{live && <span className="ml-2 rounded-full bg-navy/10 px-2 py-0.5 text-[10px] normal-case tracking-normal text-navy [[data-theme=dark]_&]:text-ink" data-testid="live-label">Looked up live on Wikidata</span>}</p>
          <h1 className="mt-1 font-serif text-4xl leading-tight">{p.label}</h1>
          {p.description && <p className="mt-1 text-lg text-ink-2">{p.description} <span className="text-xs">(Wikidata&rsquo;s description)</span></p>}
          {matched && <p className="mt-1 text-xs text-ink-2">Matched “{matched}” on Wikidata: the person of that name born in the expected years with the most Wikipedia articles. <a className="link" href={wd(p.id)} target="_blank" rel="noopener noreferrer">Check it</a>.</p>}
          <dl className="mt-3 grid gap-1 text-sm">
            {b != null && <div><dt className="inline font-semibold">Born </dt><dd className="inline">{p.born?.date ? new Date(p.born.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : formatYear(b)}{p.born?.place ? `, ${p.born.place}` : ""}<Src href={p.born!.source} /></dd></div>}
            {d != null && <div><dt className="inline font-semibold">Died </dt><dd className="inline">{p.died?.date ? new Date(p.died.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : formatYear(d)}{p.died?.place ? `, ${p.died.place}` : ""}{b != null && <span className="text-ink-2">, aged {d - b}</span>}<Src href={p.died!.source} /></dd></div>}
          </dl>
          <ul className="mt-3 flex flex-wrap gap-1.5 text-xs">
            {chips.map((x) => <li key={x.id}>{followable.has(x.id) && live ? <Link href={`/explore/thing?q=${x.id}`} className="chip !min-h-7 !text-xs" title={`Follow ${x.label} across the map`}><Icon name="network" size={12} />{x.label}</Link> : <a href={x.source} target="_blank" rel="noopener noreferrer" className="chip !min-h-7 !text-xs">{x.label}</a>}</li>)}
          {allChips.length > 6 && <li><button type="button" className="chip !min-h-7 !text-xs" onClick={() => setAllTags(!allTags)} aria-expanded={allTags}>{allTags ? "Fewer" : `${allChips.length - 6} more`}</button></li>}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <SaveInterest kind="person" id={p.id} label={p.label} />
            <a href={wd(p.id)} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">Wikidata ↗</a>
            <Link href="/explore/life" className="btn btn-ghost btn-sm"><Icon name="search" size={15} />Another life</Link>
          </div>
        </div>
      </div>

      <LifeTime personId={p.id} name={p.label} born={b} died={d} moments={moments} related={related} onWindow={onWindow}
        onWhole={() => addCards(lifeCards({ id: p.id, label: p.label, born: b }, moments.filter((m) => m.kind !== "life"), { kind: "life", title: p.label, href: live ? `/explore/life?q=${p.id}` : `/explore/life?id=${p.id}` }))} />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {allPoints.length > 0 && (
          <section aria-labelledby="life-places">
            <h2 id="life-places" className="font-serif text-2xl">Where{!win[2] && Number.isFinite(win[1]) ? <span className="text-base text-ink-2"> · up to {formatYear(win[1])}</span> : null}</h2>
            <div className="mt-3"><ExploreMap items={points} layers={[{ id: "life", label: "Birth and death", color: KIND.life.color }, { id: "works", label: "Works", color: KIND.work.color }, { id: "more", label: "Homes, studies, offices", color: KIND.home.color }]} label={`Places in the life of ${p.label}`} focusId={focus} /></div>
          </section>
        )}
        <section aria-labelledby="life-works">
          <h2 id="life-works" className="font-serif text-2xl">Works</h2>
          {works.length ? <WorkList works={works} p={p} onMap={(id) => setFocus(id)} /> : <p className="mt-2 text-sm text-ink-2">Wikidata names no well-documented works for this person.</p>}
        </section>
      </div>

      {related.length > 0 && <People p={p} related={related} />}

      <NextSteps items={[
        ...topics.map((t) => ({ href: `/explore/thing?id=${t.id}`, icon: "network" as const, title: `Follow ${t.label.toLowerCase()}`, why: `${p.label} is part of it. See how it spread.` })),
        ...(topics.length ? [] : things.map((t) => ({ href: `/explore/thing?q=${t.id}`, icon: "network" as const, title: `Follow ${t.label}`, why: `${p.label} is part of it. See where and when it appears.` }))),
        { href: `/explore/year?y=${peak}`, icon: "timeline" as const, title: `The world in ${formatYear(peak)}`, why: `What else was happening while ${p.label} worked.` },
        ...(otherLife ? [{ href: lifeHref(otherLife.id), icon: "person" as const, title: otherLife.label, why: `Follow another life: ${otherLife.sentence ?? otherLife.relation}.` }] : []),
      ]} />
      <MoreSources query={p.label} label={p.label} />
      {live && <p className="mt-6 flex items-center gap-1.5 text-xs text-ink-2"><Icon name="source" size={14} />Made just now from Wikidata (CC0). Each fact links to the statement it comes from; images link to their Commons page, where the licence is.</p>}
    </div>
  );
}

function WorkList({ works, p, onMap }: { works: Work[]; p: Person; onMap: (id: string) => void }) {
  return (
    <ul className="mt-3 grid max-h-[30rem] gap-2 overflow-y-auto pr-1" data-testid="life-works">
      {works.map((w) => {
        const me = w.people.find((x) => x.id === p.id);
        return (
          <li key={w.id} className="flex items-center gap-3 rounded-lg border border-line bg-paper-2 p-2">
            {w.image ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={w.image.url} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded object-cover" title={[artistOf(w.image.artist), w.image.license].filter(Boolean).join(" · ")} /> : <span className="grid h-12 w-12 shrink-0 place-items-center rounded bg-paper-3 text-bronze"><Icon name="city" size={20} /></span>}
            <span className="min-w-0 flex-1 text-sm">
              <a href={wd(w.id)} target="_blank" rel="noopener noreferrer" className="font-medium hover:text-bronze">{w.label}</a>{w.point && <button type="button" onClick={() => onMap(w.id)} className="ml-2 text-xs text-bronze hover:underline">on the map</button>}
              <span className="block text-xs text-ink-2">{me?.role}{w.year != null && <> · <Link className="link" href={`/explore/year?y=${w.year}`}>{formatYear(w.year)}</Link></>}{w.place ? ` · ${w.place}` : ""}{me && <Src href={me.source} />}</span>
              {w.image && <span className="block truncate text-[10px] text-ink-2">Image: {[artistOf(w.image.artist), w.image.license].filter(Boolean).join(", ") || "Wikimedia Commons"}{w.image.page && <> · <a className="hover:underline" href={w.image.page} target="_blank" rel="noopener noreferrer">Commons</a></>}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// ------------------------------------------------------------------------------------------ Index

function LifeIndex() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const list = [...PEOPLE].sort((a, b) => (a.born?.year ?? 0) - (b.born?.year ?? 0));
  const local = useMemo(() => [
    ...PEOPLE.map((p) => ({ id: p.id, label: p.label, sub: [p.born?.year, p.died?.year].filter((x) => x != null).join("–") + (p.description ? ` · ${p.description}` : ""), href: `/explore/life?id=${p.id}` })),
    ...FEATURED_PEOPLE.map((f) => ({ id: `f-${f.name}`, label: f.name, sub: `${ERA_LABEL[f.era]} · looked up on Wikidata`, href: findHref(f) })),
  ], []);
  const surprise = () => { recordSurprise(); router.push(findHref(pick(FEATURED_PEOPLE))); };
  const wildcard = async () => {
    setBusy(true); setErr(null);
    try { const h = await randomPerson(); recordSurprise(); if (h) router.push(`/explore/life?q=${h.id}`); else setErr("Wikidata didn't return anyone. Try again."); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const eras = Object.keys(ERA_LABEL) as Era[];

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6" data-testid="life-index">
      <BadgeToast />
      <ModeBar on="life" here={{ href: "/explore/life", label: "All lives", mode: "life" }} />
      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <h1 className="font-serif text-4xl">Follow a life</h1>
          <p className="mt-1 max-w-2xl text-ink-2">Anyone on Wikidata: their years, works, places and the people around them. Scrub through the life and see what happens at each point.</p>
          <div className="mt-4 max-w-xl"><LiveSearch label="Find a person" placeholder="Search anyone: Mozart, Hedy Lamarr, your town's mayor in 1900…" local={local} live={searchPeople} hrefFor={(h) => `/explore/life?q=${h.id}`} prefetch={(h) => prefetch(() => loadLife(h.id))} testId="life-search" /></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" onClick={surprise} data-testid="life-surprise">Surprise me</button>
          <button type="button" className="btn btn-secondary" onClick={wildcard} disabled={busy} title="A random person from all of Wikidata: anyone with a portrait, a birthplace and an occupation">{busy ? "Drawing…" : "Wildcard"}</button>
        </div>
      </div>
      {err && <p className="mt-2 text-sm text-oxblood" role="alert">{err}</p>}

      <section className="mt-8" aria-labelledby="ready">
        <h2 id="ready" className="font-serif text-2xl">Vienna around 1900</h2>
        <p className="text-sm text-ink-2">Prebuilt and checked, with portraits and licences.</p>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
        <p className="mt-2 text-xs text-ink-2">Portraits from Wikimedia Commons; the credit is on each person&rsquo;s page.</p>
      </section>

      <section className="mt-10" aria-labelledby="more-lives">
        <h2 id="more-lives" className="font-serif text-2xl">{FEATURED_PEOPLE.length} more lives across history</h2>
        <p className="text-sm text-ink-2">Each is looked up on Wikidata when you open it: matched by name and birth years, and the page says what was matched.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3" data-testid="featured-lives">
          {eras.map((era) => (
            <div key={era} className="card p-4">
              <h3 className="text-xs font-semibold text-bronze">{ERA_LABEL[era]}</h3>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {FEATURED_PEOPLE.filter((f) => f.era === era).map((f) => <li key={f.name}><Link href={findHref(f)} className="chip !min-h-7 !text-xs">{f.name}</Link></li>)}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// Relations grouped by what they are, so a long list reads as family, teachers and students, and the rest.
const GROUP_OF = (r: Related) =>
  /married|partner|child|parent|sibling|relative/.test(r.relation) ? "Family"
  : /student|teacher|supervisor|doctoral/.test(r.relation) ? "Teachers and students"
  : /influenced/.test(r.relation) ? "Influences" : "Worked with or linked to";
const SHORT = (r: Related) => r.sentence ?? r.relation.replace(/^was (the |a |an )?/, "").replace(/ of$/, "").replace(/^(married to|partner of)$/, "spouse or partner");

function People({ p, related }: { p: Person; related: Related[] }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const groups = ["Family", "Teachers and students", "Influences", "Worked with or linked to"].map((g) => ({ g, list: related.filter((r) => GROUP_OF(r) === g) })).filter((x) => x.list.length);
  return (
    <section className="mt-8" aria-labelledby="life-people">
      <h2 id="life-people" className="font-serif text-2xl">People around {p.label}</h2>
      <div className="mt-3 grid gap-6 md:grid-cols-2" data-testid="life-people">
        {groups.map(({ g, list }) => (
          <div key={g}>
            <h3 className="text-sm font-semibold text-ink-2">{g} <span className="font-normal">({list.length})</span></h3>
            <ul className="mt-2 grid gap-1.5">
              {(open[g] ? list : list.slice(0, 6)).map((r) => (
                <li key={r.id} className="flex items-center gap-3 text-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {r.image ? <img src={r.image.url} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover object-top" loading="lazy" /> : <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-paper-3 text-ink-2"><Icon name="person" size={16} /></span>}
                  <span className="min-w-0"><Link href={lifeHref(r.id)} className="font-semibold hover:text-bronze">{r.label}</Link>{r.born != null && <span className="text-xs text-ink-2"> {formatYear(r.born)}{r.died != null ? `–${formatYear(r.died)}` : ""}</span>}
                    <span className="block text-xs text-ink-2">{SHORT(r)}<Src href={r.source} /></span></span>
                </li>
              ))}
            </ul>
            {list.length > 6 && <button type="button" className="link mt-1 text-sm" onClick={() => setOpen({ ...open, [g]: !open[g] })}>{open[g] ? "Show fewer" : `Show all ${list.length}`}</button>}
          </div>
        ))}
      </div>
    </section>
  );
}
