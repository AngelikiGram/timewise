"use client";

import { useState } from "react";
import { CATEGORY_LABELS, CATEGORY_ORDER, categoryVar } from "@/lib/categories";
import { centuryLabel } from "@/lib/dates";

type Row = { century: number; counts: Record<string, number> };

/**
 * Events per century, stacked by category. "Count" shows where the records are; "Mix" shows what
 * kinds of events each century's records are, which is easier to compare across centuries.
 */
export function CenturyChart({ rows, from = -1000 }: { rows: Row[]; from?: number }) {
  const [mode, setMode] = useState<"count" | "mix">("count");
  const [focus, setFocus] = useState<Row | null>(null);
  const shown = rows.filter((r) => r.century >= from);
  const older = rows.filter((r) => r.century < from).reduce((s, r) => s + Object.values(r.counts).reduce((a, b) => a + b, 0), 0);
  const total = (r: Row) => Object.values(r.counts).reduce((a, b) => a + b, 0);
  const max = Math.max(1, ...shown.map(total));
  const cats = CATEGORY_ORDER.filter((c) => shown.some((r) => r.counts[c]));
  const W = 1000, H = 260, gap = 2;
  const bw = shown.length ? (W - gap * (shown.length - 1)) / shown.length : 0;
  const active = focus ?? shown[shown.length - 1];

  return (
    <figure>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="radiogroup" aria-label="Chart shows" className="inline-flex rounded-full border border-line p-0.5 text-sm">
          {(["count", "mix"] as const).map((m) => (
            <button key={m} role="radio" aria-checked={mode === m} type="button" onClick={() => setMode(m)} className={`rounded-full px-3.5 py-1 ${mode === m ? "bg-ink text-paper" : "text-ink-2 hover:text-ink"}`}>
              {m === "count" ? "Number of events" : "Mix of event types"}
            </button>
          ))}
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2">
          {cats.map((c) => <li key={c} className="flex items-center gap-1.5"><span aria-hidden className="h-3 w-3 rounded-sm" style={{ background: categoryVar(c) }} />{CATEGORY_LABELS[c] ?? c}</li>)}
        </ul>
      </div>
      <div className="relative mt-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-56 w-full sm:h-72" preserveAspectRatio="none" role="img" aria-label={`Events per century, ${mode === "count" ? "by number" : "as a share of each century"}`}>
          {shown.map((r, i) => {
            const t = total(r);
            const height = mode === "count" ? (t / max) * H : t ? H : 0;
            let y = H;
            return (
              <g key={r.century} onMouseEnter={() => setFocus(r)} onFocus={() => setFocus(r)} tabIndex={0} aria-label={`${centuryLabel(r.century)}: ${t} events`} className="cursor-default outline-none">
                <rect x={i * (bw + gap)} y={0} width={bw} height={H} fill="transparent" />
                {cats.map((c) => {
                  const n = r.counts[c] ?? 0;
                  if (!n) return null;
                  const h = (n / t) * height;
                  y -= h;
                  return <rect key={c} x={i * (bw + gap)} y={y} width={bw} height={h} fill={categoryVar(c)} opacity={focus && focus !== r ? 0.45 : 1} />;
                })}
              </g>
            );
          })}
        </svg>
        <div className="mt-1 flex justify-between text-sm text-ink-2">
          <span>{shown.length ? centuryLabel(shown[0].century) : ""}</span>
          <span>Today</span>
        </div>
      </div>
      {active && (
        <div className="mt-4 rounded-sm bg-paper-3 px-4 py-3" aria-live="polite">
          <p className="font-serif text-xl">{centuryLabel(active.century)}: {total(active).toLocaleString("en")} events</p>
          <p className="mt-1 text-sm text-ink-2">
            {cats.filter((c) => active.counts[c]).map((c) => `${CATEGORY_LABELS[c] ?? c} ${active.counts[c].toLocaleString("en")}`).join(" · ")}
          </p>
        </div>
      )}
      <figcaption className="mt-3 text-sm text-ink-2">
        Hover or tab through the centuries. These are records in this collection, not a measure of how much happened: recent centuries are far better documented.
        {older > 0 && ` ${older.toLocaleString("en")} older records are left out of the chart.`}
      </figcaption>
    </figure>
  );
}
