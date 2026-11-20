"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { collection, COVERAGE_LABELS, eventById, eventsByDate, formatWhen, placeLabel } from "@/lib/collection";
import { useAtlas, visibleEvents } from "@/lib/store";
import { AtlasMap } from "./AtlasMap";
import { CoverageNote, MapLayers } from "./MapLayers";
import { EvidenceInspector } from "./EvidenceInspector";
import { EvidencePanel } from "./EvidencePanel";
import { PlaceDNA } from "./PlaceDNA";
import { SearchBox } from "./SearchBox";
import { SiteHeader } from "./SiteHeader";
import { Timeline } from "./Timeline";
import { investigationRange } from "@/lib/collection";

type Tab = "story" | "map" | "evidence" | "dna" | "inspector";
const TABS: { id: Tab; label: string }[] = [
  { id: "story", label: "Story" },
  { id: "map", label: "Map" },
  { id: "evidence", label: "Evidence" },
  { id: "dna", label: "Place DNA" },
  { id: "inspector", label: "Inspector" },
];

const investigation = collection.investigations[0];

function Narrative({ onPick }: { onPick: () => void }) {
  const selectedId = useAtlas((s) => s.selectedId);
  const themes = useAtlas((s) => s.themes);
  const selectEvent = useAtlas((s) => s.selectEvent);
  const setPlaying = useAtlas((s) => s.setPlaying);
  const toggleTheme = useAtlas((s) => s.toggleTheme);
  const scroller = useRef<HTMLDivElement>(null);
  const events = useMemo(() => visibleEvents(eventsByDate, themes), [themes]);

  useEffect(() => {
    if (!selectedId) return;
    const el = scroller.current?.querySelector<HTMLElement>(`[data-entry="${selectedId}"]`);
    if (el && scroller.current) scroller.current.scrollTo({ top: el.offsetTop - 80, behavior: "smooth" });
  }, [selectedId]);

  return (
    <div ref={scroller} className="relative h-full overflow-y-auto">
      <div className="p-5">
        <p className="eyebrow">Investigation, {collection.region.label.en}</p>
        <h1 className="mt-2 font-serif text-3xl leading-[1.1]">{investigation.question.en}</h1>
        <p className="mt-3 leading-relaxed text-ink-2">{investigation.intro.en}</p>
        <p className="mt-3 inline-block border border-line px-2 py-1 text-xs text-ink-2" title={collection.region.coverageNote}>
          Coverage: {COVERAGE_LABELS[collection.region.coverage]}
        </p>
        <fieldset className="mt-5">
          <legend className="eyebrow mb-2">Filter by theme</legend>
          <div className="flex flex-wrap gap-1.5">
            {collection.themes.map((t) => {
              const on = themes.includes(t.id);
              return (
                <button key={t.id} type="button" aria-pressed={on} onClick={() => toggleTheme(t.id)} className={`rounded-full border px-3 py-1 text-xs transition-colors ${on ? "border-navy bg-navy text-on-accent dark:border-bronze dark:bg-bronze" : "border-line text-ink-2 hover:border-bronze"}`}>
                  {t.label.en}
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>
      {investigation.chapters.map((chapter) => {
        const entries = events.filter((e) => e.chapterId === chapter.id);
        if (!entries.length) return null;
        return (
          <section key={chapter.id} className="border-t border-line px-5 py-5">
            <h2 className="font-serif text-xl">{chapter.title.en}</h2>
            <p className="mt-1 text-sm text-ink-2">{chapter.intro.en}</p>
            <ol className="mt-3 space-y-1">
              {entries.map((e) => {
                const selected = e.id === selectedId;
                return (
                  <li key={e.id} data-entry={e.id}>
                    <button
                      type="button"
                      aria-current={selected ? "true" : undefined}
                      onClick={() => { setPlaying(false); selectEvent(e.id); onPick(); }}
                      className={`-mx-2 block w-[calc(100%+1rem)] border-l-2 px-3 py-2 text-left transition-colors ${selected ? "border-oxblood bg-paper-3" : "border-transparent hover:bg-paper-3/60"}`}
                    >
                      <span className="block text-xs text-ink-2">{formatWhen(e.when)}, {placeLabel(e)}{e.kind === "process" ? ", Process" : ""}</span>
                      <span className="block font-serif text-[1.05rem] leading-snug">{e.title.en}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
}

export function Workspace() {
  const selectedId = useAtlas((s) => s.selectedId);
  const date = useAtlas((s) => s.date);
  const comparisonMode = useAtlas((s) => s.comparisonMode);
  const comparisonDate = useAtlas((s) => s.comparisonDate);
  const themes = useAtlas((s) => s.themes);
  const selectedPlaceId = useAtlas((s) => s.selectedPlaceId);
  const selectEvent = useAtlas((s) => s.selectEvent);
  const setPlaying = useAtlas((s) => s.setPlaying);
  const setSelectedPlaceId = useAtlas((s) => s.setSelectedPlaceId);
  const [tab, setTab] = useState<Tab>("story");
  const [hydrated, setHydrated] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const edgeButton = "absolute top-1/2 z-20 hidden h-12 w-5 -translate-y-1/2 place-items-center border border-line bg-paper-2 text-xs text-ink-2 hover:text-bronze lg:grid";

  const events = useMemo(() => visibleEvents(eventsByDate, themes), [themes]);
  const selected = selectedId ? eventById.get(selectedId) ?? null : null;

  // The URL is the shareable form of the selection, so read it first and write it after.
  const applyUrl = () => {
    console.log('[DEBUG Workspace] applyUrl called, investigation.range.start:', investigation.range.start);
    const params = new URLSearchParams(window.location.search);
    const state = useAtlas.getState();
    state.init(eventsByDate, investigation.range.start);
    console.log('[DEBUG Workspace] after init, date:', state.date);
    const theme = params.get("theme");
    state.setThemes(theme && collection.themes.some((t) => t.id === theme) ? [theme] : []);
    const requested = params.get("event");
    const list = visibleEvents(eventsByDate, useAtlas.getState().themes);
    state.selectEvent(requested && eventById.has(requested) ? requested : list[0].id);
    // On phones, a link to a specific event should open on that event, not the top of the story.
    const isMobile = window.innerWidth < 1024;
    if (requested && isMobile) setTab("evidence");
    // Hydrate comparison mode from URL
    const mode = params.get("mode");
    if (mode) state.setComparisonMode(mode as any);
    const compare = params.get("compare");
    if (compare) state.setComparisonDate(compare);
    const evidence = params.get("evidence");
    if (evidence) state.setEvidenceMode(evidence as any);
    const place = params.get("place");
    if (place) state.setSelectedPlaceId(place);
  };

  useEffect(() => {
    applyUrl();
    setHydrated(true);
    window.addEventListener("popstate", applyUrl);
    return () => {
      window.removeEventListener("popstate", applyUrl);
      useAtlas.getState().setPlaying(false);
    };
  }, []);

  useEffect(() => {
    if (!hydrated || !selectedId) return;
    const state = useAtlas.getState();
    const url = new URL(window.location.href);
    url.searchParams.set("event", selectedId);
    url.searchParams.delete("investigation");
    if (themes.length === 1) url.searchParams.set("theme", themes[0]);
    else url.searchParams.delete("theme");
    if (state.comparisonMode !== "single") url.searchParams.set("mode", state.comparisonMode);
    else url.searchParams.delete("mode");
    if (state.comparisonDate) url.searchParams.set("compare", state.comparisonDate);
    else url.searchParams.delete("compare");
    if (state.evidenceMode !== "documented") url.searchParams.set("evidence", state.evidenceMode);
    else url.searchParams.delete("evidence");
    if (state.selectedPlaceId) url.searchParams.set("place", state.selectedPlaceId);
    else url.searchParams.delete("place");
    window.history.replaceState(null, "", url);
  }, [hydrated, selectedId, themes]);

  const panel = (id: Tab) => `absolute inset-0 lg:visible ${id === "map" ? "lg:relative" : "lg:static"} ${tab === id ? "visible" : "invisible"}`;

  // Auto-open Place DNA when a place is selected
  useEffect(() => {
    if (selectedPlaceId) setTab("dna");
  }, [selectedPlaceId]);

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <SiteHeader>
        <div className="mx-auto hidden max-w-md md:block">
          <SearchBox size="compact" placeholder="Search events, places, themes…" />
        </div>
      </SiteHeader>

      <div role="tablist" aria-label="Workspace panels" className="flex shrink-0 border-b border-line bg-paper-2 lg:hidden">
        {TABS.map((t) => (
          <button key={t.id} role="tab" type="button" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`flex-1 border-b-2 py-2.5 text-sm ${tab === t.id ? "border-bronze font-medium text-ink" : "border-transparent text-ink-2"}`}>
            {t.label}
          </button>
        ))}
      </div>

      <main
        className="relative min-h-0 flex-1 lg:grid lg:grid-cols-[var(--tw-left)_minmax(0,1fr)_var(--tw-right)]"
        style={{ "--tw-left": leftOpen ? "340px" : "0px", "--tw-right": rightOpen ? "400px" : "0px" } as React.CSSProperties}
      >
        <div className={`${panel("story")} overflow-hidden border-r border-line bg-paper`}>
          <Narrative onPick={() => setTab("evidence")} />
        </div>
        <div className={panel("map")}>
          {comparisonMode === "split" && comparisonDate ? (
            // Split view: two maps side by side
            <div className="flex h-full">
              <AtlasMap
                events={events}
                selectedId={selectedId}
                date={date}
                onSelect={(id) => { setPlaying(false); selectEvent(id); }}
                comparisonMode="single"
                style={{ width: "50%", height: "100%" }}
              />
              <div className="w-px bg-line" />
              <AtlasMap
                events={events}
                selectedId={selectedId}
                date={comparisonDate}
                onSelect={(id) => { setPlaying(false); selectEvent(id); }}
                comparisonMode="single"
                style={{ width: "50%", height: "100%" }}
              />
            </div>
          ) : (
            <>
              <AtlasMap
                events={events}
                selectedId={selectedId}
                date={date}
                comparisonDate={comparisonDate}
                comparisonMode={comparisonMode}
                onSelect={(id) => { setPlaying(false); selectEvent(id); }}
              />
              <MapLayers />
              <CoverageNote />
            </>
          )}
          <button type="button" aria-label={leftOpen ? "Collapse story panel" : "Expand story panel"} aria-expanded={leftOpen} onClick={() => setLeftOpen(!leftOpen)} className={`${edgeButton} left-0 border-l-0`}>{leftOpen ? "‹" : "›"}</button>
          <button type="button" aria-label={rightOpen ? "Collapse evidence panel" : "Expand evidence panel"} aria-expanded={rightOpen} onClick={() => setRightOpen(!rightOpen)} className={`${edgeButton} right-0 border-r-0`}>{rightOpen ? "›" : "‹"}</button>
        </div>

        {/* On desktop these share the right-hand column, stacked and scrolling together. As separate grid
            items they wrapped into a second row, which cut the evidence panel off halfway. On phones each is its own tab. */}
        <div className="contents lg:block lg:min-h-0 lg:overflow-y-auto lg:border-l lg:border-line lg:bg-paper">
          {/* Evidence Panel */}
          <div className={`${panel("evidence")} overflow-y-auto border-l border-line lg:border-l-0 bg-paper`}>
            <EvidencePanel event={selected} />
          </div>
  
          {/* Place DNA Panel */}
          <div className={`${panel("dna")} overflow-y-auto border-l border-line lg:border-l-0 bg-paper`}>
            <PlaceDNA />
          </div>
  
          {/* Evidence Inspector Panel */}
          <div className={`${panel("inspector")} overflow-y-auto border-l border-line lg:border-l-0 bg-paper`}>
            <EvidenceInspector />
          </div>
        </div>
      </main>

      {/* The semantic timeline belongs in the bottom bar (spec 8B). TimeMicroscope duplicated it, so it's left out
          until its view and evidence switches get a home. Those still work through the URL (mode=, compare=, evidence=). */}
      <div className="h-[218px] shrink-0 md:h-[240px]">
        <Timeline range={investigationRange} />
      </div>
    </div>
  );
}
