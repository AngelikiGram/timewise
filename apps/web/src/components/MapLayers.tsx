"use client";

import { useState } from "react";
import { activeAt, DERIVATION_LABELS } from "@/lib/collection";
import { useAtlas } from "@/lib/store";

const LAYER_LABELS = { boundaries: "Boundaries", routes: "Rail connections", urban: "Urban features", points: "Events" } as const;

/** Says plainly what the map holds for the selected date, including when that's nothing. */
export function CoverageNote() {
  const date = useAtlas((s) => s.date);
  const year = date.slice(0, 4);
  const hasPolity = activeAt(date).some((g) => g.layer === "boundaries" && g.derivation !== "modern_reference");
  return (
    <p data-testid="coverage-note" className="pointer-events-none absolute bottom-8 left-3 z-10 max-w-[calc(100%-1.5rem)] border border-line bg-paper-2/95 px-3 py-2 text-xs leading-snug text-ink-2 backdrop-blur sm:max-w-sm">
      <strong className="font-semibold text-ink">{year}: </strong>
      {hasPolity ? "A coarse political outline is shown. It's community-digitized, not an authenticated border." : "No political boundary data for this date, so none is drawn."}{" "}
      The base map and its borders are present-day.
    </p>
  );
}

export function MapLayers() {
  const layers = useAtlas((s) => s.layers);
  const opacity = useAtlas((s) => s.boundaryOpacity);
  const { toggleLayer, setBoundaryOpacity } = useAtlas.getState();
  const [open, setOpen] = useState(false);
  return (
    <div className="absolute left-3 top-3 z-10 w-56 border border-line bg-paper-2/95 text-sm backdrop-blur">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-3 py-2 font-medium">
        Layers &amp; legend
        <span aria-hidden className="text-ink-2">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="max-h-[50vh] space-y-3 overflow-y-auto border-t border-line px-3 py-3">
          <fieldset className="space-y-1">
            <legend className="sr-only">Map layers</legend>
            {(Object.keys(LAYER_LABELS) as (keyof typeof LAYER_LABELS)[]).map((k) => (
              <label key={k} className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={layers[k]} onChange={() => toggleLayer(k)} className="accent-[var(--bronze)]" />
                {LAYER_LABELS[k]}
              </label>
            ))}
          </fieldset>
          <label className="block text-xs text-ink-2">
            Boundary opacity
            <input type="range" min={0} max={0.7} step={0.02} value={opacity} onChange={(e) => setBoundaryOpacity(Number(e.target.value))} className="mt-1 block w-full accent-[var(--bronze)]" />
          </label>
          <div className="space-y-2 border-t border-line pt-3 text-xs text-ink-2">
            <p title={DERIVATION_LABELS.schematic.help} className="flex items-center gap-2">
              <svg width="24" height="6" aria-hidden className="shrink-0"><line x1="1" y1="3" x2="23" y2="3" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="0.1 5" /></svg>
              Schematic link, not the real route
            </p>
            <p title={DERIVATION_LABELS.community_digitized.help} className="flex items-center gap-2">
              <svg width="24" height="12" aria-hidden className="shrink-0"><rect x="1" y="1" width="22" height="10" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeDasharray="3 2" /></svg>
              Coarse historical outline
            </p>
            <p title={DERIVATION_LABELS.modern_reference.help} className="flex items-center gap-2">
              <svg width="24" height="6" aria-hidden className="shrink-0"><line x1="1" y1="3" x2="23" y2="3" stroke="#5e6b57" strokeWidth="3" /></svg>
              Present-day shape (today&rsquo;s track or street)
            </p>
            <p>Historical maps: none connected yet, so none are offered.</p>
          </div>
        </div>
      )}
    </div>
  );
}
