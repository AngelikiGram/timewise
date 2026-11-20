"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CATEGORY_LABELS, categoryVar } from "@/lib/categories";
import { DATE_FORM_LABEL, dateForm, precisionNote, type Precision } from "@/lib/dates";
import { enrich, type Enrichment, type Linked } from "@/lib/wikidata";
import { CreditedImage, NoteField, ReportIssue, ReviewBadge, SaveButton } from "./ui";
import { EvidenceObjects } from "./EvidenceObjects";

export type StoryItem = {
  id: string; title: { en: string; de?: string }; description?: string; category: string; start: string; end?: string;
  precision?: Precision;
  conflict?: boolean; lng?: number; lat?: number; loc?: "event" | "place" | "area"; url: string; links?: number; checked?: boolean; inside?: boolean; country?: string;
  /** Countries Wikidata ties it to, when more than one. */
  nc?: number;
  home?: string;
  /** Records merged into this entry, kept as provenance. */
  also?: { id: string; title: string; source: "wikidata" | "checked" }[];
  multi?: boolean;
  /** The year its name gives, when that disagrees with its recorded date. */
  titleYear?: number;
  /** Dated from when the thing came into being, not a founding. */
  incept?: boolean;
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

const TABS = [
  { id: "why", label: "Why it matters" },
  { id: "before", label: "What came before" },
  { id: "after", label: "What changed" },
  { id: "evidence", label: "Records from the time" },
] as const;

export function EventStory({ item, when, place, href, onBack, onPick, known, connected, meanwhile }: {
  item: StoryItem;
  when: string;
  place: string;
  /** This event's own address, for saving and sharing. */
  href: string;
  onBack: () => void;
  /** Opens a related event if it's in the current atlas; returns false if it isn't. */
  onPick: (id: string) => boolean;
  known: (id: string) => boolean;
  /** Lists of nearby and same-time events from the current atlas. */
  connected?: React.ReactNode;
  meanwhile?: React.ReactNode;
}) {
  const [data, setData] = useState<Enrichment | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "failed">("idle");
  const [more, setMore] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [copied, setCopied] = useState(false);
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
  }, [qid, attempt]);

  const title = item.title.en ?? item.title.de ?? item.id;
  const label = CATEGORY_LABELS[item.category] ?? item.category;
  const form = item.precision ? dateForm(item.start, item.end, item.precision) : null;
  const [head, rest] = data?.summary ? lead(data.summary.text) : ["", ""];
  const linkTo = (l: Linked) =>
    known(l.id) ? (
      <button key={`internal-${l.id}`} type="button" onClick={() => onPick(l.id)} className="text-left font-medium text-bronze underline decoration-bronze/40 underline-offset-2 hover:decoration-bronze">{l.label}</button>
    ) : (
      <a key={`external-${l.id}`} href={`https://www.wikidata.org/wiki/${l.id}`} target="_blank" rel="noopener noreferrer" className="text-ink underline decoration-line underline-offset-2 hover:text-bronze">{l.label}</a>
    );
  // "Why it matters" uses only what the record itself states: what it was part of and what it led to.
  const before: [string, Linked[]][] = data ? ([["Recorded causes", data.causes], ["Came before", data.before]] as [string, Linked[]][]).filter(([, l]) => l.length > 0) : [];
  const after: [string, Linked[]][] = data ? ([["Recorded consequences", data.effects], ["Came next", data.after]] as [string, Linked[]][]).filter(([, l]) => l.length > 0) : [];
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("why");

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link", window.location.href);
    }
  };

  return (
    <article className="fade-in" data-testid="atlas-detail" aria-labelledby="story-title">
      {/* 1. Title, date, place and image */}
      <header className="px-5 pt-4">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: categoryVar(item.category) }}>
            <span aria-hidden className="inline-block h-3 w-3 rounded-full" style={{ background: categoryVar(item.category) }} />
            {label}
          </p>
          <button type="button" onClick={onBack} className="btn btn-sm btn-ghost" aria-label="Close this event and return to the list">
            <span aria-hidden>←</span> Back to the list
          </button>
        </div>
        <h2 id="story-title" className="mt-2 font-serif text-[1.9rem] leading-[1.1] sm:text-[2.1rem]">{title}</h2>
        {item.title.de && item.title.de !== item.title.en && <p className="mt-1 italic text-ink-2">{item.title.de}</p>}
        <p className="mt-2 text-base text-ink-2">
          <span className="font-semibold text-ink">{when}</span>
          {place && <>, {place}</>}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <ReviewBadge level={item.checked ? "source_checked" : "imported"} />
          {form && (
            <span className="badge text-ink-2" title={item.precision ? precisionNote(item.precision) : undefined} data-testid="date-form">
              {DATE_FORM_LABEL[form]}{form === "approximate" && item.precision ? `, ${precisionNote(item.precision).toLowerCase()}` : ""}
            </span>
          )}
          {item.incept && <span className="badge text-ink-2">Date it came into being</span>}
        </div>
        {item.titleYear !== undefined && (
          <p role="note" className="mt-3 rounded-md border border-oxblood/50 bg-oxblood/5 px-3 py-2 text-sm text-ink" data-testid="date-conflict">
            <strong>Dates disagree.</strong> The name says {item.titleYear}, but the recorded date is {when}. One of them is probably wrong: check the source before relying on either.
          </p>
        )}
        {item.conflict && <p className="mt-2 text-sm text-ink-2">Wikidata gives more than one date for this; the most precise is shown.</p>}
      </header>

      {data?.image && (
        <CreditedImage
          className="mt-4 px-5"
          src={data.image.url}
          alt={data.image.caption ?? `Image from Wikimedia Commons for ${title}`}
          imgClassName="max-h-80 w-full object-cover"
          credit={{ title: "Wikimedia Commons", creator: data.image.artist, license: data.image.license ?? "Licence on Commons", page: data.image.page }}
        />
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 px-5">
        <SaveButton id={item.id} title={title} href={href} start={item.start} context={place} />
        <button type="button" onClick={share} className="btn btn-sm btn-secondary" aria-live="polite">{copied ? "Link copied" : "Share"}</button>
        {/^Q\d+$/.test(item.id) && <Link href={`/connections?id=${item.id}`} className="btn btn-sm btn-secondary" data-testid="explore-connections">Explore connections</Link>}
      </div>

      <div className="space-y-7 px-5 pb-8 pt-6">
        {/* 2. What happened */}
        <section aria-labelledby="what-happened">
          <h3 id="what-happened" className="eyebrow">What happened</h3>
          {item.description && <p className="mt-2 text-lg leading-snug first-letter:uppercase">{item.description}</p>}
          {state === "loading" && (
            <div aria-busy className="mt-3 space-y-2" aria-label="Loading the summary">
              <div className="skeleton h-4 w-full" /><div className="skeleton h-4 w-11/12" /><div className="skeleton h-4 w-2/3" />
            </div>
          )}
          {state === "failed" && (
            <p className="mt-2 text-sm text-ink-2">The summary from Wikipedia couldn&rsquo;t be loaded. <button type="button" onClick={() => setAttempt(attempt + 1)} className="link">Try again</button></p>
          )}
          {data?.summary && (
            <>
              <p className="mt-3 leading-relaxed">{head}</p>
              {rest && more && <p className="mt-3 leading-relaxed">{rest}</p>}
              {rest && <button type="button" aria-expanded={more} onClick={() => setMore(!more)} className="link mt-2 text-sm">{more ? "Show less" : "Read more"}</button>}
              <p className="mt-2 text-xs text-ink-2">
                From Wikipedia&rsquo;s article <a href={data.summary.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{data.summary.title} ↗</a>, CC BY-SA 4.0. Written by Wikipedia editors.
              </p>
            </>
          )}
          {data && !data.summary && !item.description && <p className="mt-2 text-ink-2">Neither Wikidata nor English Wikipedia describes this yet.</p>}
          {data && data.facts.length > 0 && (
            <dl className="mt-4 grid grid-cols-[minmax(6.5rem,auto)_1fr] gap-x-4 gap-y-2 text-[0.95rem]">
              {data.facts.slice(0, 6).map((f) => (
                <div key={f.label} className="contents">
                  <dt className="text-ink-2">{f.label}</dt>
                  <dd className="flex flex-wrap gap-x-2 gap-y-1">{f.text ? <span className="font-medium">{f.text}</span> : f.values.map(linkTo).flatMap((el, i) => (i ? [<span key={`s${i}`} aria-hidden className="text-ink-2">,</span>, el] : [el]))}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>

        {/* 3. Four short tabs instead of one long page: why it matters, before, after, evidence. */}
        <section aria-label="About this event" data-testid="event-tabs">
          <div role="tablist" aria-label="About this event" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 [&>*]:shrink-0">
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" id={`tab-${t.id}`} aria-selected={tab === t.id} aria-controls={`panel-${t.id}`} onClick={() => setTab(t.id)} className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${tab === t.id ? "bg-bronze text-paper" : "text-ink-2 hover:bg-paper-3 hover:text-ink"}`}>
                {t.label}
              </button>
            ))}
          </div>
          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="mt-3" data-testid={`panel-${tab}`}>
            {tab === "why" && (
              <>
                {data?.partOf.length ? <div><p className="text-sm font-semibold">Part of</p><div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">{data.partOf.slice(0, 6).map(linkTo)}</div></div> : null}
                {item.checked && <p className="mt-2 leading-relaxed">This event is part of a hand-checked story. <Link href={item.url} className="link">See its evidence</Link></p>}
                {!item.checked && (item.links ?? 0) > 0 && <p className="mt-2 text-sm text-ink-2">Written about in {item.links} Wikipedia {item.links === 1 ? "language" : "languages"}: how widely it&rsquo;s documented, not how important it was.</p>}
                {data && !data.partOf.length && !item.checked && <p className="mt-2 text-sm text-ink-2">Wikidata doesn&rsquo;t record what this was part of. See what came before and what changed.</p>}
                {connected}
              </>
            )}
            {tab === "before" && (
              before.length ? before.map(([heading, list]) => (
                <div key={heading} className="mb-3"><p className="text-sm font-semibold">{heading}</p><div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">{list.slice(0, 8).map(linkTo)}</div></div>
              )) : <p className="text-sm text-ink-2">{data ? "Wikidata records no causes or predecessors for this." : "Loading what Wikidata records…"}</p>
            )}
            {tab === "after" && (
              after.length ? after.map(([heading, list]) => (
                <div key={heading} className="mb-3"><p className="text-sm font-semibold">{heading}</p><div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">{list.slice(0, 8).map(linkTo)}</div></div>
              )) : <p className="text-sm text-ink-2">{data ? "Wikidata records no effects or successors for this." : "Loading what Wikidata records…"}</p>
            )}
            {tab === "evidence" && <EvidenceObjects title={title} start={item.start} precision={item.precision} austrian={item.checked || item.country === "austria" || item.home === "austria"} />}
            {(tab === "before" || tab === "after") && (before.length > 0 || after.length > 0) && <p className="mt-2 text-xs text-ink-2">As recorded in Wikidata statements, not reviewed here.</p>}
          </div>
        </section>
        {meanwhile}

        <NoteField id={item.id} title={title} href={href} />

        {/* 5. Sources and evidence */}
        <details className="group rounded-md border border-line" data-testid="evidence-details">
          <summary className="cursor-pointer list-none px-4 py-3 font-semibold text-ink hover:text-bronze">
            <span className="inline-block transition-transform group-open:rotate-90" aria-hidden>›</span> Sources and evidence
          </summary>
          <div className="space-y-3 px-4 pb-4 text-sm leading-relaxed">
            {item.checked ? (
              <p>Each statement about this event was compared by hand with a linked source. The claims, the sources and how far each can be trusted are on its evidence page. <Link href={item.url} className="link">Open the evidence</Link></p>
            ) : (
              <>
                <p><strong>Record:</strong> Wikidata, a community-maintained database (CC0). Not reviewed here: treat it as a lead, not a verified fact. <a href={item.url} target="_blank" rel="noopener noreferrer" className="link">Open the Wikidata record ↗</a></p>
                {data?.summary && <p><strong>Summary:</strong> <a href={data.summary.url} target="_blank" rel="noopener noreferrer" className="link">Wikipedia, {data.summary.title} ↗</a></p>}
                {item.nc && item.nc > 1 && <p><strong>Countries:</strong> Wikidata ties this to {item.nc} present-day countries{item.multi ? ", so TIMEWISE lists it under multiple regions rather than one" : ""}.</p>}
              </>
            )}
            {item.also && item.also.length > 0 && (
              <p data-testid="merged-records"><strong>Merged records:</strong> this entry combines {item.also.length + 1} records of the same event, so it appears once. Also recorded as {item.also.map((a, i) => <span key={a.id}>{i > 0 && ", "}<a href={`https://www.wikidata.org/wiki/${a.id}`} target="_blank" rel="noopener noreferrer" className="link">{a.title} ({a.id}) ↗</a></span>)}.</p>
            )}
            <p><strong>Date:</strong> {when}. {form ? `${DATE_FORM_LABEL[form]}${item.precision ? `, ${precisionNote(item.precision).toLowerCase()}` : ""}.` : ""}</p>
            <p><strong>Location:</strong> {item.lng === undefined || item.multi ? (item.multi ? "It spans several regions, so it isn't pinned to one point." : "No location given, so it isn't on the map.") : `${item.lat!.toFixed(2)}°, ${item.lng.toFixed(2)}°. ${item.loc ? LOCATION_NOTE[item.loc] : ""}`}</p>
            <ReportIssue subject={title} id={item.id} />
          </div>
        </details>
      </div>
    </article>
  );
}
