"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { recordSurprise } from "@/lib/explorer";
import { FEATURED_EVENTS, pick } from "@/lib/featured";
import { searchEntities } from "@/lib/live";
import { LiveSearch } from "../modes/LiveSearch";
import { loadStoryIndex, type StoryEntry } from "./StoryReader";

const yr = (y: number) => (y < 0 ? `${-y} BC` : String(y));

/**
 * Find a story: search the prebuilt ones and, beyond them, any event on Wikidata (told on the spot);
 * or take a surprise from either.
 */
export function StoryDiscover({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [index, setIndex] = useState<StoryEntry[]>([]);
  useEffect(() => { loadStoryIndex().then((d) => setIndex(d.stories), () => {}); }, []);
  const local = useMemo(() => index.map((s) => ({ id: s.id, label: s.title, sub: `${yr(s.from)}–${yr(s.to)} · ${s.count} steps${s.places.length ? ` · ${s.places.slice(0, 2).join(", ")}` : ""}`, href: `/stories/read?id=${s.id}` })), [index]);
  const surprise = () => { if (!index.length) return; recordSurprise(); router.push(`/stories/read?id=${pick(index).id}`); };
  const fresh = () => { recordSurprise(); router.push(`/stories/live?find=${encodeURIComponent(pick(FEATURED_EVENTS))}`); };

  return (
    <div className={compact ? "" : "rounded-2xl border border-line bg-paper-2 p-4 sm:p-5"} data-testid="story-discover">
      {!compact && <p className="text-sm text-ink-2">Search {index.length ? `${index.length.toLocaleString("en")} ready-made stories` : "the ready-made stories"}, or any event on Wikidata: TIMEWISE tells it on the spot from its documented causes, parts and consequences.</p>}
      <div className={`flex flex-col gap-2 sm:flex-row sm:items-center ${compact ? "" : "mt-3"}`}>
        <div className="min-w-0 flex-1"><LiveSearch label="Find a story" placeholder="Any event: the French Revolution, Apollo 11, the Black Death…" local={local} live={(s, sig) => searchEntities(s, sig)} hrefFor={(h) => `/stories/live?q=${h.id}`} testId="story-search" /></div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-primary" onClick={surprise} disabled={!index.length} data-testid="story-surprise"><span aria-hidden>🎲</span>Surprise me</button>
          <button type="button" className="btn btn-secondary" onClick={fresh} title="Pick a well-known event and tell it from Wikidata now"><span aria-hidden>✨</span>Make one now</button>
        </div>
      </div>
      {!compact && (
        <ul className="mt-3 flex gap-1.5 overflow-x-auto pb-1 [&>*]:shrink-0">
          {FEATURED_EVENTS.slice(0, 16).map((e) => <li key={e}><Link href={`/stories/live?find=${encodeURIComponent(e)}`} className="chip !min-h-7 !text-xs">{e}</Link></li>)}
        </ul>
      )}
    </div>
  );
}
