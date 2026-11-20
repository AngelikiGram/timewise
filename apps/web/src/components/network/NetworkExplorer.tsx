"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { collection } from "@/lib/collection";
import { checkedLinks, contextualLinks } from "@/lib/connections";
import { formatYear } from "@/lib/dates";
import { createCollection, update } from "@/lib/progress";
import { fetchNodeFacts, fetchRecord, GROUPS, isQid, labelsFor, searchWikidata, type Group, type Link as RecordLink, type NodeFacts, type RecordData, type SearchResult } from "@/lib/record";
import { STORIES } from "@/lib/stories";
import { CONTINENT_LABELS, loadIndex, loadRegions, type IndexEvent } from "@/lib/world-index";
import { ConnectionCards, GROUP_ORDER, PER_GROUP } from "./ConnectionCards";
import { Icon } from "../icons";
import { LinkDetail, RecordCard } from "./RecordPanel";
import { MapView } from "./views";
import { TimeGraph } from "./TimeGraph";

type View = "network" | "cards" | "map";
const VIEWS: { id: View; label: string }[] = [
  { id: "network", label: "Time graph" },
  { id: "cards", label: "Cards" },
  { id: "map", label: "Map" },
];

function RecordSearch({ onPick, autoFocus = false }: { onPick: (id: string) => void; autoFocus?: boolean }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchResult[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "failed">("idle");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return; }
    const ac = new AbortController();
    const t = setTimeout(() => {
      setState("loading");
      searchWikidata(q.trim(), ac.signal).then((h) => { setHits(h); setState("idle"); }, (e) => { if (e.name !== "AbortError") setState("failed"); });
    }, 250);
    return () => { clearTimeout(t); ac.abort(); };
  }, [q]);
  const pick = (id: string) => { setOpen(false); setQ(""); onPick(id); };
  return (
    <div className="relative w-full">
      <form role="search" onSubmit={(e) => { e.preventDefault(); if (hits[active]) pick(hits[active].id); }} className="flex items-center rounded-lg border border-line bg-paper-2 py-1 pl-3 pr-1 focus-within:border-bronze">
        <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-ink-2"><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="m13 13 4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
        <input
          role="combobox"
          aria-expanded={open && hits.length > 0}
          aria-controls="record-results"
          aria-label="Search records: events, people, places, inventions and ideas"
          autoFocus={autoFocus}
          autoComplete="off"
          value={q}
          placeholder="Search an event, person, place, invention or idea"
          onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, hits.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            if (e.key === "Escape") setOpen(false);
          }}
          className="min-w-0 flex-1 bg-transparent px-2 py-1.5 outline-none placeholder:text-ink-2/80"
        />
        <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-xs text-ink-2" title="Searches all of Wikidata, live">Wikidata, live</span>
      </form>
      {open && q.trim().length >= 2 && (
        <ul id="record-results" role="listbox" data-testid="record-results" className="absolute inset-x-0 top-full z-40 mt-1 max-h-96 overflow-auto rounded-lg border border-line bg-paper-2 py-1 shadow-xl">
          {hits.map((h, i) => (
            <li key={h.id} role="option" aria-selected={i === active}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(h.id)} onMouseEnter={() => setActive(i)} className={`block w-full px-4 py-2 text-left ${i === active ? "bg-paper-3" : ""}`}>
                <span className="font-serif text-base">{h.label}</span>
                {h.description && <span className="block text-xs text-ink-2">{h.description}</span>}
              </button>
            </li>
          ))}
          {!hits.length && <li className="px-4 py-2 text-sm text-ink-2" role="status">{state === "loading" ? "Searching Wikidata…" : state === "failed" ? "Wikidata couldn't be reached. Check the connection and try again." : "No record matches. Try another spelling."}</li>}
        </ul>
      )}
    </div>
  );
}

function Start({ onPick }: { onPick: (id: string) => void }) {
  const [top, setTop] = useState<IndexEvent[]>([]);
  useEffect(() => {
    loadIndex().then((events) => {
      const best = new Map<string, IndexEvent>();
      for (const e of events) if (e.ct && (e.n ?? 1) < 5 && (!best.has(e.ct) || best.get(e.ct)!.l < e.l)) best.set(e.ct, e);
      setTop([...best.values()]);
    }, () => setTop([]));
  }, []);
  const places = collection.places.slice(0, 6);
  return (
    <div className="mx-auto max-w-4xl py-6" data-testid="network-start">
      <p className="eyebrow">Explore connections</p>
      <h1 className="mt-2 font-serif text-4xl leading-tight sm:text-5xl">Start anywhere, follow the links</h1>
      <p className="mt-3 max-w-2xl text-lg text-ink-2">
        Search any event, person, place, invention or idea in Wikidata, then branch from one record to the next. Every line says why two records are connected, and whether a statement documents it.
      </p>
      <div className="mt-6 max-w-2xl"><RecordSearch onPick={onPick} autoFocus /></div>
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <section>
          <h2 className="font-serif text-xl">Places in the checked collection</h2>
          <p className="mt-1 text-sm text-ink-2">Their links include TIMEWISE events with sourced claims.</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {places.map((p) => <li key={p.id}><button type="button" className="chip" onClick={() => onPick(p.wikidata)}>{p.label.en}</button></li>)}
          </ul>
        </section>
        <section>
          <h2 className="font-serif text-xl">The best-documented event per continent</h2>
          <p className="mt-1 text-sm text-ink-2">By Wikipedia language editions in the TIMEWISE index, not by importance.</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {top.map((e) => <li key={e.i}><button type="button" className="chip" onClick={() => onPick(e.i)}>{e.t} <span className="text-ink-2">· {CONTINENT_LABELS[e.ct!]}</span></button></li>)}
            {!top.length && <li className="text-sm text-ink-2">Loading the index…</li>}
          </ul>
        </section>
      </div>
      <section className="mt-8">
        <h2 className="font-serif text-xl">Guided paths</h2>
        <p className="mt-1 text-sm text-ink-2">Written routes through checked records, with a source for every claim.</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {STORIES.map((s) => (
            <li key={s.id}><Link href={s.href} className="card card-link block p-4"><span className="font-serif text-lg">{s.title}</span><span className="mt-1 block text-sm text-ink-2">{s.place} · {s.period} · {s.minutes} min</span></Link></li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/**
 * The network explorer: one record in the middle, its documented and contextual links around it, and a
 * path of everything opened so far, kept in the URL so it can be shared.
 */
export function NetworkExplorer() {
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("id");
  const view = (VIEWS.find((v) => v.id === params.get("view"))?.id ?? "network") as View;
  const path = useMemo(() => (params.get("path") ?? "").split(",").filter(isQid), [params]);

  const [record, setRecord] = useState<RecordData | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [retry, setRetry] = useState(0);
  const [extra, setExtra] = useState<RecordLink[]>([]);
  const [facts, setFacts] = useState<Record<string, NodeFacts>>({});
  const [factsState, setFactsState] = useState<"loading" | "ready" | "failed">("loading");
  const [selected, setSelected] = useState<string | undefined>();
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [off, setOff] = useState<Set<Group>>(new Set());
  const [contextual, setContextual] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [country, setCountry] = useState("");
  const [copied, setCopied] = useState("");
  const panel = useRef<HTMLDivElement>(null);

  const go = useCallback((next: Record<string, string | null>) => {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) if (v === null || v === "") p.delete(k); else p.set(k, v);
    router.push(`/connections?${p.toString()}`, { scroll: false });
  }, [params, router]);

  const open = useCallback((target: string) => {
    if (!isQid(target)) return;
    const at = path.indexOf(target);
    const trail = at >= 0 ? path.slice(0, at + 1) : [...(id && !path.includes(id) ? [...path, id] : path), target];
    go({ id: target, path: trail.slice(-12).join(",") });
  }, [go, id, path]);

  // The record itself.
  useEffect(() => {
    if (!isQid(id)) return;
    const ac = new AbortController();
    setStatus("loading");
    setSelected(undefined);
    setExtra([]);
    setFacts({});
    fetchRecord(id, ac.signal).then(
      (r) => { setRecord(r); setStatus("ready"); setLabels((l) => ({ ...l, [r.id]: r.label })); },
      (e) => { if (e.name !== "AbortError") setStatus("failed"); },
    );
    return () => ac.abort();
  }, [id, retry]);

  // Links TIMEWISE adds from its own data, then the year and place of every link.
  useEffect(() => {
    if (!record || record.id !== id) return;
    const ac = new AbortController();
    let added: RecordLink[] = checkedLinks(record.id);
    setExtra(added);
    Promise.all([loadIndex(), loadRegions()])
      .then(([events, regions]) => { added = [...added, ...contextualLinks(record, events, regions)]; if (!ac.signal.aborted) setExtra(added); })
      .catch(() => {})
      .finally(() => {
        if (ac.signal.aborted) return;
        setFactsState("loading");
        const ids = [...record.links, ...added].map((l) => l.target).filter(isQid);
        fetchNodeFacts([...new Set(ids)].slice(0, 120), ac.signal).then(
          (f) => { setFacts(f); setFactsState("ready"); },
          (e) => { if (e.name !== "AbortError") setFactsState("failed"); },
        );
      });
    return () => ac.abort();
  }, [record, id]);

  // Names for a shared path.
  useEffect(() => {
    const missing = path.filter((p) => !labels[p]);
    if (!missing.length) return;
    labelsFor(missing).then((l) => setLabels((old) => ({ ...old, ...Object.fromEntries(Object.entries(l).map(([k, v]) => [k, v.label])) })), () => {});
  }, [path, labels]);

  const all = useMemo(() => (record ? [...record.links, ...extra] : []), [record, extra]);
  const countries = useMemo(() => [...new Set(all.map((l) => facts[l.target]?.country).filter(Boolean) as string[])].sort(), [all, facts]);
  const yFrom = from.trim() ? Number(from) : undefined;
  const yTo = to.trim() ? Number(to) : undefined;
  const filtered = useMemo(() => all.filter((l) => {
    if (off.has(l.group)) return false;
    if (!l.documented && !contextual) return false;
    const f = facts[l.target];
    if ((yFrom !== undefined || yTo !== undefined) && (f?.year === undefined || (yFrom !== undefined && f.year < yFrom) || (yTo !== undefined && f.year > yTo))) return false;
    if (country && f?.country !== country) return false;
    return true;
  }), [all, off, contextual, facts, yFrom, yTo, country]);
  // How many of each group to show, the same in every view; the best documented (most Wikipedia editions) first.
  const [limits, setLimits] = useState<Partial<Record<Group, number>>>({});
  useEffect(() => setLimits({}), [id]);
  const limitOf = useCallback((g: Group) => limits[g] ?? PER_GROUP, [limits]);
  const setLimit = useCallback((g: Group, n: number) => setLimits((l) => ({ ...l, [g]: Math.max(1, n) })), []);
  const ranked = useMemo(() => [...filtered].sort((a, b) => (facts[b.target]?.links ?? 0) - (facts[a.target]?.links ?? 0) || a.label.localeCompare(b.label)), [filtered, facts]);
  const totals = useMemo(() => { const t: Partial<Record<Group, number>> = {}; for (const l of ranked) t[l.group] = (t[l.group] ?? 0) + 1; return t; }, [ranked]);
  const visible = useMemo(() => { const n: Partial<Record<Group, number>> = {}; return ranked.filter((l) => { n[l.group] = (n[l.group] ?? 0) + 1; return n[l.group]! <= limitOf(l.group); }); }, [ranked, limitOf]);
  const selectedLink = all.find((l) => l.target === selected);
  const filtering = off.size > 0 || !contextual || from || to || country;
  const sequenceNext = record?.links.find((l) => l.relation === "followed by" || l.relation === "replaced by");

  const select = (target: string) => {
    setSelected(target);
    if (window.matchMedia("(max-width: 1023px)").matches) panel.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const share = async (what: "path" | "record") => {
    const url = new URL(window.location.href);
    if (what === "record") url.searchParams.delete("path");
    try { await navigator.clipboard.writeText(url.toString()); setCopied(what); setTimeout(() => setCopied(""), 2500); }
    catch { window.prompt("Copy this link", url.toString()); }
  };
  const trail = id ? [...path.filter((p) => p !== id), id] : path;
  const savePath = () => {
    const name = window.prompt("Name this path", `Path from ${labels[trail[0]] ?? trail[0]}`);
    if (name === null) return;
    const now = new Date().toISOString();
    update((p) => ({ ...p, bookmarks: { ...Object.fromEntries(trail.map((t) => [t, { id: t, title: labels[t] ?? t, href: `/connections?id=${t}`, context: "From an exploration path", savedAt: now }])), ...p.bookmarks } }));
    createCollection(name, trail);
    setCopied("saved");
    setTimeout(() => setCopied(""), 2500);
  };

  if (!isQid(id)) {
    return <div className="px-4 sm:px-6"><Start onPick={(q) => go({ id: q, path: null })} /></div>;
  }

  return (
    <div className="mx-auto max-w-[1500px] px-4 pb-10 pt-4 sm:px-6" data-testid="network-explorer">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="lg:max-w-xl lg:flex-1"><RecordSearch onPick={(q) => go({ id: q, path: null })} /></div>
        <div role="tablist" aria-label="View" className="flex shrink-0 rounded-lg border border-line bg-paper-2 p-1">
          {VIEWS.map((v) => (
            <button key={v.id} role="tab" aria-selected={view === v.id} onClick={() => go({ view: v.id === "network" ? null : v.id })} className={`rounded-md px-3 py-1.5 text-sm font-medium ${view === v.id ? "bg-navy text-on-accent [[data-theme=dark]_&]:bg-bronze" : "text-ink-2 hover:text-ink"}`}>
              {v.label}
            </button>
          ))}
        </div>
      </div>


      {/* The path so far, with one step back and a way to start over. */}
      <nav className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-paper-2 px-3 py-2" aria-label="Your path" data-testid="network-path">
        <button type="button" className="btn btn-ghost btn-sm" disabled={trail.length < 2} onClick={() => open(trail[trail.length - 2])} aria-label="Back one step"><Icon name="back" size={16} /> Back</button>
        <button type="button" className="btn btn-ghost btn-sm" disabled={trail.length < 2} onClick={() => go({ id: trail[0], path: null })} aria-label="Start over from the first record"><Icon name="reset" size={16} /> Reset</button>
        <ol className="flex min-w-0 flex-1 flex-wrap items-center gap-1 text-sm">
          {trail.map((t, i) => (
            <li key={t} className="inline-flex min-w-0 items-center gap-1">
              {i > 0 && <Icon name="forward" size={14} className="shrink-0 text-ink-2" />}
              {t === id ? <span className="max-w-[16rem] truncate font-semibold" aria-current="step">{labels[t] ?? t}</span> : <button type="button" className="link max-w-[12rem] truncate" onClick={() => open(t)}>{labels[t] ?? t}</button>}
            </li>
          ))}
        </ol>
        <span className="flex flex-wrap gap-2">
          {trail.length > 1 && <button type="button" className="btn btn-secondary btn-sm" onClick={() => share("path")}>{copied === "path" ? "Link copied" : "Share path"}</button>}
          {trail.length > 1 && <button type="button" className="btn btn-secondary btn-sm" onClick={savePath}>{copied === "saved" ? "Saved to My Collection" : "Save path"}</button>}
        </span>
      </nav>

      {/* Filters: kind of link, period, country. */}
      <div className="relative -mx-4 mt-3 flex items-center gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&>*]:shrink-0" data-testid="network-filters">
        {GROUP_ORDER.filter((g) => all.some((l) => l.group === g)).map((g) => {
          const n = all.filter((l) => l.group === g).length;
          return (
            <button key={g} type="button" aria-pressed={!off.has(g)} onClick={() => setOff((s) => { const t = new Set(s); if (t.has(g)) t.delete(g); else t.add(g); return t; })} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors ${off.has(g) ? "border-line text-ink-2 line-through opacity-60" : "border-bronze/60 bg-paper-2 text-ink hover:border-bronze"}`}>
              <span aria-hidden className={`inline-block h-0 w-4 border-t-2 border-bronze ${GROUPS[g].documented ? "" : "border-dashed"}`} />
              {GROUPS[g].label} <span className="tabular-nums text-ink-2">{n}</span>
            </button>
          );
        })}
        <label className="ml-1 inline-flex items-center gap-1.5 text-sm text-ink-2">
          <input type="checkbox" checked={contextual} onChange={(e) => setContextual(e.target.checked)} className="accent-[var(--bronze)]" />
          Contextual links
        </label>
        <span className="inline-flex items-center gap-1 text-sm text-ink-2">
          <label htmlFor="nf-from" className="sr-only">From year</label>
          <input id="nf-from" inputMode="numeric" placeholder="From" value={from} onChange={(e) => setFrom(e.target.value.replace(/[^\d-]/g, ""))} className="field w-20 !py-1 text-sm" />
          –
          <label htmlFor="nf-to" className="sr-only">To year</label>
          <input id="nf-to" inputMode="numeric" placeholder="To" value={to} onChange={(e) => setTo(e.target.value.replace(/[^\d-]/g, ""))} className="field w-20 !py-1 text-sm" />
        </span>
        {countries.length > 0 && (
          <label className="text-sm text-ink-2">
            <span className="sr-only">Country</span>
            <select value={country} onChange={(e) => setCountry(e.target.value)} className="field !w-auto max-w-48 !py-1 text-sm">
              <option value="">Any country</option>
              {countries.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
        )}
        {filtering && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setOff(new Set()); setContextual(true); setFrom(""); setTo(""); setCountry(""); }}>Reset</button>}
      </div>

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
        <section className="card min-w-0 p-3 sm:p-4" aria-label="Connected records">
          {status === "loading" && (
            <div className="grid min-h-[420px] place-items-center text-ink-2" role="status">
              <div className="text-center"><div className="skeleton mx-auto h-28 w-28 rounded-full" /><p className="mt-3">Reading {labels[id] ?? id} and its links from Wikidata…</p></div>
            </div>
          )}
          {status === "failed" && (
            <div className="grid min-h-[420px] place-items-center p-6 text-center">
              <div>
                <p className="font-semibold">Wikidata couldn&rsquo;t be reached, or it has no record {id}.</p>
                <p className="mt-1 text-sm text-ink-2">The explorer reads records live, so it needs a connection.</p>
                <button type="button" className="btn btn-secondary mt-3" onClick={() => setRetry((r) => r + 1)}>Try again</button>
              </div>
            </div>
          )}
          {status === "ready" && record && (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
                <p className="text-sm text-ink-2" data-testid="network-count">
                  Showing {visible.length} of {filtered.length} connections{filtered.length < all.length ? ` (${all.length} before filters)` : ""} · best known first
                  {(from || to) && " · records without a date are hidden while a period is set"}
                </p>
                <p className="flex flex-wrap items-center gap-3 text-xs text-ink-2">
                  <span className="inline-flex items-center gap-1"><span aria-hidden className="inline-block w-5 border-t-2 border-navy" />documented</span>
                  <span className="inline-flex items-center gap-1"><span aria-hidden className="inline-block w-5 border-t-2 border-dashed border-bronze" />contextual</span>
                </p>
              </div>
              {view === "network" && <TimeGraph record={record} links={visible} totals={totals} limitOf={limitOf} setLimit={setLimit} facts={facts} selected={selected} onStep={(l) => (isQid(l.target) ? open(l.target) : l.href && router.push(l.href))} onDetails={select} loading={factsState === "loading"} />}
              {view === "cards" && <ConnectionCards record={record} links={ranked} limitOf={limitOf} setLimit={setLimit} facts={facts} selected={selected} onStep={(l) => (isQid(l.target) ? open(l.target) : l.href && router.push(l.href))} onDetails={select} />}
              {view === "map" && <MapView record={record} links={visible} facts={facts} selected={selected} onSelect={select} loading={factsState === "loading"} />}
              {factsState === "failed" && <p className="mt-2 text-xs text-ink-2">Dates and places of the linked records couldn&rsquo;t be loaded from the Wikidata Query Service, so the period and country filters have nothing to work with.</p>}
              <p className="mt-3 px-1 text-xs text-ink-2">{view === "map" ? "Choose a record to see why it’s connected." : "Choose a record to step to it; the i button explains the link and its source."}</p>
            </>
          )}
        </section>

        <aside ref={panel} className="card scroll-mt-20 p-4 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-auto" aria-label="Selected record">
          {status === "ready" && record ? (
            selectedLink ? (
              <LinkDetail link={selectedLink} record={record} facts={facts[selectedLink.target]} onBack={() => setSelected(undefined)} onOpen={(l) => open(l.target)} />
            ) : (
              <>
                <RecordCard record={record} links={all} onPick={(l) => select(l.target)} />
                <div className="mt-4 flex flex-wrap gap-2">
                  {sequenceNext && <button type="button" className="btn btn-primary btn-sm whitespace-normal text-left" onClick={() => open(sequenceNext.target)}>Next in sequence: {sequenceNext.label}</button>}
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => share("record")}>{copied === "record" ? "Link copied" : "Share"}</button>
                </div>
              </>
            )
          ) : (
            <p className="text-sm text-ink-2">{status === "failed" ? "Nothing to show yet." : "Loading…"}</p>
          )}
        </aside>
      </div>

      <p className="mt-3 text-xs text-ink-2" data-testid="network-coverage">
        <strong className="text-ink">Connected sources:</strong> Wikidata (read live, crowd-edited, CC0), Wikipedia summaries (CC BY-SA 4.0), Wikimedia Commons images (each with its own licence), the hand-checked TIMEWISE collection (Austria, 1844–1921) and the TIMEWISE world index ({`${(10250).toLocaleString("en")}`} events). Coverage varies by source and region; none of it is complete. <Link href="/about" className="link">How TIMEWISE handles sources</Link>
      </p>
    </div>
  );
}

