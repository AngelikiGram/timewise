"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CATEGORY_LABELS, categoryVar } from "@/lib/categories";
import { enrich, type Enrichment, type Linked } from "@/lib/wikidata";

export type StoryItem = {
  id: string; title: { en: string; de?: string }; description?: string; category: string; start: string; end?: string;
  conflict?: boolean; lng?: number; lat?: number; loc?: "event" | "place" | "area"; url: string; links?: number; checked?: boolean; inside?: boolean; country?: string;
};

const LOCATION_NOTE: Record<string, string> = {
  event: "Wikidata gives coordinates for the event itself.",
  place: "Placed at the site Wikidata links to the event, which may not be its exact position.",
  area: "Placed at the town or district Wikidata says it was in. The position is approximate.",
};

/** The first two sentences, so the summary reads as a summary; the rest opens on request. */
function lead(text: string): [string, string] {
  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [text];
  const head = sentences.slice(0, 2).join("").trim();
  return [head, text.slice(head.length).trim()];
}

export function EventStory({ item, when, place, onBack, onPick, known, children }: {
  item: StoryItem;
  when: string;
  place: string;
  onBack: () => void;
  /** Opens a related event if it's in the current atlas; returns false if it isn't. */
  onPick: (id: string) => boolean;
  known: (id: string) => boolean;
  children?: React.ReactNode;
}) {
  const [data, setData] = useState<Enrichment | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "failed">("idle");
  const [more, setMore] = useState(false);
  const qid = /^Q\d+$/.test(item.id) ? item.id : null;

  useEffect(() => {
    setData(null);
    setMore(false);
    if (!qid) return;
    const controller = new AbortController();
    setState("loading");
    enrich(qid, controller.signal).then((d) => { if (!controller.signal.aborted) { setData(d); setState("idle"); } })
      .catch(() => { if (!controller.signal.aborted) setState("failed"); });
    return () => controller.abort();
  }, [qid]);

  const label = CATEGORY_LABELS[item.category] ?? item.category;
  const [head, rest] = data?.summary ? lead(data.summary.text) : ["", ""];
  const linkTo = (l: Linked) =>
    known(l.id) ? (
      <button key={`internal-${l.id}`} type="button" onClick={() => onPick(l.id)} className="text-left font-medium text-bronze underline decoration-bronze/40 underline-offset-2 hover:decoration-bronze">{l.label}</button>
    ) : (
      <a key={`external-${l.id}`} href={`https://www.wikidata.org/wiki/${l.id}`} target="_blank" rel="noopener noreferrer" className="text-ink underline decoration-line underline-offset-2 hover:text-bronze">{l.label}</a>
    );
  const sequence: [string, Linked[], string][] = data ? [
    ["Came before", data.before, "Wikidata lists these as preceding it."],
    ["Came next", data.after, "Wikidata lists these as following it."],
    ["Causes", data.causes, "Recorded in Wikidata as a cause. Not reviewed here."],
    ["Consequences", data.effects, "Recorded in Wikidata as an effect. Not reviewed here."],
    ["Part of", data.partOf, "The larger event or period Wikidata places it in."],
  ].filter(([, list]) => (list as Linked[]).length > 0) as [string, Linked[], string][] : [];

  return (
    <article className="fade-in min-h-0 flex-1 overflow-y-auto" data-testid="atlas-detail" aria-labelledby="story-title">
      <div className="px-5 pt-4">
        <button type="button" onClick={onBack} className="text-sm font-medium text-bronze underline-offset-2 hover:underline">← Back to the list</button>
      </div>

      {/* At a glance */}
      <header className="px-5 pt-4">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium" style={{ color: categoryVar(item.category) }}>
          <span aria-hidden className="inline-block h-3 w-3 rounded-full" style={{ background: categoryVar(item.category) }} />
          {label}
        </p>
        <h2 id="story-title" className="mt-2 font-serif text-[2rem] leading-[1.1] sm:text-4xl">{item.title.en ?? item.title.de}</h2>
        {item.title.de && item.title.de !== item.title.en && <p className="mt-1 italic text-ink-2">{item.title.de}</p>}
        <p className="mt-3 text-base text-ink-2"><span className="font-semibold text-ink">{when}</span>{place && <> · {place}</>}</p>
        {item.description && <p className="mt-3 text-lg leading-snug first-letter:uppercase">{item.description}</p>}
        <p className={`mt-3 inline-block rounded-sm border px-2 py-0.5 text-xs font-semibold uppercase tracking-wider ${item.checked ? "border-navy text-navy" : "border-oxblood text-oxblood"}`}>
          {item.checked ? "Checked against sources" : "Imported, not reviewed"}
        </p>
        {item.checked && <p className="mt-3"><Link href={item.url} className="font-medium text-bronze underline underline-offset-2">See its evidence →</Link></p>}
      </header>

      {data?.image && (
        <figure className="mt-5">
          <img src={data.image.url} alt={data.image.caption ?? `Image from Wikimedia Commons for ${item.title.en}`} className="max-h-80 w-full bg-paper-3 object-cover" loading="lazy" />
          <figcaption className="px-5 pt-1.5 text-xs text-ink-2">
            {data.image.artist ? `${data.image.artist}. ` : ""}{data.image.license ?? "Licence on Commons"}. <a href={data.image.page} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Wikimedia Commons ↗</a>
          </figcaption>
        </figure>
      )}

      <div className="space-y-7 px-5 pb-8 pt-5">
        {/* Understand */}
        {state === "loading" && (
          <div aria-busy className="space-y-2" aria-label="Loading the summary">
            <div className="h-4 w-full animate-pulse rounded bg-paper-3" />
            <div className="h-4 w-11/12 animate-pulse rounded bg-paper-3" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-paper-3" />
          </div>
        )}
        {state === "failed" && <p className="text-sm text-ink-2">The summary from Wikipedia and Wikidata couldn&rsquo;t be loaded. The record&rsquo;s link below still works.</p>}
        {data?.summary && (
          <section aria-label="Summary">
            <p className="text-lg leading-relaxed">{head}</p>
            {rest && more && <p className="mt-3 leading-relaxed">{rest}</p>}
            {rest && <button type="button" aria-expanded={more} onClick={() => setMore(!more)} className="mt-2 text-sm font-medium text-bronze underline-offset-2 hover:underline">{more ? "Show less" : "Read more"}</button>}
            <p className="mt-2 text-xs text-ink-2">
              From Wikipedia&rsquo;s article <a href={data.summary.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{data.summary.title} ↗</a>, CC BY-SA 4.0. Written by Wikipedia editors, not checked here.
            </p>
          </section>
        )}
        {data && !data.summary && state === "idle" && !item.description && <p className="text-ink-2">Neither Wikidata nor English Wikipedia has a description of this yet.</p>}

        {data && data.facts.length > 0 && (
          <section>
            <h3 className="eyebrow">Key facts</h3>
            <dl className="mt-3 grid grid-cols-[minmax(6.5rem,auto)_1fr] gap-x-4 gap-y-2.5">
              <dt className="text-ink-2">When</dt><dd className="font-medium">{when}</dd>
              {data.facts.map((f) => (
                <div key={f.label} className="contents">
                  <dt className="text-ink-2">{f.label}</dt>
                  <dd className="flex flex-wrap gap-x-2 gap-y-1">{f.text ? <span className="font-medium">{f.text}</span> : f.values.map(linkTo).flatMap((el, i) => (i ? [<span key={`s${i}`} aria-hidden className="text-ink-2">·</span>, el] : [el]))}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {sequence.length > 0 && (
          <section>
            <h3 className="eyebrow">How this connects</h3>
            <div className="mt-3 space-y-3">
              {sequence.map(([title, list, note]) => (
                <div key={title} className="border-l-2 pl-3" style={{ borderColor: categoryVar(item.category) }}>
                  <p className="font-serif text-lg">{title}</p>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">{list.slice(0, 6).map(linkTo)}</div>
                  <p className="mt-1 text-xs text-ink-2">{note}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {children}

        {/* Investigate */}
        <details className="group border-t border-line pt-4">
          <summary className="cursor-pointer list-none font-medium text-bronze"><span className="inline-block transition-transform group-open:rotate-90" aria-hidden>›</span> Explore the evidence</summary>
          <div className="mt-3 space-y-3 text-sm leading-relaxed">
            {item.checked ? (
              <p>This event was checked against sources by hand. Its claims, sources and how far each can be trusted are on its evidence page.</p>
            ) : (
              <>
                <p><strong>Where this comes from:</strong> Wikidata, a community-maintained database (CC0). No one here has reviewed it; treat it as a lead, not a verified fact. <a href={item.url} target="_blank" rel="noopener noreferrer" className="font-medium text-bronze underline underline-offset-2">Open the Wikidata record ↗</a></p>
                {item.conflict && <p><strong>Dates:</strong> Wikidata lists more than one date for this. The most precise is shown.</p>}
                {item.links !== undefined && <p><strong>Coverage:</strong> Wikipedia has an article on it in {item.links} {item.links === 1 ? "language" : "languages"}. That measures how widely it is written about, not its importance.</p>}
                {data && <p><strong>Key facts and connections</strong> are Wikidata statements, loaded live. Causes and consequences are what Wikidata&rsquo;s editors recorded; a link in time alone is never shown as a cause.</p>}
              </>
            )}
            <p><strong>Location:</strong> {item.lng === undefined ? "No location given, so it isn't on the map." : `${item.lat!.toFixed(2)}°, ${item.lng.toFixed(2)}°. ${item.loc ? LOCATION_NOTE[item.loc] : ""}`}</p>
          </div>
        </details>
      </div>
    </article>
  );
}
