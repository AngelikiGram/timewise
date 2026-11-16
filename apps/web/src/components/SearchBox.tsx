"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";
import { collection } from "@/lib/collection";
import { formatYear, yearOf } from "@/lib/dates";
import { fold, search, type SearchHit } from "@/lib/search";
import { searchWikidata } from "@/lib/record";
import { atlasHref, CONTINENT_LABELS, loadIndex, loadRegions, type IndexEvent, type RegionRow } from "@/lib/world-index";

type Scope = "all" | "checked" | "world" | "places" | "wikidata";
const SCOPES: { id: Scope; label: string; help: string }[] = [
  { id: "all", label: "Everything", help: "Hand-checked stories, world records and places" },
  { id: "checked", label: "Checked", help: "Only the hand-checked Austria collection, with sources for every claim" },
  { id: "world", label: "World records", help: "The 10,000 best-documented events imported from Wikidata, not individually checked" },
  { id: "places", label: "Places", help: "Countries and continents with an atlas" },
  { id: "wikidata", label: "All Wikidata", help: "Any event, person, place, invention or idea in Wikidata, searched live; opens in the connections explorer" },
];

type Hit = { key: string; kind: string; label: string; detail: string; href: string };
const KIND_LABEL: Record<SearchHit["kind"], string> = { investigation: "Investigate", event: "Checked", place: "Place", theme: "Theme" };

function searchIndex(events: IndexEvent[], regions: RegionRow[], query: string, scope: Scope): Hit[] {
  const q = fold(query.trim());
  if (q.length < 2) return [];
  const label = new Map(regions.map((r) => [r.id, r.label.en]));
  const out: Hit[] = [];
  if (scope === "all" || scope === "places") {
    const places = [...regions, ...Object.entries(CONTINENT_LABELS).map(([id, l]) => ({ id, label: { en: l }, kind: "continent" }) as RegionRow)];
    for (const r of places) {
      const name = fold(r.label.en);
      if (name.startsWith(q) || name.includes(` ${q}`)) out.push({ key: `r-${r.id}`, kind: r.kind === "continent" ? "Continent" : "Country", label: r.label.en, detail: "Open its atlas", href: `/atlas/${r.id}` });
    }
  }
  if (scope === "all" || scope === "world") {
    const terms = q.split(/\s+/).filter(Boolean);
    let n = 0;
    for (const e of events) {
      const t = fold(e.t);
      if (!terms.every((term) => t.includes(term))) continue;
      const where = e.k && (e.n ?? 1) < 5 ? label.get(e.k) ?? "" : e.n ? `${e.n} countries` : "";
      out.push({ key: `w-${e.i}`, kind: "Record", label: e.t, detail: [formatYear(yearOf(e.s)), where].filter(Boolean).join(" · "), href: atlasHref(e) });
      if (++n >= 6) break;
    }
  }
  return out;
}

/**
 * One search for the whole site. The scope is always visible, so it's clear whether a result comes from
 * the hand-checked collection or from the imported world records.
 */
export function SearchBox({ size = "large", placeholder, defaultScope = "all" }: { size?: "large" | "compact"; placeholder?: string; defaultScope?: Scope }) {
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<Scope>(defaultScope);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [index, setIndex] = useState<{ events: IndexEvent[]; regions: RegionRow[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const large = size === "large";
  const needsIndex = scope !== "checked" && scope !== "wikidata";
  const [live, setLive] = useState<Hit[]>([]);

  useEffect(() => {
    if (scope !== "wikidata" || query.trim().length < 2) { setLive([]); return; }
    const ac = new AbortController();
    const t = setTimeout(() => {
      searchWikidata(query.trim(), ac.signal).then((r) => setLive(r.map((h) => ({ key: `wd-${h.id}`, kind: "Wikidata", label: h.label, detail: h.description ?? "", href: `/connections?id=${h.id}` }))), () => setLive([]));
    }, 250);
    return () => { clearTimeout(t); ac.abort(); };
  }, [scope, query]);

  useEffect(() => {
    if (!open || !needsIndex || index) return;
    Promise.all([loadIndex(), loadRegions()])
      .then(([events, regions]) => setIndex({ events, regions }))
      .catch(() => setFailed(true));
  }, [open, needsIndex, index]);

  const hits: Hit[] = useMemo(() => {
    const checked = scope === "all" || scope === "checked"
      ? search(collection, query, scope === "checked" ? 8 : 4).map((h) => ({ key: `${h.kind}-${h.id}`, kind: KIND_LABEL[h.kind], label: h.label, detail: h.detail, href: h.href }))
      : [];
    const world = index ? searchIndex(index.events, index.regions, query, scope) : [];
    return [...checked, ...world, ...live].slice(0, 10);
  }, [query, scope, index, live]);

  const loadingIndex = open && needsIndex && !index && !failed && query.trim().length >= 2 && hits.length === 0;
  const showEmpty = open && query.trim().length >= 2 && hits.length === 0 && !loadingIndex;

  const go = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  };

  return (
    <div className="relative w-full">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (hits[active]) go(hits[active].href);
        }}
        className={`flex items-center border border-line bg-paper-2 transition-colors focus-within:border-bronze ${large ? "rounded-lg py-1.5 pl-4 pr-1.5 shadow-[0_18px_50px_-28px_rgb(0_0_0/0.45)]" : "rounded-full py-0.5 pl-3 pr-1"}`}
      >
        <svg aria-hidden viewBox="0 0 20 20" className={`${large ? "h-5 w-5" : "h-4 w-4"} shrink-0 text-ink-2`}><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="m13 13 4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
        <input
          role="combobox"
          aria-expanded={open && hits.length > 0}
          aria-controls={listId}
          aria-label="Search events, places and stories"
          aria-activedescendant={open && hits[active] ? `${listId}-${active}` : undefined}
          autoComplete="off"
          value={query}
          placeholder={placeholder ?? "Search events and places"}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, hits.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            if (e.key === "Escape") setOpen(false);
          }}
          className={`min-w-0 flex-1 bg-transparent px-2 outline-none placeholder:text-ink-2/80 ${large ? "py-1.5 text-lg" : "py-1 text-sm"}`}
        />
        <label className="shrink-0">
          <span className="sr-only">Search in</span>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as Scope)}
            title={SCOPES.find((s) => s.id === scope)?.help}
            data-testid="search-scope"
            className={`cursor-pointer rounded-full border border-line bg-paper text-ink-2 outline-none hover:border-bronze focus:border-bronze ${large ? "px-3 py-1.5 text-sm" : "max-w-28 px-2 py-0.5 text-xs"}`}
          >
            {SCOPES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
      </form>
      {open && hits.length > 0 && (
        <ul id={listId} data-testid="search-results" role="listbox" className="absolute inset-x-0 top-full z-50 mt-1 max-h-96 overflow-auto rounded-lg border border-line bg-paper-2 py-1 shadow-xl">
          {hits.map((hit, i) => (
            <li key={hit.key} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => go(hit.href)}
                onMouseEnter={() => setActive(i)}
                className={`flex w-full items-baseline gap-3 px-4 py-2.5 text-left ${i === active ? "bg-paper-3" : ""}`}
              >
                <span className={`w-20 shrink-0 text-xs font-semibold uppercase tracking-wider ${hit.kind === "Checked" || hit.kind === "Investigate" ? "text-navy" : "text-ink-2"}`}>{hit.kind}</span>
                <span className="min-w-0 flex-1 font-serif text-base text-ink">{hit.label}</span>
                <span className="hidden shrink-0 text-xs text-ink-2 sm:inline">{hit.detail}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {(showEmpty || loadingIndex || (failed && open && needsIndex)) && (
        <p role="status" className="absolute inset-x-0 top-full z-50 mt-1 rounded-lg border border-line bg-paper-2 px-4 py-3 text-sm text-ink-2 shadow-xl">
          {loadingIndex
            ? "Loading the world index…"
            : failed && !hits.length
              ? "The world index couldn't be loaded. The checked collection can still be searched."
              : `Nothing ${scope === "checked" ? "in the checked collection" : scope === "world" ? "among the world records" : scope === "places" ? "among the places" : "found"} matches this. Try another spelling or scope.`}
        </p>
      )}
    </div>
  );
}
