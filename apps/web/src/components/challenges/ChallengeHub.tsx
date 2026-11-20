"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CHALLENGES, challengeById, dailyChallenge, FORMATS, type Challenge } from "@/lib/challenges";
import { clearMistake, totalXp, useProgress } from "@/lib/progress";
import { STORIES } from "@/lib/stories";
import { ChallengePlayer } from "./ChallengePlayer";
import { Icon } from "../icons";

const KINDS = Object.keys(FORMATS) as Challenge["kind"][];

export function ChallengeHub() {
  const p = useProgress();
  const [today, setToday] = useState<ReturnType<typeof dailyChallenge> | null>(null);
  // The day is the reader's own, so it's worked out in the browser.
  useEffect(() => setToday(dailyChallenge()), []);
  const done = (id: string) => p.results.some((r) => r.id === id && r.mode === "challenge");
  const best = (id: string) => p.results.filter((r) => r.id === id && r.mode === "challenge").reduce((m, r) => Math.max(m, r.score / r.max), -1);
  const dailyDone = today ? p.results.some((r) => r.id === `daily:${today.day}`) : false;
  const days = new Set(p.results.filter((r) => r.id.startsWith("daily:")).map((r) => r.id.slice(6)));
  let streak = 0;
  for (let d = new Date(); days.has(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() - 1)) streak++;
  const caseStory = STORIES.find((s) => s.kind === "case")!;
  const caseDone = p.stories[caseStory.id]?.finished;

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Challenges</p>
          <h1 className="mt-2 font-serif text-4xl leading-tight sm:text-5xl">Test what you&rsquo;ve learned</h1>
          <p className="mt-2 max-w-2xl text-lg text-ink-2">Short puzzles built from the hand-checked collection. Every answer is explained, with its source.</p>
        </div>
        <dl className="flex gap-6 text-center" aria-label="Your progress">
          <div><dt className="text-xs text-ink-2">XP</dt><dd className="font-serif text-3xl tabular-nums" data-testid="xp-total">{totalXp(p)}</dd></div>
          <div><dt className="text-xs text-ink-2">Completed</dt><dd className="font-serif text-3xl tabular-nums">{CHALLENGES.filter((c) => done(c.id)).length}/{CHALLENGES.length}</dd></div>
          <div><dt className="text-xs text-ink-2">Daily streak</dt><dd className="font-serif text-3xl tabular-nums">{streak}</dd></div>
        </dl>
      </header>

      <section aria-labelledby="today" className="mt-8">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="today" className="font-serif text-2xl">Today&rsquo;s challenge</h2>
          {dailyDone && <span className="badge text-navy">✓ Done today</span>}
        </div>
        <div className="mt-3">
          {today ? <ChallengePlayer challenge={today.challenge} daily={today.day} /> : <div className="skeleton h-64" />}
        </div>
        <p className="mt-2 text-xs text-ink-2">A new one each day. The daily bonus is 5 XP, once per day. Progress is kept in this browser only.</p>
      </section>

      <section aria-labelledby="games" className="mt-12">
        <h2 id="games" className="font-serif text-2xl">Endless games</h2>
        <p className="text-sm text-ink-2">New rounds every time, from thousands of real records.</p>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          <li><Link href="/challenges/timeline" className="card card-link flex h-full items-start gap-3 p-5" data-testid="game-timeline"><Icon name="sequence" size={28} className="mt-1 shrink-0 text-bronze" /><span><span className="block font-serif text-2xl leading-tight">Build your own timeline</span><span className="mt-1 block text-ink-2">Put real events in order, any era, any region. Then see them on the true timeline and the map.</span></span></Link></li>
          <li><Link href="/challenges/fact-or-myth" className="card card-link flex h-full items-start gap-3 p-5" data-testid="game-facts"><Icon name="checked" size={28} className="mt-1 shrink-0 text-bronze" /><span><span className="block font-serif text-2xl leading-tight">Fact or myth?</span><span className="mt-1 block text-ink-2">Supported, uncertain, or marked wrong? Judge claims about famous lives, then see the record.</span></span></Link></li>
        </ul>
      </section>

      <section aria-labelledby="case" className="mt-12">
        <h2 id="case" className="font-serif text-2xl">Detective case</h2>
        <Link href={caseStory.href} className="card mt-3 grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
          <span>
            <span className="eyebrow">{caseStory.place}, {caseStory.period}, {caseStory.minutes} min, {caseStory.difficulty}</span>
            <span className="mt-1 block font-serif text-2xl leading-tight">{caseStory.title}</span>
            <span className="mt-1 block text-ink-2">{caseStory.question}</span>
          </span>
          <span className="btn btn-primary">{caseDone ? "Review the case" : "Open the case"}</span>
        </Link>
      </section>

      {p.mistakes.length > 0 && (
        <section aria-labelledby="review" className="mt-12">
          <h2 id="review" className="font-serif text-2xl">Review: things to revisit</h2>
          <p className="mt-1 text-sm text-ink-2">From your earlier answers. Get it right again and it leaves this list.</p>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {p.mistakes.slice(-6).reverse().map((m) => {
              const c = challengeById.get(m.challengeId);
              return (
                <li key={m.prompt} className="card p-4">
                  <p className="font-medium">{m.prompt}</p>
                  <details className="mt-2 text-sm"><summary className="cursor-pointer text-bronze">Show the answer</summary><p className="mt-1 text-ink-2">{m.correct}</p></details>
                  <div className="mt-3 flex gap-2">
                    <Link href={c ? `/challenges/${c.id}` : caseStory.href} className="btn btn-sm btn-secondary">Try it again</Link>
                    <button type="button" onClick={() => clearMistake(m.prompt)} className="btn btn-sm btn-ghost">I&rsquo;ve got it</button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {KINDS.map((k) => (
        <section key={k} aria-labelledby={`f-${k}`} className="mt-12">
          <h2 id={`f-${k}`} className="font-serif text-2xl">{FORMATS[k].label}</h2>
          <p className="text-sm text-ink-2">{FORMATS[k].help}</p>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CHALLENGES.filter((c) => c.kind === k).map((c) => {
              const b = best(c.id);
              return (
                <li key={c.id}>
                  <Link href={`/challenges/${c.id}`} className="card flex h-full flex-col p-4">
                    <span className="flex items-center justify-between text-xs text-ink-2">
                      <span>{c.theme}, {c.minutes} min, {c.xp} XP</span>
                      {b >= 0 && <span className={`badge ${b === 1 ? "text-navy" : "text-bronze"}`}>{b === 1 ? "✓ Perfect" : `Best ${Math.round(b * 100)}%`}</span>}
                    </span>
                    <span className="mt-2 font-serif text-xl leading-snug">{c.title}</span>
                    <span className="mt-1 text-sm text-ink-2">{c.prompt}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <section className="mt-12 rounded-lg border border-line p-5">
        <h2 className="font-serif text-xl">Activities inside the story</h2>
        <p className="mt-1 text-ink-2">The Austria story has its own chapter activities: cause and effect, perspectives and evidence gaps.</p>
        <Link href="/learn" className="link mt-2 inline-block">Open the story activities</Link>
      </section>
    </main>
  );
}
