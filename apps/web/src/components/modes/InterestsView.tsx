"use client";

import Link from "next/link";
import { PEOPLE, suggestFor, TOPICS } from "@/lib/explore";
import { useProgress } from "@/lib/progress";
import { recommendedPaths } from "@/lib/recommend";
import { Icon } from "../icons";
import { ModeBar, SaveInterest } from "./shared";

const MODE_ICON = { thing: "network", life: "person", year: "timeline" } as const;

/** Follow your interests: what you saved, and journeys that combine the other three ways in. */
export function InterestsView() {
  const p = useProgress();
  const mine = p.interests ?? [];
  const suggestions = suggestFor(mine);
  const paths = recommendedPaths(p);
  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6" data-testid="interests-view">
      <ModeBar on="interests" />
      <h1 className="mt-5 font-serif text-4xl">Your interests</h1>
      <p className="mt-1 max-w-2xl text-ink-2">Add things and people you care about, here or on their pages. Suggestions then combine the other ways in: a thing to follow, a life, a year.</p>

      <section className="mt-6" aria-labelledby="pick">
        <h2 id="pick" className="text-sm font-semibold uppercase tracking-wider text-ink-2">Things</h2>
        <div className="mt-2 flex flex-wrap gap-2">{TOPICS.map((t) => <SaveInterest key={t.id} kind="topic" id={t.id} label={t.label} />)}</div>
        <h2 className="mt-4 text-sm font-semibold uppercase tracking-wider text-ink-2">People</h2>
        <div className="mt-2 flex flex-wrap gap-2">{PEOPLE.slice(0, 8).map((x) => <SaveInterest key={x.id} kind="person" id={x.id} label={x.label} />)}</div>
      </section>

      <section className="mt-8" aria-labelledby="for-you">
        <h2 id="for-you" className="font-serif text-2xl">Suggested for you</h2>
        {suggestions.length ? (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="suggestions">
            {suggestions.slice(0, 9).map((s) => (
              <li key={s.href}>
                <Link href={s.href} className="card card-link flex h-full items-start gap-3 p-4">
                  <Icon name={MODE_ICON[s.mode]} size={22} className="mt-0.5 shrink-0 text-bronze" />
                  <span><span className="block text-xs font-semibold uppercase tracking-wider text-bronze">{{ thing: "Follow a thing", life: "Follow a life", year: "Explore a year" }[s.mode]}</span><span className="block font-serif text-lg leading-tight">{s.title}</span><span className="block text-sm text-ink-2">{s.why}</span></span>
                </Link>
              </li>
            ))}
          </ul>
        ) : <p className="mt-2 text-sm text-ink-2">Add a thing or a person above, and suggestions appear here.</p>}
      </section>

      <section className="mt-8" aria-labelledby="lessons-for-you">
        <h2 id="lessons-for-you" className="font-serif text-2xl">Lessons to go with them</h2>
        <ul className="mt-3 grid gap-3 md:grid-cols-3">{paths.map(({ path, why }) => <li key={path.id}><Link href={`/learn?path=${path.id}`} className="card card-link block h-full p-4"><span className="text-xs font-semibold uppercase tracking-wider text-bronze">{why}</span><span className="mt-1 block font-serif text-lg leading-tight">{path.title}</span></Link></li>)}</ul>
      </section>
    </div>
  );
}
