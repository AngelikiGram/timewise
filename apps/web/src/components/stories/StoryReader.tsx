"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { formatImportedDate, formatYear, yearOf, type Precision } from "@/lib/dates";
import type { Activity } from "@/lib/lessons";
import { asset } from "@/lib/paths";
import { saveStoryStep, useProgress } from "@/lib/progress";
import { fetchRecord, type RecordData } from "@/lib/record";
import { applyBasemapPalette, STYLE_URL } from "../AtlasMap";
import { categoryIcon, Icon } from "../icons";
import { ActivityView } from "../lessons/activities";
import { SaveButton } from "../ui";

export type StoryRecord = { id: string; title: { en: string }; description: string; category: string; start: string; end?: string; precision: Precision; lng: number; lat: number; links: number; home: string; url: string; loc?: string };
export type GeneratedStory = { id: string; title: string; kind: "country" | "continent"; region: string; regionLabel: string; era: string; eraLabel: string; from: number; to: number; count: number; why: string; chapters: { label: string; records: StoryRecord[] }[] };
export type StoryEntry = Omit<GeneratedStory, "why" | "chapters">;

let index: Promise<{ stories: StoryEntry[]; labels: Record<string, string> }> | null = null;
export const loadStoryIndex = () => (index ??= fetch(asset("/data/stories/index.json")).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))).catch((e) => { index = null; throw e; }));
const loadStory = (id: string) => fetch(asset(`/data/stories/${id}.json`)).then((r) => (r.ok ? (r.json() as Promise<GeneratedStory>) : Promise.reject(new Error(String(r.status)))));

const when = (r: StoryRecord) => formatImportedDate(r.start, r.end, r.precision);
const LOC: Record<string, string> = { event: "exact point", place: "at its named place", area: "centre of an area" };

function StoryMap({ records, current, onPick }: { records: StoryRecord[]; current: number; onPick: (i: number) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const pick = useRef(onPick);
  pick.current = onPick;

  useEffect(() => {
    let m: MapLibreMap | undefined;
    let cancelled = false;
    (async () => {
      const ml = (await import("maplibre-gl")).default;
      if (cancelled || !box.current) return;
      m = new ml.Map({ container: box.current, style: STYLE_URL, center: [records[0].lng, records[0].lat], zoom: 3, attributionControl: { compact: true } });
      map.current = m;
      m.addControl(new ml.NavigationControl({ showCompass: false }), "top-right");
      m.once("style.load", () => {
        const dark = document.documentElement.dataset.theme === "dark";
        applyBasemapPalette(m!, dark ? "dark" : "light");
        m!.addSource("st", { type: "geojson", data: { type: "FeatureCollection", features: records.map((r, i) => ({ type: "Feature", properties: { i, n: String(i + 1) }, geometry: { type: "Point", coordinates: [r.lng, r.lat] } })) } });
        m!.addLayer({ id: "st-dots", type: "circle", source: "st", paint: { "circle-radius": 11, "circle-color": dark ? "#2a3142" : "#f8f1e3", "circle-stroke-width": 2, "circle-stroke-color": "#8a5a1c" } });
        m!.addLayer({ id: "st-now", type: "circle", source: "st", filter: ["==", ["get", "i"], -1], paint: { "circle-radius": 15, "circle-color": "#8a2f24", "circle-stroke-width": 3, "circle-stroke-color": dark ? "#1c2230" : "#f8f1e3" } });
        m!.addLayer({ id: "st-num", type: "symbol", source: "st", layout: { "text-field": ["get", "n"], "text-font": ["Noto Sans Regular"], "text-size": 11, "text-allow-overlap": true, "text-ignore-placement": true }, paint: { "text-color": dark ? "#ebe4d4" : "#3a2d1c" } });
        m!.on("click", "st-dots", (e) => { const i = e.features?.[0]?.properties?.i; if (typeof i === "number") pick.current(i); });
        m!.on("mouseenter", "st-dots", () => { m!.getCanvas().style.cursor = "pointer"; });
        m!.on("mouseleave", "st-dots", () => { m!.getCanvas().style.cursor = ""; });
        setReady(true);
      });
    })();
    return () => { cancelled = true; m?.remove(); map.current = null; };
  }, [records]);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    m.setFilter("st-now", ["==", ["get", "i"], current]);
    m.setPaintProperty("st-num", "text-color", ["case", ["==", ["get", "i"], current], "#ffffff", document.documentElement.dataset.theme === "dark" ? "#ebe4d4" : "#3a2d1c"]);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const wide = window.matchMedia("(min-width: 1024px)").matches;
    const pad = wide ? { top: 80, bottom: 140, left: Math.min(640, window.innerWidth * 0.44) + 40, right: 80 } : { top: 30, bottom: 30, left: 30, right: 30 };
    if (current < 0) {
      const xs = records.map((r) => r.lng), ys = records.map((r) => r.lat);
      m.fitBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]], { padding: pad, maxZoom: 7, duration: reduce ? 0 : 900 });
    } else {
      const r = records[current];
      m.flyTo({ center: [r.lng, r.lat], zoom: Math.max(5, Math.min(m.getZoom() + 0.5, 7)), padding: pad, duration: reduce ? 0 : 1200 });
    }
  }, [ready, current, records]);

  return <div className="absolute inset-0"><div ref={box} className="h-full w-full" data-testid="story-map" data-ready={ready} /></div>;
}

/** The records across the bottom, numbered, by date. */
function Strip({ records, current, onPick }: { records: StoryRecord[]; current: number; onPick: (i: number) => void }) {
  const lo = yearOf(records[0].start), hi = yearOf(records[records.length - 1].start);
  const span = Math.max(1, hi - lo);
  const rows: number[] = [];
  const xs = records.map((r) => 3 + ((yearOf(r.start) - lo) / span) * 94);
  // Up to three rows: each marker takes the lowest row with room, so close dates never overlap.
  xs.forEach((x, i) => { rows[i] = [0, 1, 2].find((r) => !xs.slice(0, i).some((y, j) => rows[j] === r && Math.abs(y - x) < 2.6)) ?? 2; });
  return (
    <div className="relative h-[5.5rem]" role="group" aria-label="The story's records in time" data-testid="story-strip">
      <span aria-hidden className="absolute inset-x-0 top-[3.6rem] h-px bg-ink-2/40" />
      <span aria-hidden className="absolute left-0 top-[4.2rem] text-xs tabular-nums text-ink-2">{formatYear(lo)}</span>
      <span aria-hidden className="absolute right-0 top-[4.2rem] text-xs tabular-nums text-ink-2">{formatYear(hi)}</span>
      {records.map((r, i) => (
        <button
          key={r.id}
          type="button"
          onClick={() => onPick(i)}
          aria-current={i === current ? "step" : undefined}
          aria-label={`${i + 1}. ${r.title.en}, ${when(r)}`}
          title={`${r.title.en} · ${when(r)}`}
          className={`absolute grid -translate-x-1/2 place-items-center rounded-full text-xs font-semibold tabular-nums transition-colors focus-visible:ring-2 focus-visible:ring-bronze ${i === current ? "h-8 w-8 bg-oxblood text-white" : "h-7 w-7 border border-bronze bg-paper-2 text-ink hover:bg-bronze-soft"}`}
          style={{ left: `${xs[i]}%`, top: 40 - rows[i] * 20 }}
        >
          {i + 1}
        </button>
      ))}
    </div>
  );
}

export function StoryReader() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("id") ?? "";
  const [story, setStory] = useState<GeneratedStory | null | undefined>(undefined);
  const [entries, setEntries] = useState<StoryEntry[]>([]);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [step, setStep] = useState(-1);
  const [detail, setDetail] = useState<RecordData | null>(null);
  const progress = useProgress();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setStory(undefined);
    setStep(-1);
    loadStory(id).then(setStory, () => setStory(null));
    loadStoryIndex().then((d) => { setEntries(d.stories); setLabels(d.labels); }, () => {});
  }, [id]);

  const records = useMemo(() => story?.chapters.flatMap((c) => c.records) ?? [], [story]);
  const chapterOf = (i: number) => story ? story.chapters.findIndex((c) => c.records.includes(records[i])) : 0;
  const end = records.length;
  const go = useCallback((n: number) => setStep(Math.max(-1, Math.min(end, n))), [end]);

  // Live details for the record in view: Wikipedia summary and a Commons image, both attributed.
  useEffect(() => {
    setDetail(null);
    if (step < 0 || step >= end) return;
    const ac = new AbortController();
    fetchRecord(records[step].id, ac.signal).then(setDetail, () => {});
    return () => ac.abort();
  }, [step, end, records]);

  useEffect(() => {
    if (!story || step < 0) return;
    saveStoryStep(story.id, story.chapters[Math.max(0, chapterOf(Math.min(step, end - 1)))].label, Math.min(step + 1, end), step >= end, Math.min(step + 1, end));
    panel.current?.scrollTo({ top: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, story]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input, textarea, select")) return;
      if (e.key === "ArrowRight") go(step + 1);
      if (e.key === "ArrowLeft") go(step - 1);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [go, step]);

  const quiz = useMemo<Activity | null>(() => {
    if (records.length < 4) return null;
    const picks = [0, Math.floor(records.length / 3), Math.floor((2 * records.length) / 3), records.length - 1].map((i) => records[i]);
    return {
      kind: "order", skill: "chronology", prompt: "Put four of this story's records in order, earliest first.",
      items: picks.map((r) => ({ id: r.id, label: r.title.en, when: when(r) })),
      explanation: picks.map((r) => `${r.title.en}: ${when(r)}`).join(". ") + ". Dates are Wikidata's.",
      sources: picks.map((r) => ({ label: `Wikidata: ${r.title.en}`, url: r.url })),
    };
  }, [records]);

  const next = useMemo(() => {
    if (!story) return [];
    const eras = ["antiquity", "middle-ages", "early-modern", "long-19th", "world-wars", "since-1945"];
    const later = entries.find((e) => e.region === story.region && eras.indexOf(e.era) === eras.indexOf(story.era) + 1);
    const same = entries.filter((e) => e.era === story.era && e.id !== story.id && e.kind === story.kind).sort((a, b) => a.id.localeCompare(b.id)).slice(0, 2);
    return [later, ...same].filter(Boolean) as StoryEntry[];
  }, [entries, story]);

  if (story === null) {
    return <div className="mx-auto max-w-xl px-4 py-16 text-center"><p className="font-serif text-2xl">This story doesn&rsquo;t exist.</p><Link href="/stories" className="btn btn-primary mt-4">All stories</Link></div>;
  }
  if (!story) return <div className="grid h-[60dvh] place-items-center text-ink-2" role="status">Loading the story…</div>;

  const r = step >= 0 && step < end ? records[step] : null;
  const ch = r ? chapterOf(step) : -1;
  const pct = Math.round(((step + 1) / (end + 1)) * 100);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col lg:block" data-testid="story-reader">
      <div className="relative h-[36dvh] shrink-0 lg:absolute lg:inset-0 lg:h-auto">
        <StoryMap records={records} current={r ? step : -1} onPick={(i) => go(i)} />
      </div>

      <article ref={panel} className="relative z-10 min-h-0 flex-1 overflow-y-auto border-t border-line bg-paper lg:absolute lg:bottom-36 lg:left-5 lg:top-5 lg:w-[min(620px,44vw)] lg:rounded-2xl lg:border lg:shadow-[0_18px_50px_-24px_rgb(0_0_0/0.5)]" aria-live="polite">
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-paper/95 px-5 py-2.5 backdrop-blur">
          <Link href="/stories" className="btn btn-ghost btn-icon" aria-label="All stories"><Icon name="back" size={18} /></Link>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-line" role="progressbar" aria-label="Story progress" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-bronze transition-[width]" style={{ width: `${pct}%` }} /></div>
          <span className="text-xs tabular-nums text-ink-2">{Math.max(0, Math.min(step + 1, end))}/{end}</span>
        </div>

        <div className="p-5 sm:p-7" key={step}>
          {step < 0 && (
            <section className="fade-in" data-testid="story-intro">
              <p className="eyebrow">Generated story · {story.count} records</p>
              <h1 className="mt-2 font-serif text-4xl leading-tight">{story.title}</h1>
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-dashed border-line px-3 py-1 text-xs text-ink-2"><Icon name="info" size={14} />Assembled automatically from Wikidata · not checked by hand</p>
              <ol className="mt-6 grid gap-3">
                {story.chapters.map((c, i) => (
                  <li key={c.label} className="flex gap-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-bronze-soft font-serif">{i + 1}</span>
                    <span className="min-w-0"><span className="block text-sm font-semibold">{c.label}</span><span className="block truncate text-sm text-ink-2">{c.records.map((x) => x.title.en).join(" · ")}</span></span>
                  </li>
                ))}
              </ol>
              <details className="mt-5 text-sm text-ink-2"><summary className="cursor-pointer hover:text-ink">How these records were chosen</summary><p className="mt-1">{story.why} Titles, dates, places and descriptions are Wikidata&rsquo;s; nothing here is written by TIMEWISE, and it isn&rsquo;t a narrative of cause and effect.</p></details>
              <button type="button" className="btn btn-primary mt-6" onClick={() => go(0)} data-testid="story-start">Start</button>
            </section>
          )}

          {r && (
            <section className="fade-in" data-testid="story-step">
              <p className="eyebrow">Chapter {ch + 1} of {story.chapters.length} · {story.chapters[ch].label}</p>
              <h1 className="mt-2 font-serif text-3xl leading-tight sm:text-4xl" data-testid="story-title">{r.title.en}</h1>
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-bronze-soft/60 px-3 py-1"><Icon name="timeline" size={14} />{when(r)}</span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-paper-3 px-3 py-1"><Icon name={categoryIcon(r.category)} size={14} />{story.kind === "continent" ? labels[r.home] ?? "" : story.regionLabel}</span>
              </div>
              {detail?.image && (
                <figure className="mt-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={detail.image.url} alt={r.title.en} className="max-h-72 w-full rounded-xl object-cover" />
                  <figcaption className="mt-1 truncate text-[11px] text-ink-2">Image: {detail.image.artist ?? "Wikimedia Commons"}{detail.image.license ? ` · ${detail.image.license}` : ""} · <a className="link" href={detail.image.page} target="_blank" rel="noopener noreferrer">source</a></figcaption>
                </figure>
              )}
              <p className="mt-4 text-lg leading-relaxed">{r.description[0].toUpperCase() + r.description.slice(1)}.</p>
              {detail?.summary && (
                <details className="mt-3 rounded-xl bg-paper-3/60 p-3 text-[0.95rem]">
                  <summary className="cursor-pointer font-semibold">Read more</summary>
                  <p className="mt-2 leading-relaxed">{detail.summary.text}</p>
                  <p className="mt-1 text-xs text-ink-2">Wikipedia, <a className="link" href={detail.summary.url} target="_blank" rel="noopener noreferrer">{detail.summary.title} ↗</a>, CC BY-SA 4.0. Not checked by TIMEWISE.</p>
                </details>
              )}
              <details className="mt-3 text-sm text-ink-2">
                <summary className="cursor-pointer hover:text-ink">Source and why it&rsquo;s here</summary>
                <p className="mt-1">Record: <a className="link" href={r.url} target="_blank" rel="noopener noreferrer">Wikidata {r.id} ↗</a> (CC0). Location: {r.loc ? LOC[r.loc] : "from Wikidata"}. It&rsquo;s in this story because it&rsquo;s among the records of this place and era written about in the most Wikipedia languages ({r.links}).</p>
              </details>
              <div className="mt-6 flex flex-wrap items-center gap-2">
                <button type="button" className="btn btn-secondary" onClick={() => go(step - 1)}><Icon name="back" size={16} />Back</button>
                <button type="button" className="btn btn-primary" onClick={() => go(step + 1)} data-testid="story-next">{step + 1 === end ? "Finish" : "Next"}<Icon name="forward" size={16} /></button>
                <span className="ml-auto flex gap-2">
                  <SaveButton id={r.id} title={r.title.en} href={`/connections?id=${r.id}`} start={r.start} compact />
                  <Link href={`/connections?id=${r.id}`} className="btn btn-ghost btn-sm"><Icon name="network" size={16} />Connections</Link>
                </span>
              </div>
            </section>
          )}

          {step >= end && (
            <section className="fade-in space-y-6" data-testid="story-end">
              <div>
                <p className="eyebrow">Story complete</p>
                <h1 className="mt-2 font-serif text-3xl leading-tight">{story.title}</h1>
              </div>
              <ol className="space-y-1.5 border-l-2 border-bronze/50 pl-4 text-sm">
                {records.map((x, i) => <li key={x.id}><button type="button" className="text-left hover:text-bronze" onClick={() => go(i)}><span className="tabular-nums text-ink-2">{when(x)}</span> · {x.title.en}</button></li>)}
              </ol>
              {quiz && <ActivityView activity={quiz} seed={story.id.length + 3} onAnswer={() => {}} onNext={() => panel.current?.scrollTo({ top: panel.current.scrollHeight, behavior: "smooth" })} nextLabel="See what's next" />}
              {next.length > 0 && (
                <div>
                  <h2 className="font-serif text-xl">Next</h2>
                  <ul className="mt-2 grid gap-2">
                    {next.map((n) => <li key={n.id}><button type="button" className="card card-link flex w-full items-center gap-3 p-3 text-left" onClick={() => router.push(`/stories/read?id=${n.id}`)}><Icon name={n.kind === "country" ? "place" : "map"} size={20} className="text-bronze" /><span className="flex-1 font-serif text-lg">{n.title}</span><Icon name="forward" size={16} /></button></li>)}
                  </ul>
                </div>
              )}
              <button type="button" className="btn btn-secondary" onClick={() => go(-1)}>Start again</button>
            </section>
          )}
        </div>
      </article>

      <div className="z-10 border-t border-line bg-paper-2/95 px-4 pb-3 pt-2 backdrop-blur lg:absolute lg:inset-x-5 lg:bottom-4 lg:rounded-2xl lg:border">
        <Strip records={records} current={r ? step : -1} onPick={(i) => go(i)} />
      </div>
      {progress.stories[story.id]?.finished && step < 0 && <p className="sr-only">You have finished this story before.</p>}
    </div>
  );
}
