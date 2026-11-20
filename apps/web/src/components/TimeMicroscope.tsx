"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { collection, endOf, toMs } from "@/lib/collection";
import { useAtlas, type ComparisonMode, type EvidenceMode, visibleEvents } from "@/lib/store";

const YEAR = 365.25 * 86400000;
const MIN_YEAR = 1844;
const MAX_YEAR = 1924;

export function TimeMicroscope() {
  const date = useAtlas((s) => s.date);
  const comparisonMode = useAtlas((s) => s.comparisonMode);
  const comparisonDate = useAtlas((s) => s.comparisonDate);
  const evidenceMode = useAtlas((s) => s.evidenceMode);
  const themes = useAtlas((s) => s.themes);
  const allEvents = useAtlas((s) => s.allEvents);
  const playing = useAtlas((s) => s.playing);
  const { scrubTo, setComparisonMode, setComparisonDate, setEvidenceMode, step, setPlaying } = useAtlas.getState();

  const events = useMemo(
    () =>
      allEvents
        .filter((e) => (themes.length === 0 || e.themes.some((t) => themes.includes(t))) && e.when.start)
        .sort((a, b) => a.when.start.localeCompare(b.when.start)),
    [allEvents, themes]
  );

  const year = date ? Number(date.slice(0, 4)) : MIN_YEAR;
  const compYear = comparisonDate ? Number(comparisonDate.slice(0, 4)) : year;

  const sliderRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<"main" | "compare" | null>(null);
  const [hoverYear, setHoverYear] = useState<number | null>(null);

  const pxToYear = useCallback(
    (px: number) => {
      const rect = sliderRef.current?.getBoundingClientRect();
      if (!rect) return year;
      const ratio = Math.max(0, Math.min(1, (px - rect.left) / rect.width));
      return Math.round(MIN_YEAR + ratio * (MAX_YEAR - MIN_YEAR));
    },
    [year]
  );

  const yearToPx = useCallback(
    (y: number) => {
      const rect = sliderRef.current?.getBoundingClientRect();
      if (!rect) return 0;
      const ratio = (y - MIN_YEAR) / (MAX_YEAR - MIN_YEAR);
      return rect.left + ratio * rect.width;
    },
    [year]
  );

  const handlePointerDown = (e: React.PointerEvent, which: "main" | "compare") => {
    e.preventDefault();
    setDragging(which);
    const y = pxToYear(e.clientX);
    if (which === "main") scrubTo(`${y}-01-01`);
    else setComparisonDate(`${y}-01-01`);
  };

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      const y = pxToYear(e.clientX);
      if (dragging === "main") scrubTo(`${y}-01-01`);
      else setComparisonDate(`${y}-01-01`);
    };
    const up = () => setDragging(null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [dragging, pxToYear, scrubTo, setComparisonDate]);

  // Global keyboard handler for Home/End/Space (works when any element is focused)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "Home") {
        e.preventDefault();
        const { allEvents, selectEvent, themes } = useAtlas.getState();
        const list = visibleEvents(allEvents, themes).filter((e) => e.when.start).sort((a, b) => a.when.start.localeCompare(b.when.start));
        if (list.length) selectEvent(list[0].id);
      } else if (e.key === "End") {
        e.preventDefault();
        const { allEvents, selectEvent, themes } = useAtlas.getState();
        const list = visibleEvents(allEvents, themes).filter((e) => e.when.start).sort((a, b) => a.when.start.localeCompare(b.when.start));
        if (list.length) selectEvent(list[list.length - 1].id);
      } else if (e.key === " ") {
        e.preventDefault();
        setPlaying(!playing);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, playing, setPlaying]);

  // Major historical years for the track markers
  const majorYears = useMemo(
    () =>
      [1844, 1848, 1857, 1865, 1866, 1867, 1882, 1914, 1918, 1919, 1920, 1921, 1924].filter(
        (y) => y >= MIN_YEAR && y <= MAX_YEAR
      ),
    []
  );

  const eventYears = useMemo(
    () => [...new Set(events.map((e) => Number(e.when.start.slice(0, 4))))].sort((a, b) => a - b),
    [events]
  );

  const COMPARISON_MODES: { value: ComparisonMode; label: string; desc: string; icon: React.ReactNode }[] = [
    { value: "single", label: "Single", desc: "One historical date", icon: <IconSingle /> },
    { value: "split", label: "Split", desc: "Side-by-side comparison", icon: <IconSplit /> },
    { value: "swipe", label: "Swipe", desc: "Drag to compare", icon: <IconSwipe /> },
    { value: "then-now", label: "Then & Now", desc: "Historical vs modern", icon: <IconThenNow /> },
  ];

  const EVIDENCE_MODES: { value: EvidenceMode; label: string; desc: string; color: string }[] = [
    { value: "documented", label: "Documented", desc: "Primary sources only", color: "navy" },
    { value: "inferred", label: "Inferred", desc: "Plausible reconstructions", color: "bronze" },
    { value: "reconstructed", label: "Reconstructed", desc: "Expert synthesis", color: "oxblood" },
  ];

  return (
    <div data-testid="time-microscope" className="border-t border-line bg-paper-2 p-3 sm:p-4" role="region" aria-label="Time Microscope">
      {/* Comparison Mode Selector */}
      <div className="flex items-center gap-2 mb-3">
        <span className="eyebrow shrink-0">View</span>
        <div className="flex flex-1 gap-1 bg-paper-3 rounded-sm p-1" role="radiogroup" aria-label="Comparison mode">
          {COMPARISON_MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              role="radio"
              aria-checked={comparisonMode === m.value}
              onClick={() => setComparisonMode(m.value)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-xs transition-colors ${
                comparisonMode === m.value
                  ? "bg-paper-2 border border-navy text-navy"
                  : "text-ink-2 hover:text-ink"
              }`}
              title={m.desc}
            >
              {m.icon}
              <span className="hidden sm:inline">{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Evidence Mode Selector */}
      <div className="flex items-center gap-2 mb-3">
        <span className="eyebrow shrink-0">Evidence</span>
        <div className="flex flex-1 gap-1 bg-paper-3 rounded-sm p-1" role="radiogroup" aria-label="Evidence mode">
          {EVIDENCE_MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              role="radio"
              aria-checked={evidenceMode === m.value}
              onClick={() => setEvidenceMode(m.value)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-xs transition-colors ${
                evidenceMode === m.value
                  ? `bg-${m.color} text-on-accent`
                  : "text-ink-2 hover:text-ink"
              }`}
              title={m.desc}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              <span className="hidden sm:inline">{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Year Slider */}
      <div className="relative" style={{ minHeight: 60 }}>
        {/* Track background */}
        <div
          ref={sliderRef}
          className="relative h-8 rounded-full bg-paper-3"
          onPointerDown={(e) => handlePointerDown(e, "main")}
          onMouseMove={(e) => setHoverYear(pxToYear(e.clientX))}
          onMouseLeave={() => setHoverYear(null)}
          role="slider"
          aria-label="Time Microscope year"
          aria-valuemin={MIN_YEAR}
          aria-valuemax={MAX_YEAR}
          aria-valuenow={year}
          aria-valuetext={comparisonMode !== "single" ? `${year} (comparing to ${compYear})` : String(year)}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") {
              e.preventDefault();
              step(-1);
            } else if (e.key === "ArrowRight") {
              e.preventDefault();
              step(1);
            }
          }}
        >
          {/* Period bands */}
          {collection.periods.map((p) => {
            const start = Number(p.start.slice(0, 4));
            const end = Number(p.end.slice(0, 4));
            const left = ((start - MIN_YEAR) / (MAX_YEAR - MIN_YEAR)) * 100;
            const width = ((end - start) / (MAX_YEAR - MIN_YEAR)) * 100;
            return (
              <div
                key={p.id}
                className="absolute top-0 h-full bg-bronze-soft/30"
                style={{ left: `${left}%`, width: `${width}%` }}
              >
                <div className="absolute top-1 left-1 text-xs font-medium text-bronze">{p.label.en}</div>
              </div>
            );
          })}

          {/* Event tick marks */}
          {eventYears.map((y) => (
            <div
              key={y}
              className="absolute top-2 bottom-2 w-px bg-bronze/30"
              style={{ left: `${((y - MIN_YEAR) / (MAX_YEAR - MIN_YEAR)) * 100}%` }}
              title={`${events.filter((e) => e.when.start.startsWith(String(y))).length} events in ${y}`}
            />
          ))}

          {/* Major year markers */}
          {majorYears.map((y) => (
            <div
              key={y}
              className="absolute bottom-0 h-2 w-px bg-bronze"
              style={{ left: `${((y - MIN_YEAR) / (MAX_YEAR - MIN_YEAR)) * 100}%` }}
            >
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-xs font-medium text-ink">
                {y}
              </div>
            </div>
          ))}

          {/* Comparison date marker */}
          {comparisonMode !== "single" && comparisonDate && (
            <div
              className="absolute top-0 bottom-0 w-1 bg-oxblood/50"
              style={{ left: `${((compYear - MIN_YEAR) / (MAX_YEAR - MIN_YEAR)) * 100}%` }}
              onPointerDown={(e) => {
                e.stopPropagation();
                handlePointerDown(e, "compare");
              }}
            >
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-medium text-oxblood">
                {compYear}
              </div>
            </div>
          )}

          {/* Current date marker */}
          <div
            className="absolute top-0 bottom-0 w-1.5 bg-bronze"
            style={{ left: `${((year - MIN_YEAR) / (MAX_YEAR - MIN_YEAR)) * 100}%` }}
          >
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-medium text-bronze">
              {year}
            </div>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 w-10 h-10 -mb-1 bg-bronze rounded-full flex items-center justify-center">
              <span className="text-xs font-bold text-on-accent">{year}</span>
            </div>
          </div>

          {/* Hover year indicator */}
          {hoverYear !== null && hoverYear !== year && (
            <div
              className="absolute top-0 bottom-0 w-px bg-bronze/50"
              style={{ left: `${((hoverYear - MIN_YEAR) / (MAX_YEAR - MIN_YEAR)) * 100}%`, pointerEvents: "none" }}
            >
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs text-bronze/70">{hoverYear}</div>
            </div>
          )}
        </div>

        {/* Playback controls */}
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label="Previous event"
            className="p-1.5 rounded-full border border-line bg-paper hover:border-bronze hover:text-bronze transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M10 12V4L4 8l6 4z" /></svg>
          </button>
          <button
            type="button"
            onClick={() => setPlaying(!playing)}
            aria-label={playing ? "Pause Time Microscope" : "Play Time Microscope"}
            aria-pressed={playing}
            className="p-1.5 rounded-full bg-navy text-on-accent dark:bg-bronze"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              {playing ? (
                <>
                  <rect x="3" y="3" width="3" height="10" />
                  <rect x="10" y="3" width="3" height="10" />
                </>
              ) : (
                <path d="M4 3v10l9-5-9-5z" />
              )}
            </svg>
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            aria-label="Next event"
            className="p-1.5 rounded-full border border-line bg-paper hover:border-bronze hover:text-bronze transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M6 12V4l6 4-6 4z" /></svg>
          </button>
          <output className="ml-2 font-serif text-lg tabular-nums text-bronze" aria-live="polite">
            {date ? formatYear(date) : "—"}
          </output>
          {comparisonMode !== "single" && comparisonDate && (
            <>
              <span className="text-ink-2">vs</span>
              <output className="font-serif text-lg tabular-nums text-oxblood">{formatYear(comparisonDate)}</output>
            </>
          )}
        </div>
      </div>

      {/* Context indicator */}
      <div className="mt-2 text-xs text-ink-2" role="status" aria-live="polite">
        {events.length} events in collection, {evidenceMode} mode
        {comparisonMode !== "single" && <span>, {comparisonMode} view</span>}
      </div>
    </div>
  );
}

function formatYear(iso: string): string {
  const y = iso.slice(0, 4);
  const precision = iso.length > 4 ? "day" : "year";
  return precision === "year" ? `${y}±` : y;
}

function IconSingle() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="1" width="10" height="10" rx="1" />
    </svg>
  );
}

function IconSplit() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
      <line x1="6" y1="1" x2="6" y2="11" />
      <rect x="1" y="1" width="10" height="10" rx="1" />
    </svg>
  );
}

function IconSwipe() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 10L10 2M10 2H2V10" />
    </svg>
  );
}

function IconThenNow() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="3" cy="9" r="2.5" />
      <circle cx="9" cy="3" r="2.5" />
      <path d="M5.5 6.5L6.5 5.5" strokeWidth="1" />
    </svg>
  );
}