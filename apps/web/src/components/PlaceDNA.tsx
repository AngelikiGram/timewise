"use client";

import { useMemo } from "react";
import { placeById, geometriesFor, DERIVATION_LABELS, placeEvents, collection } from "@/lib/collection";
import { useAtlas } from "@/lib/store";
import type { HistoricalEvent } from "@timewise/historical-schemas";

export function PlaceDNA() {
  const selectedPlaceId = useAtlas((s) => s.selectedPlaceId);
  const date = useAtlas((s) => s.date);
  const comparisonMode = useAtlas((s) => s.comparisonMode);
  const comparisonDate = useAtlas((s) => s.comparisonDate);
  const evidenceMode = useAtlas((s) => s.evidenceMode);
  const allEvents = useAtlas((s) => s.allEvents);
  const setSelectedPlaceId = useAtlas((s) => s.setSelectedPlaceId);
  const selectEvent = useAtlas((s) => s.selectEvent);

  const place = useMemo(() => (selectedPlaceId ? placeById.get(selectedPlaceId) : null), [selectedPlaceId]);

  const events = useMemo(
    () => (selectedPlaceId ? placeEvents(selectedPlaceId).filter((e) => e.when.start <= date).sort((a, b) => a.when.start.localeCompare(b.when.start)) : []),
    [selectedPlaceId, date, allEvents]
  );

  const futureEvents = useMemo(
    () => (selectedPlaceId ? placeEvents(selectedPlaceId).filter((e) => e.when.start > date).sort((a, b) => a.when.start.localeCompare(b.when.start)) : []),
    [selectedPlaceId, date, allEvents]
  );

  const shapes = useMemo(() => (selectedPlaceId ? geometriesFor(selectedPlaceId) : []), [selectedPlaceId, allEvents]);

  // Current date geometries
  const currentShapes = useMemo(
    () =>
      shapes.filter(
        (g) => (g.validFrom ? Number(g.validFrom.replaceAll("-", "")) : -Infinity) <= Number(date.replaceAll("-", "")) &&
               (g.validTo ? Number(g.validTo.replaceAll("-", "")) : Infinity) >= Number(date.replaceAll("-", ""))
      ),
    [shapes, date]
  );

  // Comparison date geometries
  const comparisonShapes = useMemo(
    () =>
      comparisonDate
        ? shapes.filter(
            (g) =>
              (g.validFrom ? Number(g.validFrom.replaceAll("-", "")) : -Infinity) <= Number(comparisonDate.replaceAll("-", "")) &&
              (g.validTo ? Number(g.validTo.replaceAll("-", "")) : Infinity) >= Number(comparisonDate.replaceAll("-", ""))
          )
        : [],
    [shapes, comparisonDate]
  );

  const year = date ? Number(date.slice(0, 4)) : "—";
  const compYear = comparisonDate ? Number(comparisonDate.slice(0, 4)) : null;

  const derivationCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    currentShapes.forEach((g) => {
      counts[g.derivation] = (counts[g.derivation] ?? 0) + 1;
    });
    return counts;
  }, [currentShapes]);

  const compDerivationCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    comparisonShapes.forEach((g) => {
      counts[g.derivation] = (counts[g.derivation] ?? 0) + 1;
    });
    return counts;
  }, [comparisonShapes]);

  const handleClose = () => setSelectedPlaceId(null);

  const pickEvent = (e: HistoricalEvent) => {
    selectEvent(e.id);
  };

  if (!selectedPlaceId || !place) {
    return null;
  }

  return (
    <div data-testid="place-dna" className="border-t border-line bg-paper-2 p-3 sm:p-4" role="region" aria-label="Place DNA">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <h2 className="font-serif text-lg leading-snug">{place.label.en}</h2>
          <p className="text-xs text-ink-2 mt-0.5">
            {place.modernCountry}, {place.lat.toFixed(4)}, {place.lng.toFixed(4)}
            {place.region && <span>, {place.region}</span>}
          </p>
        </div>
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close Place DNA"
          className="p-1.5 rounded-full border border-line bg-paper hover:border-bronze hover:text-bronze transition-colors shrink-0"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 3l8 8M11 3l-8 8" />
          </svg>
        </button>
      </div>

      {/* Evidence mode badge */}
      <div className="mb-3 flex items-center gap-2">
        <span className="eyebrow">Evidence</span>
        <span
          className={`px-2 py-0.5 text-xs rounded-xs border ${
            evidenceMode === "documented"
              ? "border-navy text-navy bg-navy-soft"
              : evidenceMode === "inferred"
              ? "border-bronze text-bronze bg-bronze-soft"
              : "border-oxblood text-oxblood bg-oxblood-soft"
          }`}
        >
          {evidenceMode === "documented" ? "Documented" : evidenceMode === "inferred" ? "Inferred" : "Reconstructed"}
        </span>
      </div>

      {/* Comparison mode indicator */}
      {comparisonMode !== "single" && comparisonDate && (
        <div className="mb-3 p-2 rounded-sm bg-paper-3 border border-line text-xs">
          <div className="flex items-center justify-between">
            <span className="text-ink-2">Comparing {year}</span>
            <span className="font-medium text-oxblood">vs {compYear}</span>
          </div>
        </div>
      )}

      {/* Geometry derivation summary */}
      {(currentShapes.length > 0 || comparisonShapes.length > 0) && (
        <div className="mb-3">
          <div className="eyebrow mb-2">Geometry at this date</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 rounded-sm bg-paper-3 border border-line">
              <div className="font-medium text-bronze">{year}</div>
              <div className="mt-1 space-y-1">
                {Object.entries(derivationCounts).map(([der, count]) => (
                  <div key={der} className="flex justify-between">
                    <span className="text-ink-2">{DERIVATION_LABELS[der as keyof typeof DERIVATION_LABELS]?.label ?? der}</span>
                    <span className="font-medium text-ink">{count}</span>
                  </div>
                ))}
                {Object.keys(derivationCounts).length === 0 && (
                  <span className="text-ink-2">No geometry for this date</span>
                )}
              </div>
            </div>
            {comparisonMode !== "single" && comparisonDate && (
              <div className="p-2 rounded-sm bg-paper-3 border border-line">
                <div className="font-medium text-oxblood">{compYear}</div>
                <div className="mt-1 space-y-1">
                  {Object.entries(compDerivationCounts).map(([der, count]) => (
                    <div key={der} className="flex justify-between">
                      <span className="text-ink-2">{DERIVATION_LABELS[der as keyof typeof DERIVATION_LABELS]?.label ?? der}</span>
                      <span className="font-medium text-ink">{count}</span>
                    </div>
                  ))}
                  {Object.keys(compDerivationCounts).length === 0 && (
                    <span className="text-ink-2">No geometry for this date</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* What Changed Here */}
      {events.length > 0 && (
        <div className="mb-3">
          <div className="eyebrow mb-2">What changed here by {year}</div>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {events.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => pickEvent(e)}
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
        </div>
      )}

      {/* Future changes preview */}
      {futureEvents.length > 0 && (
        <details className="mb-3 group">
          <summary className="eyebrow cursor-pointer select-none flex items-center gap-1">
            <span>Future changes ({futureEvents.length})</span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" className="transition-transform group-open:rotate-90">
              <path d="M3 5l3 3 3-3" />
            </svg>
          </summary>
          <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
            {futureEvents.slice(0, 10).map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => pickEvent(e)}
                className="w-full p-2 rounded-sm border border-line bg-paper text-left hover:border-bronze hover:bg-paper-3 transition-colors opacity-60"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink-2">{e.when.start.slice(0, 4)}</span>
                  <span className="text-xs text-bronze">{e.kind === "process" ? "Process" : "Event"}</span>
                </div>
                <div className="mt-0.5 font-serif text-sm leading-snug">{e.title.en}</div>
              </button>
            ))}
            {futureEvents.length > 10 && (
              <p className="text-xs text-ink-2">...and {futureEvents.length - 10} more</p>
            )}
          </div>
        </details>
      )}

      {/* Geometry details */}
      {(currentShapes.length > 0 || comparisonShapes.length > 0) && (
        <details className="mb-3 group">
          <summary className="eyebrow cursor-pointer select-none flex items-center gap-1">
            <span>Geometry details</span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" className="transition-transform group-open:rotate-90">
              <path d="M3 5l3 3 3-3" />
            </svg>
          </summary>
          <div className="mt-2 space-y-2 text-xs">
            {currentShapes.map((g) => (
              <div key={g.id} className="p-2 rounded-sm bg-paper-3 border border-line">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{g.name}</span>
                  <span className={`px-1.5 py-0.5 text-xs rounded-xs ${getDerivationColor(g.derivation)}`}>
                    {DERIVATION_LABELS[g.derivation].label}
                  </span>
                </div>
                <div className="mt-1 text-ink-2 text-xs space-y-0.5">
                  <div>Valid: {formatDate(g.validFrom)} – {formatDate(g.validTo)}</div>
                  {g.sourceName && <div>Source: {g.sourceName}</div>}
                  {g.accuracy && <div>Accuracy: {g.accuracy}</div>}
                  {g.license && <div>Licence: {g.license}</div>}
                </div>
              </div>
            ))}
            {comparisonMode !== "single" && comparisonDate && comparisonShapes.length > 0 && (
              <>
                <hr className="border-line" />
                {comparisonShapes.map((g) => (
                  <div key={g.id} className="p-2 rounded-sm bg-paper-3 border border-oxblood/30">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-oxblood">{g.name} ({compYear})</span>
                      <span className={`px-1.5 py-0.5 text-xs rounded-xs ${getDerivationColor(g.derivation)}`}>
                        {DERIVATION_LABELS[g.derivation].label}
                      </span>
                    </div>
                    <div className="mt-1 text-ink-2 text-xs space-y-0.5">
                      <div>Valid: {formatDate(g.validFrom)} – {formatDate(g.validTo)}</div>
                      {g.sourceName && <div>Source: {g.sourceName}</div>}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </details>
      )}

      <p className="text-xs text-ink-2" role="status">
        {events.length} changes up to {year}{comparisonMode !== "single" && comparisonDate ? `, {${compYear}} geometry shown` : ""}
      </p>
    </div>
  );
}

function formatDate(iso?: string): string {
  if (!iso) return "—";
  const y = iso.slice(0, 4);
  return iso.length > 4 ? iso.slice(0, 10) : `${y}±`;
}

function getDerivationColor(derivation: string): string {
  const colors: Record<string, string> = {
    digitized_original: "bg-navy-soft text-navy border-navy/30",
    expert_reconstructed: "bg-bronze-soft text-bronze border-bronze/30",
    community_digitized: "bg-amber-soft text-amber border-amber/30",
    approximate: "bg-orange-soft text-orange border-orange/30",
    schematic: "bg-purple-soft text-purple border-purple/30",
    inferred: "bg-rose-soft text-rose border-rose/30",
    modern_reference: "bg-emerald-soft text-emerald border-emerald/30",
  };
  return colors[derivation] ?? "bg-line text-ink-2";
}