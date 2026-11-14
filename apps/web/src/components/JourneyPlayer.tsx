"use client";

import type { Journey } from "@timewise/historical-schemas";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { claimById, collection, eventById, eventsByDate, formatWhen, journeyById, placeLabel, toMs } from "@/lib/collection";
import { useAtlas } from "@/lib/store";
import { ArchivalMaterial } from "./ArchivalMaterial";
import { AtlasMap } from "./AtlasMap";
import { ClaimCard } from "./EvidencePanel";
import { CoverageNote } from "./MapLayers";
import { SiteHeader } from "./SiteHeader";
import { LearningModeToggle } from "./learning/LearningModeToggle";

const toIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** A position is a chapter and one of its events, or the closing page at the end. */
type Position = { chapter: number; beat: number };

function readPosition(journey: Journey): Position {
  const params = new URLSearchParams(window.location.search);
  const chapter = Math.max(0, journey.chapters.findIndex((c) => c.id === params.get("chapter")));
  const max = journey.chapters[chapter].eventIds.length - 1;
  return { chapter, beat: Math.min(max, Math.max(0, Number(params.get("step")) - 1 || 0)) };
}

export function JourneyPlayer({ id }: { id: string }) {
  const journey = journeyById.get(id)!;
  const [position, setPosition] = useState<Position>({ chapter: 0, beat: 0 });
  const [finished, setFinished] = useState(false);
  const [wide, setWide] = useState(false);
  const [viewMode, setViewMode] = useState<"compact" | "narrative">("compact");

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const update = () => setWide(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const selectedId = useAtlas((s) => s.selectedId);
  const date = useAtlas((s) => s.date);
  const tween = useRef(0);
  const scroller = useRef<HTMLDivElement>(null);
  const hydrated = useRef(false);

  const chapter = journey.chapters[position.chapter];
  const event = eventById.get(chapter.eventIds[position.beat])!;
  const totalBeats = useMemo(() => journey.chapters.reduce((n, c) => n + c.eventIds.length, 0), [journey]);
  const beatsBefore = journey.chapters.slice(0, position.chapter).reduce((n, c) => n + c.eventIds.length, 0) + position.beat;
  const isLast = position.chapter === journey.chapters.length - 1 && position.beat === chapter.eventIds.length - 1;

  useEffect(() => {
    useAtlas.getState().init(eventsByDate, collection.investigations[0].range.start);
    useAtlas.getState().setThemes([]);
    setPosition(readPosition(journey));
    hydrated.current = true;
    return () => cancelAnimationFrame(tween.current);
  }, [journey]);

  useEffect(() => {
    const target = event.when.start;
    useAtlas.setState({ selectedId: event.id });
    cancelAnimationFrame(tween.current);
    const from = toMs(useAtlas.getState().date) || toMs(target);
    const to = toMs(target);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || from === to) {
      useAtlas.setState({ date: target });
      return;
    }
    const begin = performance.now();
    const frame = (now: number) => {
      const t = Math.min(1, (now - begin) / 1400);
      const ease = t * t * (3 - 2 * t);
      useAtlas.setState({ date: t === 1 ? target : toIso(from + (to - from) * ease) });
      if (t < 1) tween.current = requestAnimationFrame(frame);
    };
    tween.current = requestAnimationFrame(frame);
  }, [event]);

  useEffect(() => {
    if (!hydrated.current) return;
    const url = new URL(window.location.href);
    url.searchParams.set("chapter", chapter.id);
    url.searchParams.set("step", String(position.beat + 1));
    window.history.replaceState(null, "", url);
  }, [chapter.id, position.beat]);

  const goTo = useCallback((p: Position) => {
    setFinished(false);
    setPosition((current) => {
      if (current.chapter !== p.chapter) scroller.current?.scrollTo({ top: 0 });
      return p;
    });
  }, []);

  const next = useCallback(() => {
    if (position.beat < journey.chapters[position.chapter].eventIds.length - 1) goTo({ chapter: position.chapter, beat: position.beat + 1 });
    else if (position.chapter < journey.chapters.length - 1) goTo({ chapter: position.chapter + 1, beat: 0 });
    else {
      setFinished(true);
      scroller.current?.scrollTo({ top: 0 });
    }
  }, [position, journey, goTo]);

  const back = useCallback(() => {
    if (finished) return setFinished(false);
    if (position.beat > 0) goTo({ chapter: position.chapter, beat: position.beat - 1 });
    else if (position.chapter > 0) goTo({ chapter: position.chapter - 1, beat: journey.chapters[position.chapter - 1].eventIds.length - 1 });
  }, [finished, position, journey, goTo]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input,textarea,select,summary")) return;
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, back]);

  const onMapSelect = (id: string) => {
    const c = journey.chapters.findIndex((ch) => ch.eventIds.includes(id));
    if (c >= 0) goTo({ chapter: c, beat: journey.chapters[c].eventIds.indexOf(id) });
  };

  const atStart = position.chapter === 0 && position.beat === 0 && !finished;

  // Get claims for current beat's event
  const currentEventClaims = useMemo(() => {
    const beatEventId = chapter.eventIds[position.beat];
    return collection.claims.filter(c => c.eventId === beatEventId);
  }, [chapter, position.beat]);

  // Get all claims in this chapter
  const chapterClaims = useMemo(() => {
    return collection.claims.filter(c => chapter.eventIds.includes(c.eventId));
  }, [chapter]);

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <SiteHeader />
      <main className="relative flex min-h-0 flex-1 flex-col lg:block">
        <div className="relative h-[38dvh] shrink-0 lg:absolute lg:inset-0 lg:h-auto">
          <AtlasMap events={eventsByDate} selectedId={selectedId} date={date} onSelect={onMapSelect} leftInset={wide ? 490 : 0} bottomInset={wide ? 60 : 0} />
          <div className="hidden lg:block"><CoverageNoteRight /></div>
          <output data-testid="journey-year" className="pointer-events-none absolute right-14 top-3 font-serif text-4xl tabular-nums text-bronze drop-shadow-sm lg:right-16 lg:top-4 lg:text-6xl">{date.slice(0, 4)}</output>
        </div>

        <article
          ref={scroller}
          aria-live="polite"
          className="relative z-10 min-h-0 flex-1 overflow-y-auto border-t border-line bg-paper lg:absolute lg:bottom-16 lg:left-4 lg:top-4 lg:w-[460px] lg:border lg:shadow-[0_18px_50px_-24px_rgb(0_0_0/0.5)]"
        >
          {finished ? (
            <div className="fade-in p-6" data-testid="journey-closing">
              <p className="eyebrow">Journey's end</p>
              <h1 className="mt-2 font-serif text-3xl leading-tight">{journey.title.en}</h1>
              <p className="mt-4 leading-relaxed">{journey.closing.en}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/explore" className="rounded-sm bg-navy px-4 py-2 text-sm font-medium text-on-accent dark:bg-bronze">Explore the atlas freely</Link>
                <button type="button" onClick={() => goTo({ chapter: 0, beat: 0 })} className="rounded-sm border border-line px-4 py-2 text-sm hover:border-bronze hover:text-bronze">Start again</button>
              </div>
            </div>
          ) : (
            <div key={chapter.id} className="fade-in p-5 sm:p-6">
              {/* Chapter header with view mode toggle */}
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex-1 min-w-0">
                  <p className="eyebrow">{journey.title.en} · Chapter {position.chapter + 1} of {journey.chapters.length}</p>
                  <h1 className="mt-2 font-serif text-3xl leading-[1.1] sm:text-4xl" data-testid="journey-question">{chapter.question.en}</h1>
                  {chapter.connection && <p className="mt-2 border-l-2 border-bronze pl-3 text-sm italic text-ink-2">{chapter.connection.en}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setViewMode("compact")}
                    className={`px-3 py-1.5 text-xs rounded-sm border transition-colors ${viewMode === "compact" ? "bg-navy text-on-accent border-navy" : "bg-paper border-line hover:border-bronze hover:text-bronze"}`}
                    aria-pressed={viewMode === "compact"}
                  >
                    Compact
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("narrative")}
                    className={`px-3 py-1.5 text-xs rounded-sm border transition-colors ${viewMode === "narrative" ? "bg-navy text-on-accent border-navy" : "bg-paper border-line hover:border-bronze hover:text-bronze"}`}
                    aria-pressed={viewMode === "narrative"}
                  >
                    Narrative
                  </button>
                </div>
              </div>

              {viewMode === "compact" ? (
                /* COMPACT MODE: Evidence-driven, high information density */
                <div className="space-y-4">
                  {/* Key Claims for this beat */}
                  <section className="space-y-3" aria-labelledby="claims-heading">
                    <h2 id="claims-heading" className="text-sm font-semibold uppercase tracking-wider text-ink-2">
                      {currentEventClaims.length === 1 ? "Key claim" : "Key claims"} ({currentEventClaims.length})
                    </h2>
                    {currentEventClaims.map((claim) => (
                      <ClaimCard key={claim.id} claim={claim} compact={true} />
                    ))}
                    {currentEventClaims.length === 0 && (
                      <p className="text-sm text-ink-2 italic">No specific claims recorded for this event.</p>
                    )}
                  </section>

                  {/* Event details with media */}
                  <section className="border-t border-line pt-4 space-y-3" data-testid="journey-event">
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 w-10 h-10 rounded-full bg-bronze-100 flex items-center justify-center">
                        <span className="text-bronze font-medium text-sm">{position.beat + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="eyebrow">{formatWhen(event.when)} · {placeLabel(event)}</p>
                        <h2 className="mt-1 font-serif text-xl leading-snug">{event.title.en}</h2>
                        {event.summary && <p className="mt-2 text-sm leading-relaxed">{event.summary.en}</p>}
                      </div>
                    </div>

                    {event.media && (
                      <figure className="mt-3">
                        <img src={event.media.url} alt={event.media.title} className="max-h-60 w-full border border-line object-cover rounded-sm" />
                        <figcaption className="mt-1 text-xs text-ink-2">
                          <a href={event.media.page} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">{event.media.title} ↗</a> {event.media.creator}, {event.media.created}. {event.media.license}.
                          {event.media.caveat && <span className="mt-0.5 block italic">{event.media.caveat}</span>}
                        </figcaption>
                      </figure>
                    )}

                    <div className="mt-3"><ArchivalMaterial eventId={event.id} /></div>
                    {event.noPlaceReason && <p className="mt-2 text-sm text-ink-2">{event.noPlaceReason}</p>}
                    {event.placeNote && <p className="mt-2 text-sm text-ink-2">{event.placeNote}</p>}
                  </section>

                  {/* Related claims in chapter (expandable) */}
                  {chapterClaims.length > currentEventClaims.length && (
                    <details className="border border-line rounded-sm bg-paper-2">
                      <summary className="p-3 cursor-pointer font-medium text-sm flex items-center justify-between">
                        <span>All claims in this chapter ({chapterClaims.length})</span>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-ink-2"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </summary>
                      <div className="px-3 pb-3 space-y-2">
                        {chapterClaims.map((claim) => (
                          <ClaimCard key={claim.id} claim={claim} compact={true} />
                        ))}
                      </div>
                    </details>
                  )}

                  {/* Chapter summary at last beat */}
                  {position.beat === chapter.eventIds.length - 1 && (
                    <p className="mt-5 bg-paper-3 p-3 text-sm leading-relaxed border-l-3 border-bronze">{chapter.summary.en}</p>
                  )}

                  <LearningModeToggle journeyId={journey.id} chapterId={chapter.id} lang="en" />
                  <Link href={`/explore?event=${event.id}`} className="mt-4 inline-block text-sm text-bronze underline-offset-2 hover:underline">Go deeper on this event →</Link>
                </div>
              ) : (
                /* NARRATIVE MODE: Original prose segments with evidence inspection */
                <div className="space-y-4">
                  {chapter.segments.map((segment, i) => (
                    <div key={i}>
                      <p className="font-serif text-[1.15rem] leading-relaxed">{segment.text.en}</p>
                      {segment.claimIds.length > 0 && (
                        <details className="mt-2">
                          <summary className="text-xs font-medium text-bronze underline-offset-2 hover:underline cursor-pointer">Inspect evidence ({segment.claimIds.length} claim{segment.claimIds.length !== 1 ? "s" : ""})</summary>
                          <div className="fade-in mt-2 space-y-2">
                            {segment.claimIds.map((id) => <ClaimCard key={id} claim={claimById.get(id)!} />)}
                          </div>
                        </details>
                      )}
                    </div>
                  ))}

                  <section key={event.id} className="fade-in mt-5 border-t border-line pt-4" data-testid="journey-event">
                    <p className="eyebrow">{formatWhen(event.when)} · {placeLabel(event)}</p>
                    <h2 className="mt-1 font-serif text-xl leading-snug">{event.title.en}</h2>
                    {event.media && (
                      <figure className="mt-3">
                        <img src={event.media.url} alt={event.media.title} className="max-h-60 w-full border border-line object-cover" />
                        <figcaption className="mt-1 text-xs text-ink-2">
                          <a href={event.media.page} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">{event.media.title} ↗</a> {event.media.creator}, {event.media.created}. {event.media.license}.
                          {event.media.caveat && <span className="mt-0.5 block italic">{event.media.caveat}</span>}
                        </figcaption>
                      </figure>
                    )}
                    <div className="mt-3"><ArchivalMaterial eventId={event.id} /></div>
                    {event.noPlaceReason && <p className="mt-2 text-sm text-ink-2">{event.noPlaceReason}</p>}
                    {event.placeNote && <p className="mt-2 text-sm text-ink-2">{event.placeNote}</p>}
                  </section>

                  {position.beat === chapter.eventIds.length - 1 && <p className="mt-5 bg-paper-3 p-3 text-sm leading-relaxed">{chapter.summary.en}</p>}
                  <LearningModeToggle journeyId={journey.id} chapterId={chapter.id} lang="en" />
                  <Link href={`/explore?event=${event.id}`} className="mt-4 inline-block text-sm text-bronze underline-offset-2 hover:underline">Go deeper on this event →</Link>
                </div>
              )}
            </div>
          )}
        </article>

        <nav aria-label="Journey progress" className="relative z-20 flex shrink-0 items-center gap-2 border-t border-line bg-paper-2 px-3 py-2 lg:absolute lg:inset-x-0 lg:bottom-0 lg:h-14">
          <button type="button" onClick={back} disabled={atStart} className="shrink-0 rounded-sm border border-line px-3 py-2 text-sm hover:border-bronze hover:text-bronze disabled:opacity-40">Back</button>
          <ol className="flex min-w-0 flex-1 items-center gap-1" aria-label="Chapters">
            {journey.chapters.map((c, i) => {
              const current = i === position.chapter && !finished;
              const done = finished || i < position.chapter;
              return (
                <li key={c.id} style={{ flexGrow: c.eventIds.length }} className="min-w-0 basis-0">
                  <button type="button" title={c.question.en} aria-label={`Chapter ${i + 1}: ${c.question.en}`} aria-current={current ? "step" : undefined} onClick={() => goTo({ chapter: i, beat: 0 })} className="group block w-full py-2">
                    <span className={`block h-1.5 rounded-full transition-colors ${current ? "bg-bronze" : done ? "bg-navy dark:bg-bronze-soft" : "bg-line group-hover:bg-bronze-soft"}`} />
                  </button>
                </li>
              );
            })}
          </ol>
          <span className="hidden shrink-0 text-xs tabular-nums text-ink-2 sm:inline">{finished ? totalBeats : beatsBefore + 1} / {totalBeats}</span>
          <button type="button" onClick={next} disabled={finished} className="shrink-0 rounded-sm bg-navy px-4 py-2 text-sm font-medium text-on-accent transition-opacity disabled:opacity-40 dark:bg-bronze">
            {isLast ? "Finish" : position.beat === chapter.eventIds.length - 1 ? "Next chapter" : "Next"}
          </button>
        </nav>
      </main>
    </div>
  );
}

/** The usual coverage note, moved clear of the story card that covers the map's left side. */
function CoverageNoteRight() {
  return <div className="[&>p]:!bottom-[4.5rem] [&>p]:!left-auto [&>p]:!right-4"><CoverageNote /></div>;
}