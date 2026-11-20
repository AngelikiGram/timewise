"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { formatYear } from "@/lib/dates";
import { recordStory } from "@/lib/explorer";
import { addCards, storyCards } from "@/lib/memory";
import { loadStory, searchEntities, wdUrl, type LiveStory as Story, type StoryStep } from "@/lib/live";
import { enrich, type Enrichment } from "@/lib/wikidata";
import { Icon } from "../icons";
import { ExploreMap, type MapItem } from "../modes/ExploreMap";
import { BadgeToast } from "../modes/Gamify";
import { StoryDiscover } from "./StoryDiscover";
import { MoreSources } from "../modes/MoreSources";
import { Working } from "../modes/Working";

const GROUP: Record<StoryStep["group"], { title: string; icon: "cause" | "parts" | "sequence" }> = {
  before: { title: "What led to it", icon: "cause" },
  parts: { title: "How it unfolded", icon: "parts" },
  after: { title: "What came after", icon: "sequence" },
};

/**
 * A story made on the spot from Wikidata, for any event: what led to it, its parts in date order, and what
 * followed, each step joined to the event by a statement. The summary is Wikipedia's, quoted under its licence.
 */
export function LiveStoryView() {
  const sp = useSearchParams();
  const q = sp.get("q"), find = sp.get("find");
  if (q && /^Q\d+$/.test(q)) return <Teller qid={q} key={q} />;
  if (find) return <Find words={find} key={find} />;
  return <Frame><p className="text-ink-2">Search for an event above, or press Surprise me.</p></Frame>;
}

function Find({ words }: { words: string }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    const ac = new AbortController();
    searchEntities(words, ac.signal, 1).then((h) => { if (h[0]) router.replace(`/stories/live?q=${h[0].id}`); else setErr(`Nothing on Wikidata matches “${words}”.`); }, (e: Error) => { if (e.name !== "AbortError") setErr(e.message); });
    return () => ac.abort();
  }, [words, router]);
  return <Frame>{err ? <p role="alert" className="text-ink-2">{err}</p> : <p role="status" className="text-ink-2">Finding “{words}” on Wikidata…</p>}</Frame>;
}

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6">
    <Link href="/stories" className="btn btn-ghost btn-sm !px-2"><Icon name="back" size={15} />All stories</Link>
    <div className="mt-3"><StoryDiscover compact /></div>
    <div className="mt-6">{children}</div>
  </div>
);

function Teller({ qid }: { qid: string }) {
  const [story, setStory] = useState<Story | null>(null);
  const [more, setMore] = useState<Enrichment | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [i, setI] = useState(-1);
  useEffect(() => {
    const ac = new AbortController();
    loadStory(qid, ac.signal).then(setStory, (e: Error) => { if (e.name !== "AbortError") setErr(e.message); });
    enrich(qid, ac.signal).then(setMore, () => {});
    return () => ac.abort();
  }, [qid]);
  useEffect(() => { if (story) recordStory(`live-${qid}`, story.label); }, [story, qid]);
  // Reaching the last step turns the story into review questions.
  useEffect(() => {
    if (!story || !story.steps.length || i !== story.steps.length - 1) return;
    addCards(storyCards(story.steps.filter((s) => s.year != null).map((s) => ({ id: s.id, title: s.label, year: s.year! })), { kind: "story", title: story.label, href: `/stories/live?q=${qid}` }));
  }, [i, story, qid]);
  const steps = story?.steps ?? [];
  const groups = useMemo(() => (["before", "parts", "after"] as const).map((g) => ({ g, steps: steps.map((s, n) => ({ s, n })).filter((x) => x.s.group === g) })).filter((x) => x.steps.length), [steps]);
  const items: MapItem[] = useMemo(() => [
    ...(story?.point ? [{ id: qid, label: story.label, lng: story.point[0], lat: story.point[1], layer: "event", year: story.year, sub: story.year != null ? formatYear(story.year) : undefined }] : []),
    ...steps.filter((s) => s.point).map((s) => ({ id: s.id, label: s.label, lng: s.point![0], lat: s.point![1], layer: s.group, year: s.year, sub: [s.year != null ? formatYear(s.year) : null, `${s.relation} ${story?.label ?? "it"}`].filter(Boolean).join(" · "), links: [{ href: `/stories/live?q=${s.id}`, label: "Tell this as a story" }, { href: s.source, label: "Source", external: true }] })),
  ], [steps, story, qid]);

  if (err) return <Frame><p role="alert" className="rounded-xl border border-line bg-paper-2 p-4 text-ink-2">{err}</p></Frame>;
  if (!story) return <Frame><Working title={more?.summary?.title ?? "A story from Wikidata"} preview={more} steps={[
    { label: "Reading the event", state: more ? "done" : "doing" },
    { label: "What led to it, its parts and what followed", state: more ? "doing" : "todo" },
    { label: "Placing the steps on the map", state: "todo" },
  ]} /></Frame>;
  const cur = i >= 0 ? steps[i] : null;

  return (
    <Frame>
      <BadgeToast />
      <article data-testid="live-story">
        <p className="eyebrow">A story made just now from Wikidata</p>
        <h1 className="mt-1 font-serif text-4xl leading-tight">{story.label}</h1>
        <p className="mt-1 text-ink-2">{[story.description, story.year != null ? formatYear(story.year) : null].filter(Boolean).join(" · ")}</p>
        <Link href={`/explore/why?q=${qid}`} className="btn btn-secondary btn-sm mt-3"><Icon name="cause" size={15} />Why did this happen? See the network</Link>

        <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            {more?.image && (
              <figure className="mb-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={more.image.url} alt={more.image.caption ?? ""} className="max-h-64 w-full rounded-xl object-cover" />
                <figcaption className="mt-1 text-[11px] text-ink-2">{[more.image.artist, more.image.license].filter(Boolean).join(" · ")} · <a className="link" href={more.image.page} target="_blank" rel="noopener noreferrer">Wikimedia Commons</a></figcaption>
              </figure>
            )}
            {more?.summary && (
              <blockquote className="font-serif text-lg leading-relaxed">
                {more.summary.text}
                <footer className="mt-2 text-xs text-ink-2">From <a className="link" href={more.summary.url} target="_blank" rel="noopener noreferrer">Wikipedia: {more.summary.title}</a>, CC BY-SA 4.0.</footer>
              </blockquote>
            )}
            {!steps.length && <p className="mt-4 rounded-xl border border-line bg-paper-2 p-4 text-ink-2">Wikidata records no causes, parts or consequences for this yet, so there is no story to follow from it. Try a bigger event, or one of the suggestions above.</p>}
            {steps.length > 0 && (
              <>
                <p className="mt-4 text-sm text-ink-2">{steps.length} records joined to {story.label} by Wikidata statements. Step through them, or tell any one as its own story.</p>
                <div className="mt-3 flex items-center gap-2">
                  <button type="button" className="btn btn-secondary btn-sm" disabled={i < 0} onClick={() => setI(i - 1)}><Icon name="back" size={15} />Back</button>
                  <button type="button" className="btn btn-primary btn-sm" disabled={i >= steps.length - 1} onClick={() => setI(i + 1)} data-testid="live-story-next">{i < 0 ? "Start the story" : "Next"}<Icon name="forward" size={15} /></button>
                  <span className="text-xs tabular-nums text-ink-2">{i + 1} / {steps.length}</span>
                </div>
                {cur && (
                  <div className="mt-3 rounded-xl border-2 border-bronze/50 bg-paper p-4" aria-live="polite" data-testid="live-story-step">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-bronze"><Icon name={GROUP[cur.group].icon} size={14} />{GROUP[cur.group].title}</p>
                    <p className="mt-1 font-serif text-2xl leading-tight">{cur.label}</p>
                    <p className="text-sm text-ink-2">{[cur.year != null ? formatYear(cur.year) : "Undated", cur.description].filter(Boolean).join(" · ")}</p>
                    <p className="mt-2 text-sm">{cur.label} {cur.relation} {story.label}. <a className="link text-xs" href={cur.source} target="_blank" rel="noopener noreferrer">statement ↗</a></p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link href={`/stories/live?q=${cur.id}`} className="btn btn-secondary btn-sm"><Icon name="book" size={15} />Tell this as a story</Link>
                      {cur.year != null && <Link href={`/explore/year?y=${cur.year}`} className="btn btn-ghost btn-sm"><Icon name="timeline" size={15} />Explore {formatYear(cur.year)}</Link>}
                      <a href={wdUrl(cur.id)} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">Wikidata ↗</a>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          <div className="grid content-start gap-4">
            {items.length > 0 && <ExploreMap items={items} layers={[{ id: "event", label: story.label, color: "#7a1f2b" }, { id: "before", label: "What led to it", color: "#2f6f8f" }, { id: "parts", label: "Its parts", color: "#8a5a1c" }, { id: "after", label: "What came after", color: "#3d7f4e" }]} label={`Places in the story of ${story.label}`} focusId={cur?.id ?? null} height={380} />}
            {groups.map(({ g, steps: list }) => (
              <section key={g} aria-labelledby={`g-${g}`}>
                <h2 id={`g-${g}`} className="flex items-center gap-1.5 font-serif text-xl"><Icon name={GROUP[g].icon} size={18} className="text-bronze" />{GROUP[g].title}</h2>
                <ol className="mt-1 grid gap-1">
                  {list.map(({ s, n }) => (
                    <li key={s.id}><button type="button" onClick={() => setI(n)} className={`flex w-full items-baseline gap-2 rounded-lg px-2 py-1 text-left text-sm ${n === i ? "bg-bronze-soft/60" : "hover:bg-paper-2"}`}><span className="w-14 shrink-0 tabular-nums text-ink-2">{s.year != null ? formatYear(s.year) : "–"}</span><span className="min-w-0 flex-1">{s.label}</span></button></li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        </div>
        <MoreSources query={story.label} point={story.point} label={story.label} />
        <p className="mt-6 flex items-center gap-1.5 text-xs text-ink-2"><Icon name="source" size={14} />Every step cites the Wikidata statement that joins it to {story.label} (has cause, has effect, part of, has part, significant event, follows, followed by). Nothing is written by hand.</p>
      </article>
    </Frame>
  );
}
