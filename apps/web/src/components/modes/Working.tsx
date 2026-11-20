"use client";

import { useEffect, useState } from "react";
import type { Enrichment } from "@/lib/wikidata";

export type Step = { label: string; state: "done" | "doing" | "todo"; detail?: string };

/**
 * What is happening while a live page loads: the steps, ticked off as they finish, with a running clock, and
 * something worth reading meanwhile (the Wikipedia summary and picture, which arrive in under a second).
 */
export function Working({ title, steps, preview }: { title: string; steps: Step[]; preview?: Enrichment | null }) {
  const [t, setT] = useState(0);
  useEffect(() => { const start = Date.now(); const i = setInterval(() => setT(Math.floor((Date.now() - start) / 1000)), 500); return () => clearInterval(i); }, []);
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]" role="status" aria-live="polite" data-testid="working">
      <div>
        <p className="eyebrow">Looking it up live</p>
        <h1 className="mt-1 font-serif text-4xl leading-tight">{title}</h1>
        <div className="tw-ribbon relative mt-5 h-10 overflow-hidden rounded-full bg-paper-2" aria-hidden>
          <div className="tw-ribbon-track absolute inset-y-0 left-0 flex items-center gap-10 whitespace-nowrap pl-6 text-xs tabular-nums text-ink-2">
            {[...Array(2)].flatMap((_, k) => ["3000 BC", "500 BC", "AD 1", "500", "1000", "1453", "1789", "1848", "1914", "1945", "1989", "today"].map((y) => <span key={`${k}${y}`} className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-bronze/70" />{y}</span>))}
          </div>
        </div>
        <ol className="mt-5 grid gap-2">
          {steps.map((s) => (
            <li key={s.label} className={`flex items-center gap-3 text-sm ${s.state === "todo" ? "text-ink-2/70" : ""}`}>
              <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs ${s.state === "done" ? "bg-bronze text-paper" : s.state === "doing" ? "border-2 border-bronze" : "border border-line"}`}>
                {s.state === "done" ? "✓" : s.state === "doing" ? <span className="tw-pulse block h-2 w-2 rounded-full bg-bronze" /> : ""}
              </span>
              <span>{s.label}{s.detail && <span className="text-ink-2">, {s.detail}</span>}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-xs text-ink-2">{t}s{t > 12 ? ", big subjects take Wikidata a while; it is kept for next time, so it opens at once then" : ""}</p>
      </div>
      <div>
        {preview?.image && (
          <figure>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview.image.url} alt={preview.image.caption ?? ""} className="max-h-64 w-full rounded-xl object-cover" />
            <figcaption className="mt-1 text-[11px] text-ink-2">{[preview.image.artist, preview.image.license].filter(Boolean).join(", ")}, <a className="link" href={preview.image.page} target="_blank" rel="noopener noreferrer">Wikimedia Commons</a></figcaption>
          </figure>
        )}
        {preview?.summary ? (
          <blockquote className="mt-4 font-serif text-lg leading-relaxed">
            <span className="mb-1 block text-sm text-ink-2">While you wait, from Wikipedia:</span>
            {preview.summary.text}
            <footer className="mt-2 text-xs text-ink-2">From <a className="link" href={preview.summary.url} target="_blank" rel="noopener noreferrer">Wikipedia: {preview.summary.title}</a>, CC BY-SA 4.0.</footer>
          </blockquote>
        ) : null}
      </div>
      <style>{`.tw-ribbon-track{animation:tw-slide 18s linear infinite}@keyframes tw-slide{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        .tw-pulse{animation:tw-pulse 1s ease-in-out infinite}@keyframes tw-pulse{50%{transform:scale(.4);opacity:.5}}
        @media (prefers-reduced-motion:reduce){.tw-ribbon-track,.tw-pulse{animation:none}}`}</style>
    </div>
  );
}
