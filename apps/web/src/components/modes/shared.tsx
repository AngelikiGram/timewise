"use client";

import Link from "next/link";
import { artistOf, interestOf } from "@/lib/explore";
export { artistOf };
import { setInterests, useProgress } from "@/lib/progress";
import { Icon, type IconName } from "../icons";

/** The four ways in, with the one you're on marked. */
export const MODES: { id: "thing" | "year" | "life" | "interests"; label: string; icon: IconName; href: string }[] = [
  { id: "thing", label: "Follow a thing", icon: "network", href: "/explore/thing?id=art-nouveau" },
  { id: "year", label: "Explore a year", icon: "timeline", href: "/explore/year?y=1900" },
  { id: "life", label: "Follow a life", icon: "person", href: "/explore/life" },
  { id: "interests", label: "Your interests", icon: "idea", href: "/explore/interests" },
];

export function ModeBar({ on }: { on: (typeof MODES)[number]["id"] }) {
  return (
    <nav aria-label="Ways to explore" className="flex flex-wrap gap-1.5" data-testid="mode-bar">
      {MODES.map((m) => (
        <Link key={m.id} href={m.href} aria-current={m.id === on ? "page" : undefined} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${m.id === on ? "border-bronze bg-bronze text-paper" : "border-line bg-paper-2 text-ink-2 hover:text-ink"}`}>
          <Icon name={m.icon} size={15} />{m.label}
        </Link>
      ))}
    </nav>
  );
}

/** Keep a topic, person or year among your interests, so suggestions follow from it. */
export function SaveInterest({ kind, id, label }: { kind: keyof typeof interestOf; id: string | number; label: string }) {
  const p = useProgress();
  const key = (interestOf[kind] as (x: never) => string)(id as never);
  const on = (p.interests ?? []).includes(key);
  return (
    <button type="button" aria-pressed={on} data-testid="save-interest" className={`btn btn-sm ${on ? "!border-bronze !bg-bronze !text-paper" : "btn-secondary"}`}
      onClick={() => setInterests(on ? (p.interests ?? []).filter((x) => x !== key) : [...(p.interests ?? []), key])}>
      <Icon name="idea" size={15} />{on ? `${label}: in your interests` : `Add ${label} to your interests`}
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
      <img src={image.url} alt={alt} loading="lazy" className="h-full max-h-64 w-full rounded-lg object-cover" />
      <figcaption className="mt-1 truncate text-[11px] text-ink-2">{[artistOf(image.artist), image.license].filter(Boolean).join(" · ")}{image.page && <> · <a className="link" href={image.page} target="_blank" rel="noopener noreferrer">Wikimedia Commons</a></>}</figcaption>
    </figure>
  );
}

/** A small link to the Wikidata statement behind a fact. */
export const Src = ({ href }: { href: string }) => <a href={href} target="_blank" rel="noopener noreferrer" className="ml-1 text-[11px] text-bronze hover:underline" title="The Wikidata statement this comes from">source</a>;
