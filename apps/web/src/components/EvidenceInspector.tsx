"use client";

import { useMemo } from "react";
import { collection, claimById, claimsFor, sourceById } from "@/lib/collection";
import { useAtlas } from "@/lib/store";
import type { Claim, HistoricalEvent, SupportStatus } from "@timewise/historical-schemas";
import { SupportBadge } from "./EvidencePanel";

export function EvidenceInspector() {
  const selectedId = useAtlas((s) => s.selectedId);
  const evidenceMode = useAtlas((s) => s.evidenceMode);
  const allEvents = useAtlas((s) => s.allEvents);
  const date = useAtlas((s) => s.date);
  const selectEvent = useAtlas((s) => s.selectEvent);

  const event = useMemo(() => (selectedId ? allEvents.find((e) => e.id === selectedId) : null), [selectedId, allEvents]);

  const claims = useMemo(
    () => (selectedId ? claimsFor(selectedId).filter((c) => shouldShowClaim(c, evidenceMode)) : []),
    [selectedId, evidenceMode, allEvents]
  );

  const allClaims = useMemo(() => (selectedId ? claimsFor(selectedId) : []), [selectedId, allEvents]);

  // Count every claim under its own support status. Folding unknown statuses into "missing"
  // once presented sourced reference-work claims as having no evidence.
  const grouped = useMemo(() => {
    const groups: Record<string, typeof claims> = {};
    for (const c of claims) (groups[c.support] ??= []).push(c);
    return groups;
  }, [claims]);

  const statusCounts = useMemo(() => {
    const counts = new Map<SupportStatus, number>();
    for (const c of allClaims) counts.set(c.support, (counts.get(c.support) ?? 0) + 1);
    return [...counts.entries()];
  }, [allClaims]);

  // Related events (same chapter or place)
  const relatedEvents = useMemo(() => {
    if (!event) return [];
    return allEvents.filter(
      (e) => e.id !== selectedId && (e.chapterId === event.chapterId || e.placeId === event.placeId)
    ).slice(0, 6);
  }, [selectedId, event, allEvents]);

  if (!selectedId || !event) {
    return (
      <div className="border-t border-line bg-paper-2 p-3 sm:p-4" role="region" aria-label="Evidence Inspector">
        <p className="text-xs text-ink-2">Select an event to inspect evidence</p>
      </div>
    );
  }

  return (
    <div data-testid="evidence-inspector" className="border-t border-line bg-paper-2 p-3 sm:p-4" role="region" aria-label="Evidence Inspector">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <h2 className="font-serif text-lg leading-snug">Evidence Inspector</h2>
          <p className="text-xs text-ink-2 mt-0.5">
            {event.title.en} · {event.when.start.slice(0, 4)}
          </p>
        </div>
      </div>

      {/* Every claim for this event, counted by how well it's supported. */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5" data-testid="support-counts">
        <span className="eyebrow shrink-0">Claims:</span>
        {statusCounts.map(([status, count]) => (
          <span key={status} className="flex items-center gap-1 text-xs text-ink-2">
            <SupportBadge status={status} /> {count}
          </span>
        ))}
        {allClaims.length > claims.length && (
          <span className="text-xs text-ink-2">· {allClaims.length - claims.length} hidden by the evidence filter</span>
        )}
      </div>

      {/* Claims by support status */}
      <div className="space-y-3">
        {Object.entries(grouped).map(([support, items]) => {
          if (items.length === 0) return null;
          const color = support === "documented" ? "navy" : support === "inferred" ? "bronze" : support === "disputed" ? "oxblood" : "line";
          const icon = support === "documented" ? (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 6l2 2 4-4" /></svg>
          ) : support === "inferred" ? (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="6" cy="6" r="3" /><path d="M6 4v4M4 6h4" strokeWidth="1" /></svg>
          ) : support === "disputed" ? (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 2v8M2 6h8" /></svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 9l3-6 3 6" /></svg>
          );
          return (
            <details key={support} className="group" open={support !== "missing"}>
              <summary className="flex items-center gap-2 cursor-pointer select-none">
                <span className={`flex items-center gap-1 px-2 py-1 text-xs rounded-xs bg-${color}/10 border border-${color}/30 text-${color}`}>
                  {icon}
                  <span className="font-medium capitalize">{support}</span>
                  <span className="px-1.5 py-0.5 text-xs rounded-full bg-${color} text-on-accent">{items.length}</span>
                </span>
              </summary>
              <div className="mt-2 space-y-2 ml-6 border-l border-line pl-3">
                {items.map((claim) => (
                  <ClaimCard key={claim.id} claim={claim} evidenceMode={evidenceMode} />
                ))}
              </div>
            </details>
          );
        })}
      </div>

      {/* Related events */}
      {relatedEvents.length > 0 && (
        <details className="mt-4 group">
          <summary className="eyebrow cursor-pointer select-none flex items-center gap-1">
            <span>Related events ({relatedEvents.length})</span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" className="transition-transform group-open:rotate-90">
              <path d="M3 5l3 3 3-3" />
            </svg>
          </summary>
          <div className="mt-2 space-y-1">
            {relatedEvents.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => selectEvent(e.id)}
                className="w-full p-2 rounded-sm border border-line bg-paper text-left hover:border-bronze hover:bg-paper-3 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink-2">{e.when.start.slice(0, 4)}</span>
                  <span className="text-xs text-bronze">{e.kind === "process" ? "Process" : "Event"}</span>
                </div>
                <div className="mt-0.5 font-serif text-sm leading-snug">{e.title.en}</div>
              </button>
            ))}
          </div>
        </details>
      )}

      <p className="mt-3 text-xs text-ink-2" role="status">
        {allClaims.length} claim{allClaims.length !== 1 ? "s" : ""} for this event · {evidenceMode} mode showing {claims.length}
      </p>
    </div>
  );
}

function ClaimCard({ claim, evidenceMode }: { claim: Claim; evidenceMode: string }) {
  const sourceIds = claim.evidence.map((e) => e.sourceId);
  const primarySource = sourceIds[0] ? sourceById.get(sourceIds[0]) : null;

  return (
    <div className="p-2 rounded-sm bg-paper-3 border border-line">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm leading-snug">{claim.statement.en}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink-2">
            {primarySource && (
              <span className="px-1.5 py-0.5 rounded-xs bg-navy-soft text-navy border border-navy/30">
                {primarySource.title}
              </span>
            )}
            {claim.extraction && <span className="px-1.5 py-0.5 rounded-xs bg-bronze-soft text-bronze border border-bronze/30">{claim.extraction}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className={`w-2 h-2 rounded-full ${getSupportColor(claim.support)}`} />
        </div>
      </div>
      {claim.evidence.length > 1 && (
        <details className="mt-2 group">
          <summary className="text-xs text-ink-2 cursor-pointer select-none flex items-center gap-1">
            <span>All sources ({claim.evidence.length})</span>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" className="transition-transform group-open:rotate-90">
              <path d="M2 4l3 3 3-3" />
            </svg>
          </summary>
          <div className="mt-1 space-y-1 ml-4 border-l border-line pl-2">
            {claim.evidence.map((ev) => {
              const src = sourceById.get(ev.sourceId);
              return src ? (
                <div key={src.id} className="text-xs text-ink-2 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-navy" />
                  <span>{src.title}</span>
                  <span className="text-ink-3">—</span>
                  <span className="font-mono text-xs">{ev.locator}</span>
                  {src.url && <a href={src.url} target="_blank" rel="noopener" className="text-navy hover:underline">↗</a>}
                </div>
              ) : null;
            })}
          </div>
        </details>
      )}
    </div>
  );
}

function getSupportColor(support: string): string {
  const colors: Record<string, string> = {
    documented: "bg-navy",
    corroborated: "bg-navy",
    reference: "bg-ink-2",
    interpretation: "bg-bronze",
    disputed: "bg-oxblood",
    inferred: "bg-bronze-soft",
    missing: "bg-line",
  };
  return colors[support] ?? "bg-line";
}

function shouldShowClaim(claim: Claim, mode: string): boolean {
  // The default hides only claims without direct support. Reference-work claims cite a checked source.
  if (mode === "documented") return !["inferred", "missing"].includes(claim.support);
  if (mode === "inferred") return claim.support !== "missing";
  return true; // reconstructed shows all
}