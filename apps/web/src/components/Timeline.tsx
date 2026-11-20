"use client";

import type { HistoricalEvent } from "@timewise/historical-schemas";
import { scaleUtc } from "d3-scale";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { collection, endOf, eventsByDate, formatWhen, placeLabel, temporalForm, toMs } from "@/lib/collection";
import { fold } from "@/lib/search";
import { useAtlas, visibleEvents } from "@/lib/store";

const toIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const YEAR = 365.25 * 86400000;
const MIN_SPAN = 2 * YEAR;
const CLUSTER_PX = 15;

const PAD_R = 14;
const DENSITY_H = 14;
const AXIS_H = 34;
const MIN_ROW_H = 20; // Minimum height for theme label rows
const trackOf = (e: HistoricalEvent) => e.themes[0];

export function Timeline({ range }: { range: { start: string; end: string } }) {
  const allEvents = useAtlas((s) => s.allEvents);
  const themes = useAtlas((s) => s.themes);
  const selectedId = useAtlas((s) => s.selectedId);
  const date = useAtlas((s) => s.date);
  const playing = useAtlas((s) => s.playing);
  const highlight = useAtlas((s) => s.highlight);
  const { selectEvent, scrubTo, step, setPlaying, toggleTheme, setHighlight } = useAtlas.getState();

  const startMs = toMs(range.start);
  const endMs = toMs(range.end);
  const events = useMemo(() => visibleEvents(allEvents, themes), [allEvents, themes]);
  const svg = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ width: 900, height: 160 });
  const [view, setView] = useState<[number, number]>([startMs, endMs]);
  const viewRef = useRef(view);
  viewRef.current = view;
  const [hover, setHover] = useState<{ event: HistoricalEvent; x: number; y: number } | null>(null);
  const gesture = useRef<{ mode: "pan" | "scrub"; x: number; view: [number, number] } | null>(null);
  const animation = useRef(0);

  useEffect(() => {
    if (!svg.current) return;
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(svg.current);
    return () => observer.disconnect();
  }, []);

  const gutter = size.width < 560 ? 58 : 118;
  const tracks = collection.themes;
  const rowH = Math.max(MIN_ROW_H, (size.height - DENSITY_H - AXIS_H) / tracks.length);
  const rowY = (i: number) => DENSITY_H + i * rowH;
  const axisY = DENSITY_H + tracks.length * rowH;
  // UTC, like the dates themselves. A local-time scale put its ticks at local midnight, which in Vienna is
  // the previous day in UTC, so the labels differed between the build server and the browser.
  const x = useMemo(() => scaleUtc().domain([new Date(view[0]), new Date(view[1])]).range([gutter, Math.max(gutter + 1, size.width - PAD_R)]), [view, gutter, size.width]);
  const px = useCallback((iso: string) => x(new Date(toMs(iso))), [x]);

  const clamp = useCallback(
    ([a, b]: [number, number]): [number, number] => {
      const span = Math.min(endMs - startMs, Math.max(MIN_SPAN, b - a));
      const start = Math.min(endMs - span, Math.max(startMs, a));
      return [start, start + span];
    },
    [startMs, endMs],
  );

  /** Eases to a new range, so zoom buttons and cluster clicks keep their context. */
  const animateTo = useCallback(
    (target: [number, number]) => {
      cancelAnimationFrame(animation.current);
      const to = clamp(target);
      const from = viewRef.current;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setView(to);
      const begin = performance.now();
      const frame = (now: number) => {
        const t = Math.min(1, (now - begin) / 320);
        const ease = 1 - (1 - t) ** 3;
        setView([from[0] + (to[0] - from[0]) * ease, from[1] + (to[1] - from[1]) * ease]);
        if (t < 1) animation.current = requestAnimationFrame(frame);
      };
      animation.current = requestAnimationFrame(frame);
    },
    [clamp],
  );

  const zoomBy = useCallback(
    (factor: number, centerMs?: number) => {
      const [a, b] = viewRef.current;
      const c = centerMs ?? (a + b) / 2;
      animateTo([c - (c - a) * factor, c + (b - c) * factor]);
    },
    [animateTo],
  );

  // React's wheel handler is passive, and this one must stop the page scrolling.
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const [a, b] = viewRef.current;
      const rect = el.getBoundingClientRect();
      const plotW = rect.width - gutter - PAD_R;
      const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left - gutter) / plotW));
      const c = a + (b - a) * ratio;
      const factor = Math.exp(e.deltaY * 0.0015);
      cancelAnimationFrame(animation.current);
      setView(clamp([c - (c - a) * factor, c + (b - c) * factor]));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [gutter, clamp]);

  // Keep the selection on screen when it's chosen from another panel.
  useEffect(() => {
    if (!selectedId) return;
    const e = allEvents.find((ev) => ev.id === selectedId);
    if (!e) return;
    const [a, b] = viewRef.current;
    const s = toMs(e.when.start);
    if (s < a || s > b) animateTo([s - (b - a) / 2, s + (b - a) / 2]);
  }, [selectedId, allEvents, animateTo]);

  // Documentary playback: the date advances, then holds on each record it reaches.
  useEffect(() => {
    if (!playing) return;
    const msPerMs = (5 * YEAR) / 1000;
    let last = performance.now();
    let holdUntil = 0;
    let current = toMs(useAtlas.getState().date) || startMs;
    if (current >= toMs(events[events.length - 1]?.when.start ?? range.end)) {
      current = startMs;
      scrubTo(toIso(current));
    }
    let raf = 0;
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      if (now >= holdUntil) {
        const next = current + dt * msPerMs;
        const reached = events.find((e) => {
          const t = toMs(e.when.start);
          return t > current && t <= next;
        });
        if (reached) {
          current = toMs(reached.when.start);
          selectEvent(reached.id);
          holdUntil = now + 2600;
          if (reached.id === events[events.length - 1].id) {
            setPlaying(false);
            return;
          }
        } else {
          current = next;
          useAtlas.setState({ date: toIso(current) });
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, events, startMs, range.end, scrubTo, selectEvent, setPlaying]);

  const scrubFromPointer = (clientX: number) => {
    const rect = svg.current!.getBoundingClientRect();
    const p = Math.min(rect.width - PAD_R, Math.max(gutter, clientX - rect.left));
    setPlaying(false);
    scrubTo(toIso(x.invert(p).getTime()));
  };

  const query = fold(highlight.trim());
  const isMatch = (e: HistoricalEvent) => !query || fold(`${e.title.en} ${e.summary.en} ${placeLabel(e)} ${e.people.join(" ")}`).includes(query);
  const matchCount = query ? events.filter(isMatch).length : 0;

  // Records per time slice in this collection. This says nothing about how eventful the period really was.
  const density = useMemo(() => {
    const bins = new Array(Math.max(10, Math.floor((size.width - gutter) / 14))).fill(0) as number[];
    const [a, b] = view;
    for (const e of events) {
      const t = toMs(e.when.start);
      if (t >= a && t <= b) bins[Math.min(bins.length - 1, Math.floor(((t - a) / (b - a)) * bins.length))]++;
    }
    return bins;
  }, [events, view, size.width, gutter]);
  const densityMax = Math.max(1, ...density);

  // Long bars stay separate. Only point-like marks merge when they crowd together.
  const rows = useMemo(() => {
    return tracks.map((track) => {
      const items = events.filter((e) => trackOf(e) === track.id);
      const bars = items.filter((e) => temporalForm(e) === "process");
      const points = items.filter((e) => temporalForm(e) !== "process").map((e) => ({ e, cx: px(e.when.start) }));
      const groups: { items: typeof points; cx: number }[] = [];
      for (const p of points.sort((m, n) => m.cx - n.cx)) {
        const lastGroup = groups[groups.length - 1];
        if (lastGroup && p.cx - lastGroup.items[lastGroup.items.length - 1].cx < CLUSTER_PX) lastGroup.items.push(p);
        else groups.push({ items: [p], cx: p.cx });
      }
      for (const g of groups) g.cx = g.items.reduce((sum, i) => sum + i.cx, 0) / g.items.length;
      return { track, bars, groups };
    });
  }, [tracks, events, px]);

  const handleX = date ? px(date) : gutter;
  const year = date ? date.slice(0, 4) : "";
  const zoomed = view[1] - view[0] < endMs - startMs - YEAR;
  const selected = allEvents.find((e) => e.id === selectedId);
  const showTip = (event: HistoricalEvent, e: React.PointerEvent) => {
    const rect = svg.current!.getBoundingClientRect();
    setHover({ event, x: e.clientX - rect.left, y: e.clientY - rect.top });
  };
  const opacityFor = (e: HistoricalEvent) => {
    if (query && !isMatch(e)) return 0.2;
    return e.when.start <= date ? 1 : 0.5;
  };
  const iconButton = "grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line text-ink-2 hover:border-bronze hover:text-bronze";

  return (
    <section aria-label="Timeline" className="flex h-full flex-col border-t border-line px-3 pb-1 pt-2 sm:px-5 pointer-events-none">
      <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto">
        <button type="button" onClick={() => step(-1)} aria-label="Previous event" className={iconButton}>‹</button>
        <button type="button" onClick={() => setPlaying(!playing)} aria-label={playing ? "Pause playback" : "Play through events"} aria-pressed={playing} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-navy text-on-accent dark:bg-bronze">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden>{playing ? <path d="M2 1h3v10H2zM7 1h3v10H7z" /> : <path d="M2 1l9 5-9 5z" />}</svg>
        </button>
        <button type="button" onClick={() => step(1)} aria-label="Next event" className={iconButton}>›</button>
        <output data-testid="timeline-year" className="ml-1 font-serif text-2xl tabular-nums text-bronze">{year}</output>
        <p className="ml-2 hidden min-w-0 flex-1 truncate font-serif text-base text-ink md:block" data-testid="timeline-selected">{selected?.title.en}</p>
        <label className="ml-auto flex min-w-0 items-center gap-2 text-xs text-ink-2">
          <span className="sr-only">Highlight on timeline</span>
          <input value={highlight} onChange={(e) => setHighlight(e.target.value)} placeholder="Find…" className="w-20 rounded-full border border-line bg-transparent px-3 py-1 outline-none focus:border-bronze sm:w-32" />
          {query && <span role="status" className="hidden whitespace-nowrap sm:inline">{matchCount} found</span>}
        </label>
        <button type="button" onClick={() => zoomBy(0.6)} aria-label="Zoom in on timeline" className={iconButton}>+</button>
        <button type="button" onClick={() => zoomBy(1 / 0.6)} aria-label="Zoom out on timeline" className={iconButton}>−</button>
        <button type="button" disabled={!zoomed} onClick={() => animateTo([startMs, endMs])} className="hidden shrink-0 text-xs text-bronze underline-offset-2 hover:underline disabled:invisible sm:inline">Reset</button>
      </div>

      <div className="relative min-h-0 flex-1 pointer-events-auto z-10 bg-paper-2">
        <svg
          ref={svg}
          // A focusable control with a value, so screen readers need it announced as a slider.
          role="slider"
          tabIndex={0}
          aria-label="Timeline date. Left and right arrows move between records, plus and minus zoom, Home and End jump to the ends."
          aria-valuemin={Number(range.start.slice(0, 4))}
          aria-valuemax={Number(range.end.slice(0, 4))}
          aria-valuenow={Number(year) || undefined}
          aria-valuetext={selected ? `${date}, ${selected.title.en}` : date}
          className="h-full w-full select-none pointer-events-auto"
          style={{ touchAction: "none" }}
          onPointerDown={(e) => {
            if ((e.target as Element).closest("[data-mark],[data-track-label],[data-event],[data-cluster]")) return;
            const rect = svg.current!.getBoundingClientRect();
            const y = e.clientY - rect.top;
            const inRail = y < DENSITY_H || y > axisY;
            svg.current!.setPointerCapture(e.pointerId);
            gesture.current = { mode: inRail ? "scrub" : "pan", x: e.clientX, view };
            if (inRail) scrubFromPointer(e.clientX);
          }}
          onPointerMove={(e) => {
            const g = gesture.current;
            if (!g) return;
            if (g.mode === "scrub") return scrubFromPointer(e.clientX);
            const plotW = size.width - gutter - PAD_R;
            const dt = ((g.x - e.clientX) / plotW) * (g.view[1] - g.view[0]);
            setView(clamp([g.view[0] + dt, g.view[1] + dt]));
          }}
          onPointerUp={() => (gesture.current = null)}
          onKeyDown={(e) => {
            const [a, b] = view;
            const keys: Record<string, () => void> = {
              ArrowLeft: () => (e.shiftKey ? animateTo([a - (b - a) * 0.2, b - (b - a) * 0.2]) : step(-1)),
              ArrowRight: () => (e.shiftKey ? animateTo([a + (b - a) * 0.2, b + (b - a) * 0.2]) : step(1)),
              "+": () => zoomBy(0.6),
              "=": () => zoomBy(0.6),
              "-": () => zoomBy(1 / 0.6),
              Home: () => {
                const list = visibleEvents(eventsByDate, []);
                console.log('[DEBUG Timeline] Home key - eventsByDate length:', eventsByDate.length, 'last:', eventsByDate[eventsByDate.length - 1]?.id, 'visible list length:', list.length, 'last visible:', list[list.length - 1]?.id);
                if (list.length) selectEvent(list[0].id);
              },
              End: () => {
                const list = visibleEvents(eventsByDate, []);
                console.log('[DEBUG Timeline] End key - eventsByDate length:', eventsByDate.length, 'last:', eventsByDate[eventsByDate.length - 1]?.id, 'visible list length:', list.length, 'last visible:', list[list.length - 1]?.id);
                if (list.length) selectEvent(list[list.length - 1].id);
              },
            };
            if (keys[e.key]) {
              e.preventDefault();
              keys[e.key]();
            }
          }}
        >
          <defs>
            <clipPath id="tl-plot"><rect x={gutter} y={0} width={Math.max(0, size.width - gutter - PAD_R)} height={size.height} /></clipPath>
            <pattern id="tl-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill="var(--navy)" opacity="0.28" />
              <line x1="0" y1="0" x2="0" y2="6" stroke="var(--navy)" strokeWidth="2" opacity="0.55" />
            </pattern>
          </defs>

          <text x={0} y={DENSITY_H - 4} fontSize={12} fill="var(--ink-2)">{size.width < 560 ? "Records" : "Records in collection"}</text>
          <g clipPath="url(#tl-plot)" className="cursor-ew-resize">
            <rect x={gutter} y={0} width={size.width} height={DENSITY_H} fill="transparent" />
            {density.map((count, i) => {
              const w = (size.width - gutter - PAD_R) / density.length;
              const h = (count / densityMax) * (DENSITY_H - 3);
              return count > 0 ? <rect key={i} x={gutter + i * w} y={DENSITY_H - 2 - h} width={Math.max(1, w - 1)} height={h} fill="var(--bronze-soft)" opacity={0.6} /> : null;
            })}
          </g>

          {rows.map(({ track }, i) => {
            const on = themes.length === 0 || themes.includes(track.id);
            const label = rowH < 24 ? track.label.en.split(" ")[0] : track.label.en;
            return (
              <g key={track.id} data-track-label={track.id} className="cursor-pointer" onClick={() => toggleTheme(track.id)}>
                <title>{`Show or hide ${track.label.en}`}</title>
                <rect x={0} y={rowY(i)} width={gutter} height={rowH} fill="transparent" />
                <text x={0} y={rowY(i) + rowH / 2 + 3.5} fontSize={size.width < 560 ? 9.5 : 11} fontWeight={themes.includes(track.id) ? 600 : 400} fill={on ? "var(--ink)" : "var(--ink-2)"} opacity={on ? 1 : 0.5}>
                  {label}
                </text>
              </g>
            );
          })}

          <g clipPath="url(#tl-plot)">
            {rows.map((_, i) => <line key={i} x1={gutter} x2={size.width} y1={rowY(i) + rowH} y2={rowY(i) + rowH} stroke="var(--line)" strokeOpacity={0.45} />)}
            {collection.periods.map((p) => {
              const x0 = px(p.start);
              const x1 = px(p.end);
              return (
                <g key={p.id}>
                  <title>{p.note ? `${p.label.en}. ${p.note}` : p.label.en}</title>
                  <rect x={x0} y={axisY + 1} width={Math.max(0, x1 - x0 - 2)} height={14} fill="var(--paper-3)" />
                  <text x={Math.max(x0, gutter) + 5} y={axisY + 11} fontSize={9.5} fill="var(--ink-2)">{x1 - x0 > 76 ? p.label.en : ""}</text>
                </g>
              );
            })}
            {x.ticks(size.width < 560 ? 3 : 5).map((t) => (
              <text key={t.getTime()} x={x(t)} y={axisY + 28} fontSize={12} textAnchor="middle" fill="var(--ink-2)">{t.getUTCFullYear()}</text>
            ))}

            {rows.map(({ track, bars, groups }, i) => {
              const cy = rowY(i) + rowH / 2;
              return (
                <g key={track.id}>
                  {bars.map((e) => {
                    const a = px(e.when.start);
                    const b = px(endOf(e));
                    const isSel = e.id === selectedId;
                    const fuzzy = e.when.precision === "year";
                    const fade = fuzzy ? Math.min((b - a) / 3, Math.abs(x(new Date(toMs(e.when.start) + YEAR)) - a)) : 0;
                    return (
                      <g key={e.id} data-mark data-event={e.id} data-form="process" opacity={opacityFor(e)} className="cursor-pointer" pointerEvents="all" onClick={() => { setPlaying(false); selectEvent(e.id); }} onPointerMove={(p) => showTip(e, p)} onPointerLeave={() => setHover(null)}>
                        <rect x={a} y={cy - 7} width={Math.max(6, b - a)} height={14} fill="transparent" pointerEvents="all" />
                        <rect x={a + fade} y={cy - 4} width={Math.max(4, b - a - 2 * fade)} height={8} fill="url(#tl-hatch)" stroke={isSel ? "var(--oxblood)" : "var(--navy)"} strokeWidth={isSel ? 2 : 1} />
                        {fuzzy && <>
                          <rect x={a} y={cy - 4} width={fade} height={8} fill="var(--navy)" opacity={0.18} />
                          <rect x={b - fade} y={cy - 4} width={fade} height={8} fill="var(--navy)" opacity={0.18} />
                        </>}
                      </g>
                    );
                  })}
                  {groups.map((g) => {
                    if (g.items.length > 1) {
                      const hasSelected = g.items.some((p) => p.e.id === selectedId);
                      const label = g.items.map((p) => p.e.title.en).join("; ");
                      return (
                        <g
                          key={g.items[0].e.id}
                          data-mark
                          data-cluster={g.items.length}
                          className="cursor-zoom-in"
                          pointerEvents="all"
                          onClick={() => {
                            const ts = g.items.map((p) => toMs(p.e.when.start));
                            const margin = Math.max(YEAR, (Math.max(...ts) - Math.min(...ts)) * 0.6);
                            animateTo([Math.min(...ts) - margin, Math.max(...ts) + margin]);
                          }}
                        >
                          <title>{`${g.items.length} records, click to zoom: ${label}`}</title>
                          <circle cx={g.cx} cy={cy} r={8} fill={hasSelected ? "var(--oxblood)" : "var(--navy)"} pointerEvents="all" />
                          <text x={g.cx} y={cy + 3.5} fontSize={12} fontWeight={600} textAnchor="middle" fill="var(--on-accent)">{g.items.length}</text>
                        </g>
                      );
                    }
                    const { e, cx } = g.items[0];
                    const form = temporalForm(e);
                    const isSel = e.id === selectedId;
                    const color = isSel ? "var(--oxblood)" : "var(--navy)";
                    const matched = query && isMatch(e);
                    return (
                      <g key={e.id} data-mark data-event={e.id} data-form={form} opacity={opacityFor(e)} className="cursor-pointer" pointerEvents="all" onClick={() => { setPlaying(false); selectEvent(e.id); }} onPointerMove={(p) => showTip(e, p)} onPointerLeave={() => setHover(null)}>
                        <circle cx={cx} cy={cy} r={12} fill="var(--navy)" opacity="0.01" pointerEvents="all" />
                        {matched && <circle cx={cx} cy={cy} r={9} fill="none" stroke="var(--bronze)" strokeWidth={2} />}
                        {isSel && <circle cx={cx} cy={cy} r={8.5} fill="none" stroke="var(--oxblood)" strokeWidth={1.5} />}
                        {form === "exact" && <circle cx={cx} cy={cy} r={isSel ? 5.5 : 4.5} fill={color} />}
                        {form === "range" && <rect x={cx - 1} y={cy - 3} width={Math.max(8, px(endOf(e)) - cx + 2)} height={6} rx={3} fill={color} />}
                        {form === "approximate" && <>
                          <rect x={cx - 1} y={cy - 6} width={Math.max(8, px(endOf(e)) - cx)} height={12} fill={color} opacity={0.2} />
                          <circle cx={cx + Math.max(3, (px(endOf(e)) - cx) / 2)} cy={cy} r={4} fill="var(--paper-2)" stroke={color} strokeWidth={1.8} />
                        </>}
                      </g>
                    );
                  })}
                </g>
              );
            })}

            <line x1={handleX} x2={handleX} y1={0} y2={axisY + 15} stroke="var(--bronze)" strokeWidth={1.5} pointerEvents="none" />
            <path d={`M${handleX - 5} 0h10l-5 6z`} fill="var(--bronze)" pointerEvents="none" />
          </g>
        </svg>

        {hover && (
          <div role="presentation" className="pointer-events-none absolute z-30 w-64 border border-line bg-paper-2 p-3 shadow-xl" style={{ left: Math.min(hover.x + 12, size.width - 270), bottom: size.height - hover.y + 10 }}>
            <p className="text-xs text-ink-2">{formatWhen(hover.event.when)}, {placeLabel(hover.event)}</p>
            <p className="font-serif text-base leading-snug">{hover.event.title.en}</p>
            <p className="mt-1 line-clamp-3 text-xs text-ink-2">{hover.event.summary.en}</p>
          </div>
        )}
      </div>

      <ul aria-label="Timeline legend" className="mt-0.5 hidden flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-ink-2 md:flex pointer-events-none">
        <li className="flex items-center gap-1.5"><svg width="10" height="10" aria-hidden><circle cx="5" cy="5" r="4" fill="var(--navy)" /></svg>Exact date</li>
        <li className="flex items-center gap-1.5"><svg width="16" height="10" aria-hidden><rect x="1" y="2" width="14" height="6" rx="3" fill="var(--navy)" /></svg>Date range</li>
        <li className="flex items-center gap-1.5"><svg width="14" height="12" aria-hidden><rect width="14" height="12" fill="var(--navy)" opacity="0.2" /><circle cx="7" cy="6" r="3.5" fill="var(--paper-2)" stroke="var(--navy)" strokeWidth="1.6" /></svg>Year known only</li>
        <li className="flex items-center gap-1.5"><svg width="24" height="10" aria-hidden><rect x="1" y="1" width="22" height="8" fill="var(--navy)" opacity="0.4" stroke="var(--navy)" /></svg>Process (faded ends: approximate)</li>
        <li className="flex items-center gap-1.5"><svg width="14" height="14" aria-hidden><circle cx="7" cy="7" r="6.5" fill="var(--navy)" /><text x="7" y="10" fontSize="8" textAnchor="middle" fill="var(--on-accent)">2</text></svg>Grouped, click to zoom</li>
        <li className="flex items-center gap-1.5"><svg width="10" height="12" aria-hidden><line x1="5" x2="5" y1="0" y2="12" stroke="var(--bronze)" strokeWidth="2" /></svg>Selected date</li>
        <li className="flex items-center gap-1.5"><svg width="12" height="12" aria-hidden><circle cx="6" cy="6" r="5" fill="none" stroke="var(--oxblood)" strokeWidth="1.5" /><circle cx="6" cy="6" r="2.5" fill="var(--oxblood)" /></svg>Selected record</li>
        <li className="ml-auto hidden lg:block">Rows show themes, not importance. Bars above: records in this collection, not how eventful a period was. Scroll to zoom, drag to pan.</li>
      </ul>

      <ul className="sr-only" data-testid="event-list" aria-label="All records in date order">
        {events.map((e) => (
          <li key={e.id}>
            <button type="button" aria-pressed={e.id === selectedId} onClick={() => { setPlaying(false); selectEvent(e.id); }}>{`${e.title.en}, ${e.when.start.slice(0, 4)}`}</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
