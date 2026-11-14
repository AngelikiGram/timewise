"use client";

import type { Claim, HistoricalEvent, SupportStatus } from "@timewise/historical-schemas";
import { claimsFor, DERIVATION_LABELS, eventsByDate, formatWhen, geometriesFor, placeById, sourceById, SUPPORT_LABELS } from "@/lib/collection";
import { useAtlas } from "@/lib/store";
import { ArchivalMaterial } from "./ArchivalMaterial";

const SUPPORT_STYLE: Record<SupportStatus, string> = {
  documented: "border-navy text-navy",
  corroborated: "border-navy text-navy",
  reference: "border-line text-ink-2",
  interpretation: "border-bronze text-bronze",
  disputed: "border-oxblood text-oxblood",
  inferred: "border-bronze text-bronze",
  missing: "border-oxblood text-oxblood",
};

export function SupportBadge({ status }: { status: SupportStatus }) {
  const { label, help } = SUPPORT_LABELS[status];
  return (
    <span title={help} className={`inline-block border px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${SUPPORT_STYLE[status]}`}>
      {label}
    </span>
  );
}

/** Text fragments make the browser scroll to and highlight the cited phrase. */
const deepLink = (url: string, locator: string) => `${url}#:~:text=${encodeURIComponent(locator)}`;

interface ClaimCardProps {
  claim: Claim;
  compact?: boolean;
}

export function ClaimCard({ claim, compact = false }: ClaimCardProps) {
  if (compact) {
    return (
      <article className="border border-line bg-paper-2 p-3" data-testid="claim">
        <div className="flex items-start gap-2">
          <SupportBadge status={claim.support} />
          <p className="font-serif text-sm leading-snug flex-1">{claim.statement.en}</p>
        </div>
        {claim.evidence.length > 0 && (
          <div className="mt-2 ml-6 text-xs text-ink-2 space-y-1 border-l border-line pl-2">
            {claim.evidence.map((ev) => {
              const source = sourceById.get(ev.sourceId)!;
              return (
                <div key={ev.sourceId}>
                  <a href={deepLink(source.url, ev.locator)} target="_blank" rel="noopener noreferrer" className="font-medium text-bronze underline-offset-2 hover:underline">
                    {source.title} ↗
                  </a>
                  <p className="italic">{ev.passage}</p>
                </div>
              );
            })}
          </div>
        )}
      </article>
    );
  }

  return (
    <article className="border border-line bg-paper-2 p-4" data-testid="claim">
      <div className="mb-2"><SupportBadge status={claim.support} /></div>
      <p className="font-serif text-[1.05rem] leading-snug">{claim.statement.en}</p>
      {claim.evidence.map((ev) => {
        const source = sourceById.get(ev.sourceId)!;
        return (
          <div key={ev.sourceId} className="mt-3 border-t border-line pt-3 text-sm">
            <p className="text-ink-2">{ev.passage}</p>
            <a href={deepLink(source.url, ev.locator)} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block font-medium text-bronze underline-offset-2 hover:underline">
              {source.title} ↗
            </a>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs text-ink-2">
              <dt>Provider</dt><dd>{source.provider}</dd>
              <dt>Language</dt><dd>{source.language}</dd>
              <dt>Rights</dt><dd>{source.rights}</dd>
              <dt>Checked</dt><dd>{source.retrievedAt}</dd>
            </dl>
          </div>
        );
      })}
    </article>
  );
}

export function EvidencePanel({ event }: { event: HistoricalEvent | null }) {
  if (!event) {
    return <div className="p-6 text-sm text-ink-2">Select an event to inspect its evidence.</div>;
  }
  const place = event.placeId ? placeById.get(event.placeId) : undefined;
  const otherNames = place?.names.filter((n) => n.name !== place.label.en) ?? [];
  const claims = claimsFor(event.id);
  const sourceIds = new Set(claims.flatMap((c) => c.evidence.map((ev) => ev.sourceId)));
  // Language editions of one encyclopedia aren't independent, so count publishers, not pages.
  const publishers = new Set([...sourceIds].map((id) => sourceById.get(id)!.provider.replace(/ \(.*\)$/, "")));
  const shapes = geometriesFor(event.id);
  const related = eventsByDate.filter((e) => e.id !== event.id && (e.chapterId === event.chapterId || (place && e.placeId === place.id))).slice(0, 4);
  return (
    <div key={event.id} className="fade-in space-y-4 p-5" data-testid="evidence-panel">
      <header>
        <p className="eyebrow">{formatWhen(event.when)}</p>
        <h2 className="mt-1 font-serif text-2xl leading-tight">{event.title.en}</h2>
        <p className="mt-1 text-sm text-ink-2">
          {place ? place.label.en : "No single location"}
          {otherNames.length > 0 && ` (${otherNames.map((n) => n.name).join(", ")})`}
          {event.kind === "process" && " · Process"}
        </p>
        {event.people.length > 0 && <p className="mt-1 text-sm text-ink-2">People: {event.people.join(", ")}</p>}
      </header>
      {event.media && (
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={event.media.url} alt={event.media.title} loading="lazy" className="max-h-64 w-full border border-line object-cover" />
          <figcaption className="mt-2 text-xs text-ink-2">
            <a href={event.media.page} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
              {event.media.title} ↗
            </a>{" "}
            {event.media.creator}, {event.media.created}. {event.media.license}.
            {event.media.caveat && <span className="mt-1 block italic">{event.media.caveat}</span>}
          </figcaption>
        </figure>
      )}
      <p className="leading-relaxed">{event.summary.en}</p>
      {(event.when.note || event.placeNote || event.noPlaceReason) && (
        <aside className="space-y-1 border-l-2 border-bronze pl-3 text-sm text-ink-2">
          {event.when.note && <p>{event.when.note}</p>}
          {event.placeNote && <p>{event.placeNote}</p>}
          {event.noPlaceReason && <p>{event.noPlaceReason}</p>}
        </aside>
      )}
      <div>
        <h3 className="eyebrow mb-2">Evidence</h3>
        {publishers.size === 1 && (
          <p data-testid="single-source" className="mb-2 text-sm text-ink-2">
            Everything here comes from one publisher ({[...publishers][0]}), so it hasn&rsquo;t been independently corroborated.
          </p>
        )}
        <div className="space-y-3">
          {claims.map((c) => <ClaimCard key={c.id} claim={c} />)}
        </div>
      </div>
      <ArchivalMaterial eventId={event.id} />
      <div data-testid="geography">
        <h3 className="eyebrow mb-2">On the map</h3>
        {shapes.length === 0 ? (
          <p className="text-sm text-ink-2">
            {place ? "This record has a single point only. No route or area data is available for it yet, so none is drawn." : "This record isn't placed on the map."}
          </p>
        ) : (
          <ul className="space-y-2">
            {shapes.map((g) => (
              <li key={g.id} className="border border-line bg-paper-2 p-3 text-sm">
                <p className="font-serif text-base leading-snug">{g.name}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-bronze" title={DERIVATION_LABELS[g.derivation].help}>{DERIVATION_LABELS[g.derivation].label}</p>
                <p className="mt-1 text-ink-2">{g.note}</p>
                <details className="mt-2 text-xs text-ink-2">
                  <summary className="cursor-pointer text-bronze">Geometry details</summary>
                  <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
                    <dt>Type</dt><dd>{g.geometry.type}</dd>
                    <dt>Shown</dt><dd>{g.validFrom} to {g.validTo}</dd>
                    <dt>Accuracy</dt><dd>{g.accuracy}</dd>
                    <dt>Source</dt><dd>{g.sourceUrl ? <a href={g.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">{g.sourceName} ↗</a> : g.sourceName}</dd>
                    <dt>CRS</dt><dd>{g.crs}</dd>
                    <dt>License</dt><dd>{g.license}</dd>
                    <dt>Review</dt><dd>Not yet reviewed</dd>
                    <dt>Retrieved</dt><dd>{g.retrievedAt}</dd>
                  </dl>
                </details>
              </li>
            ))}
          </ul>
        )}
      </div>
      {related.length > 0 && (
        <nav aria-label="Related records">
          <h3 className="eyebrow mb-2">Nearby in the story</h3>
          <ul className="space-y-1">
            {related.map((e) => (
              <li key={e.id}>
                <button type="button" onClick={() => useAtlas.getState().selectEvent(e.id)} className="text-left text-sm text-bronze underline-offset-2 hover:underline">
                  {e.title.en} <span className="text-ink-2">({e.when.start.slice(0, 4)})</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <p className="text-xs text-ink-2">
        Passages are paraphrased. Each link opens the source and, in most browsers, highlights the cited text. Claims have been checked against their sources, but not yet reviewed by a historian.
      </p>
    </div>
  );
}
