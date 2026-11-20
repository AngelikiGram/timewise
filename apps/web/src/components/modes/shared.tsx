"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { lastOf, readTrail, visit, type Stop } from "@/lib/trail";
import { artistOf, interestOf } from "@/lib/explore";
export { artistOf };
import { setInterests, useProgress } from "@/lib/progress";
import { rememberName } from "@/lib/explorer";
import { LevelBar } from "./Gamify";
import { Icon, type IconName } from "../icons";

/** The four ways in, with the one you're on marked. */
export const MODES: { id: "thing" | "year" | "life" | "interests"; label: string; icon: IconName; href: string }[] = [
  { id: "thing", label: "Follow a thing", icon: "network", href: "/explore/thing?id=art-nouveau" },
  { id: "year", label: "Explore a year", icon: "timeline", href: "/explore/year?y=1900" },
  { id: "life", label: "Follow a life", icon: "person", href: "/explore/life" },
  { id: "interests", label: "Your interests", icon: "idea", href: "/explore/interests" },
];
type ModeId = (typeof MODES)[number]["id"];

/**
 * The four tabs, and a way back. Each tab opens on what you're looking at when it can (this person's year,
 * this year's style), else where you last were in that mode, else a starting point.
 * `here` records this page in the trail; `context` gives the tabs their targets.
 */
export function ModeBar({ on, here, context = {} }: { on: ModeId; here?: Stop; context?: Partial<Record<ModeId, { href: string; label: string }>> }) {
  const [trail, setTrail] = useState<Stop[]>([]);
  useEffect(() => { setTrail(here ? visit(here) : readTrail()); }, [here?.href]); // eslint-disable-line react-hooks/exhaustive-deps
  const prev = trail.length > 1 && trail[trail.length - 1]?.href === here?.href ? trail[trail.length - 2] : undefined;
  const target = (m: (typeof MODES)[number]) => {
    if (m.id === on) return { href: here?.href ?? m.href, hint: "" };
    const c = context[m.id];
    if (c) return { href: c.href, hint: c.label };
    const last = lastOf(trail, m.id);
    return last ? { href: last.href, hint: last.label } : { href: m.href, hint: "" };
  };
  return (
    <div className="grid gap-2" data-testid="mode-nav">
      <div className="flex flex-wrap items-center gap-2">
      <nav aria-label="Ways to explore" className="flex flex-wrap gap-1.5" data-testid="mode-bar">
        {MODES.map((m) => {
          const t = target(m);
          return (
            <Link key={m.id} href={t.href} aria-current={m.id === on ? "page" : undefined} title={t.hint ? `${m.label}: ${t.hint}` : m.label}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${m.id === on ? "border-bronze bg-bronze text-paper" : "border-line bg-paper-2 text-ink-2 hover:text-ink"}`}>
              <Icon name={m.icon} size={15} />{m.label}{t.hint && <span className="max-w-[9rem] truncate text-xs opacity-75">{t.hint}</span>}
            </Link>
          );
        })}
      </nav>
      <span className="ml-auto"><LevelBar compact /></span>
      </div>
      {trail.length > 1 && (
        <nav aria-label="Where you've been" className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-ink-2" data-testid="trail">
          {prev && <Link href={prev.href} className="btn btn-ghost btn-sm !px-2" data-testid="trail-back"><Icon name="back" size={15} />Back to {prev.label}</Link>}
          <ol className="flex min-w-0 flex-wrap items-center gap-1">
            {trail.slice(-5).map((s, i, all) => (
              <li key={`${s.href}${i}`} className="flex items-center gap-1">
                {i > 0 && <span aria-hidden>›</span>}
                {i === all.length - 1 ? <span className="font-medium text-ink" aria-current="page">{s.label}</span> : <Link href={s.href} className="hover:text-ink hover:underline">{s.label}</Link>}
              </li>
            ))}
          </ol>
        </nav>
      )}
    </div>
  );
}

/**
 * Keep a topic, person or year among your interests. In a list (`compact`) it is just the name, with ＋ or ✓;
 * on a page of its own it says what it does.
 */
export function SaveInterest({ kind, id, label, compact = false }: { kind: keyof typeof interestOf; id: string | number; label: string; compact?: boolean }) {
  const p = useProgress();
  const key = (interestOf[kind] as (x: never) => string)(id as never);
  const on = (p.interests ?? []).includes(key);
  const toggle = () => { if (!on) rememberName(key, label); setInterests(on ? (p.interests ?? []).filter((x) => x !== key) : [...(p.interests ?? []), key]); };
  if (compact) {
    return (
      <button type="button" aria-pressed={on} onClick={toggle} data-testid="save-interest" aria-label={on ? `${label}, in your interests. Remove` : `Add ${label} to your interests`}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${on ? "border-bronze bg-bronze text-paper" : "border-line bg-paper-2 hover:border-bronze"}`}>
        <span aria-hidden className="w-3 text-center">{on ? "✓" : "+"}</span>{label}
      </button>
    );
  }
  return (
    <button type="button" aria-pressed={on} data-testid="save-interest" onClick={toggle} title={on ? "Remove from your interests" : "Suggestions on Your interests will follow from it"}
      className={`btn btn-sm ${on ? "!border-bronze !bg-bronze !text-paper" : "btn-secondary"}`}>
      <Icon name="idea" size={15} />{on ? "In your interests ✓" : "Save to interests"}
    </button>
  );
}

/** "Where to next": links into the other modes from what is on screen. */
export function NextSteps({ items }: { items: { href: string; icon: IconName; title: string; why: string }[] }) {
  if (!items.length) return null;
  return (
    <section className="mt-8" aria-labelledby="next-steps" data-testid="next-steps">
      <h2 id="next-steps" className="font-serif text-2xl">Where to next</h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((x) => (
          <li key={x.href}>
            <Link href={x.href} className="card card-link flex h-full items-start gap-3 p-4">
              <Icon name={x.icon} size={22} className="mt-0.5 shrink-0 text-bronze" />
              <span className="min-w-0"><span className="block font-serif text-lg leading-tight">{x.title}</span><span className="mt-0.5 block text-sm text-ink-2">{x.why}</span></span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A Commons image with its credit beside it. */
export function Pictured({ image, alt, className = "" }: { image?: { url: string; page?: string; artist?: string; license?: string }; alt: string; className?: string }) {
  if (!image) return null;
  return (
    <figure className={className}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image.url} alt={alt} loading="lazy" className="h-56 w-full rounded-lg object-cover object-[50%_20%] sm:h-full sm:max-h-64" />
      <figcaption className="mt-1 truncate text-[11px] text-ink-2">{[artistOf(image.artist), image.license].filter(Boolean).join(", ")}{image.page && <>, <a className="link" href={image.page} target="_blank" rel="noopener noreferrer">Wikimedia Commons</a></>}</figcaption>
    </figure>
  );
}

/** A small link to the Wikidata statement behind a fact. */
export const Src = ({ href }: { href: string }) => <a href={href} target="_blank" rel="noopener noreferrer" className="ml-1 text-[11px] text-bronze hover:underline" title="The Wikidata statement this comes from">source</a>;
