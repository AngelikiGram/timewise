"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { collection } from "@/lib/collection";
import { formatYear, yearOf } from "@/lib/dates";
import { BASE_PATH, asset } from "@/lib/paths";
import { searchWikidata } from "@/lib/record";
import { fold, search, type SearchHit } from "@/lib/search";
import { atlasHref, CONTINENT_LABELS, loadIndex, loadRegions, type IndexEvent, type RegionRow } from "@/lib/world-index";

type Scope = "indexed" | "checked" | "region" | "wikidata";
const KIND_LABEL: Record<SearchHit["kind"], string> = { investigation: "Investigate", event: "Checked", place: "Place", theme: "Theme" };

type Hit = { key: string; kind: string; label: string; detail: string; href: string };
type RegionEvent = { id: string; title: { en?: string; de?: string }; start: string; home?: string; multi?: boolean; inside?: boolean };

const regionEvents = new Map<string, Promise<RegionEvent[]>>();
function loadRegionEvents(id: string) {
  if (!regionEvents.has(id)) {
    const p = fetch(asset(`/data/regions/${id}.json`)).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))).then((d: { events: RegionEvent[] }) => d.events);
    p.catch(() => regionEvents.delete(id));
    regionEvents.set(id, p);
  }
  return regionEvents.get(id)!;
}

function searchIndex(events: IndexEvent[], regions: RegionRow[], query: string): Hit[] {
  const q = fold(query.trim());
  if (q.length < 2) return [];
  const label = new Map(regions.map((r) => [r.id, r.label.en]));
  const out: Hit[] = [];
  const places = [...regions, ...Object.entries(CONTINENT_LABELS).map(([id, l]) => ({ id, label: { en: l }, kind: "continent" }) as RegionRow)];
  for (const r of places) {
    const name = fold(r.label.en);
    if (name.startsWith(q) || name.includes(` ${q}`)) out.push({ key: `r-${r.id}`, kind: r.kind === "continent" ? "Continent" : "Country", label: r.label.en, detail: "Open its map", href: `/atlas/${r.id}` });
  }
  const terms = q.split(/\s+/).filter(Boolean);
  let n = 0;
  for (const e of events) {
    if (!terms.every((term) => fold(e.t).includes(term))) continue;
    const where = e.k && (e.n ?? 1) < 5 ? label.get(e.k) ?? "" : e.n ? `${e.n} countries` : "";
    out.push({ key: `w-${e.i}`, kind: "Record", label: e.t, detail: [formatYear(yearOf(e.s)), where].filter(Boolean).join(" · "), href: atlasHref(e) });
    if (++n >= 8) break;
  }
  return out;
}

/** The region whose map this page shows, if any: /atlas/austria, /history/europe. */
function regionOfPath(pathname: string) {
  const p = BASE_PATH && pathname.startsWith(BASE_PATH) ? pathname.slice(BASE_PATH.length) : pathname;
  const m = p.match(/^\/(?:atlas|history)\/([a-z_]+)\/?$/);
  return m && m[1] !== "countries" ? m[1] : null;
}

/**
 * Search, with its scope always visible and named for what it actually covers. Results open the record;
 * a result from "This map" keeps the map's current filters.
 */
export function SearchBox({ size = "large", placeholder }: { size?: "large" | "compact"; placeholder?: string; defaultScope?: string }) {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const listId = useId();
  const regionId = regionOfPath(pathname);
  const [regionName, setRegionName] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<Scope>("indexed");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [hits, setHits] = useState<Hit[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "done" | "failed">("idle");
  const [retry, setRetry] = useState(0);
  const large = size === "large";
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!regionId) { setRegionName(null); if (scope === "region") setScope("indexed"); return; }
    loadRegions().then((rs) => setRegionName(rs.find((r) => r.id === regionId)?.label.en ?? CONTINENT_LABELS[regionId] ?? null), () => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regionId]);

  const SCOPES = useMemo(() => {
    const list: { id: Scope; label: string; help: string }[] = [
      { id: "indexed", label: "Indexed records", help: "The 10,250 best-documented imported events, plus countries, continents and the checked collection. Not every record in TIMEWISE." },
      { id: "checked", label: "Checked only", help: "Only the hand-checked Austria collection (1844–1921), where every claim cites a source." },
    ];
    if (regionId) list.push({ id: "region", label: `This map: ${regionName ?? regionId}`, help: `Every record on the ${regionName ?? regionId} map, including those not in the index.` });
    list.push({ id: "wikidata", label: "Wikidata (live)", help: "All of Wikidata, searched live: events, people, places, inventions and ideas. Opens in the connections explorer." });
    return list;
  }, [regionId, regionName]);
  const scopeInfo = SCOPES.find((s) => s.id === scope) ?? SCOPES[0];

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setHits([]); setState("idle"); return; }
    const ac = new AbortController();
    setState("loading");
    const checked = (n: number) => search(collection, q, n).map((h) => ({ key: `${h.kind}-${h.id}`, kind: KIND_LABEL[h.kind], label: h.label, detail: h.detail, href: h.href }));
    const run = async (): Promise<Hit[]> => {
      if (scope === "checked") return checked(10);
      if (scope === "wikidata") {
        await new Promise((r) => setTimeout(r, 250));
        if (ac.signal.aborted) return [];
        return (await searchWikidata(q, ac.signal)).map((h) => ({ key: `wd-${h.id}`, kind: "Wikidata", label: h.label, detail: h.description ?? "", href: `/connections?id=${h.id}` }));
      }
      if (scope === "region" && regionId) {
        const events = await loadRegionEvents(regionId);
        const terms = fold(q).split(/\s+/);
        const keep = new URLSearchParams(window.location.search);
        keep.delete("event");
        return events
          .filter((e) => terms.every((t) => fold(`${e.title.en ?? ""} ${e.title.de ?? ""}`).includes(t)))
          .slice(0, 10)
          .map((e) => { const k = new URLSearchParams(keep); k.set("event", e.id); return { key: `m-${e.id}`, kind: "On this map", label: e.title.en ?? e.title.de ?? e.id, detail: formatYear(yearOf(e.start)) + (e.inside === false ? " · located elsewhere" : ""), href: `/atlas/${regionId}?${k}` }; });
      }
      const [events, regions] = await Promise.all([loadIndex(), loadRegions()]);
      return [...checked(3), ...searchIndex(events, regions, q)].slice(0, 10);
    };
    run().then((h) => { if (!ac.signal.aborted) { setHits(h); setActive(0); setState("done"); } }, (e) => { if (!ac.signal.aborted && e.name !== "AbortError") setState("failed"); });
    return () => ac.abort();
  }, [query, scope, regionId, retry]);

  const go = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  };
  const showPanel = open && query.trim().length >= 2;

  return (
    <div ref={box} className="relative w-full" onBlur={(e) => { if (!box.current?.contains(e.relatedTarget as Node)) setOpen(false); }}>
      <form
        role="search"
        aria-label="Search history"
        onSubmit={(e) => {
          e.preventDefault();
          const hit = hits[active] ?? hits[0];
          if (hit) go(hit.href);
          else setOpen(true);
        }}
        className={`flex items-center border border-line bg-paper-2 transition-colors focus-within:border-bronze ${large ? "rounded-lg py-1.5 pl-4 pr-1.5 shadow-[0_18px_50px_-28px_rgb(0_0_0/0.45)]" : "rounded-full py-0.5 pl-3 pr-1"}`}
      >
        <svg aria-hidden viewBox="0 0 20 20" className={`${large ? "h-5 w-5" : "h-4 w-4"} shrink-0 text-ink-2`}><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="m13 13 4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
        <input
          role="combobox"
          aria-expanded={showPanel && hits.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label={`Search history in ${scopeInfo.label}`}
          aria-activedescendant={showPanel && hits[active] ? `${listId}-${active}` : undefined}
          autoComplete="off"
          enterKeyHint="search"
          value={query}
          placeholder={placeholder ?? "Search events and places"}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, hits.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            if (e.key === "Escape") setOpen(false);
          }}
          className={`min-w-0 flex-1 bg-transparent px-2 outline-none placeholder:text-ink-2/80 ${large ? "py-1.5 text-lg" : "py-1 text-sm"}`}
        />
        <label className="shrink-0">
          <span className="sr-only">Search in</span>
          <select
            value={scope}
            onChange={(e) => { setScope(e.target.value as Scope); setOpen(true); }}
            title={scopeInfo.help}
            data-testid="search-scope"
            className={`cursor-pointer rounded-full border border-line bg-paper text-ink-2 outline-none hover:border-bronze focus:border-bronze ${large ? "max-w-48 px-3 py-1.5 text-sm" : "max-w-40 px-2 py-0.5 text-xs"}`}
          >
            {SCOPES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
      </form>
      {showPanel && (
        <div className="absolute inset-x-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-line bg-paper-2 shadow-xl" data-testid="search-panel">
          <p role="status" aria-live="polite" className="border-b border-line px-4 py-2 text-xs text-ink-2" data-testid="search-status">
            {state === "loading" ? `Searching ${scopeInfo.label.toLowerCase()}…`
              : state === "failed" ? <>Couldn&rsquo;t search {scopeInfo.label.toLowerCase()}. <button type="button" className="link" onClick={() => setRetry((r) => r + 1)}>Try again</button></>
              : hits.length ? `${hits.length}${hits.length === 10 ? "+" : ""} result${hits.length === 1 ? "" : "s"} in ${scopeInfo.label.toLowerCase()}. ${scopeInfo.help.split(".")[0]}.`
              : `No results in ${scopeInfo.label.toLowerCase()}. ${scopeInfo.help.split(".")[0]}.`}
          </p>
          {hits.length > 0 && (
            <ul id={listId} data-testid="search-results" role="listbox" className="max-h-96 overflow-auto py-1">
              {hits.map((hit, i) => (
                <li key={hit.key} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    tabIndex={-1}
                    // Keep focus in the input on mouse and touch, so the list doesn't close before the click lands.
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => go(hit.href)}
                    onMouseEnter={() => setActive(i)}
                    className={`flex w-full items-baseline gap-3 px-4 py-2.5 text-left ${i === active ? "bg-paper-3" : ""}`}
                  >
                    <span className={`w-24 shrink-0 text-xs font-semibold uppercase tracking-wider ${hit.kind === "Checked" || hit.kind === "Investigate" ? "text-navy" : "text-ink-2"}`}>{hit.kind}</span>
                    <span className="min-w-0 flex-1 font-serif text-base text-ink">{hit.label}</span>
                    <span className="hidden shrink-0 text-xs text-ink-2 sm:inline">{hit.detail}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {state === "done" && !hits.length && (
            <div className="flex flex-wrap gap-1.5 px-4 py-2">
              <span className="text-xs text-ink-2">Try another scope:</span>
              {SCOPES.filter((s) => s.id !== scope).map((s) => (
                <button key={s.id} type="button" className="chip !min-h-7 !text-xs" onPointerDown={(e) => e.preventDefault()} onClick={() => setScope(s.id)}>{s.label}</button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
