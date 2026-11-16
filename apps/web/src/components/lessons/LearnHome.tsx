"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { CHECKED_PATH, lessonHref, PATHS, pathById, SKILLS, type PathDef, type Skill } from "@/lib/lessons";
import { today, toggleBookmark, totalXp, useProgress, type Progress } from "@/lib/progress";
import { ReviewBadge } from "../ui";
import { JourneyCatalog } from "./JourneyCatalog";

const DAY = 86400000;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** The lesson to offer first: an unfinished one, else the next in the last path used, else the first checked lesson. */
export function nextStep(p: Progress): { id: string; title: string; pathId: string; resume: boolean } {
  const open = Object.entries(p.lessons).filter(([, l]) => !l.finished).sort((a, b) => b[1].updatedAt.localeCompare(a[1].updatedAt))[0];
  if (open) return { id: open[0], title: open[1].title, pathId: open[1].pathId, resume: true };
  const last = Object.values(p.lessons).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  for (const path of [pathById(last?.pathId ?? ""), CHECKED_PATH, ...PATHS].filter(Boolean) as PathDef[]) {
    const l = path.lessons.find((x) => !p.lessons[x.id]?.finished);
    if (l) return { id: l.id, title: l.title, pathId: path.id, resume: false };
  }
  return { id: CHECKED_PATH.lessons[0].id, title: CHECKED_PATH.lessons[0].title, pathId: CHECKED_PATH.id, resume: false };
}

function Week({ days }: { days: string[] }) {
  const now = new Date();
  const week = Array.from({ length: 7 }, (_, i) => new Date(now.getTime() - (6 - i) * DAY));
  const active = week.filter((d) => days.includes(iso(d))).length;
  return (
    <div className="card p-4" data-testid="learning-days">
      <p className="text-sm font-semibold">This week</p>
      <ol className="mt-2 flex justify-between gap-1" aria-label={`Learned on ${active} of the last 7 days`}>
        {week.map((d) => {
          const on = days.includes(iso(d));
          return (
            <li key={iso(d)} className="flex flex-col items-center gap-1 text-xs text-ink-2">
              <span aria-hidden className={`grid h-8 w-8 place-items-center rounded-full border-2 ${on ? "border-bronze bg-bronze text-on-accent" : "border-line"} ${iso(d) === today() ? "ring-2 ring-bronze/40 ring-offset-1 ring-offset-paper" : ""}`}>{on ? "✓" : ""}</span>
              {d.toLocaleDateString("en", { weekday: "narrow" })}
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-xs text-ink-2">{active ? `Learned on ${active} of the last 7 days.` : "Nothing yet this week."} Breaks never cost you progress.</p>
    </div>
  );
}

function Skills({ p }: { p: Progress }) {
  return (
    <div className="card p-4" data-testid="skills">
      <p className="text-sm font-semibold">Skills</p>
      <ul className="mt-2 grid gap-2.5">
        {(Object.keys(SKILLS) as Skill[]).map((s) => {
          const log = p.skills.filter((x) => x.skill === s);
          const ok = log.filter((x) => x.ok).length;
          const pct = log.length ? Math.round((ok / log.length) * 100) : 0;
          return (
            <li key={s}>
              <div className="flex justify-between text-sm"><span title={SKILLS[s].help}>{SKILLS[s].label}</span><span className="tabular-nums text-ink-2">{log.length ? `${ok}/${log.length}` : "not started"}</span></div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-label={`${SKILLS[s].label}: ${ok} of ${log.length} correct`} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-navy [[data-theme=dark]_&]:bg-bronze" style={{ width: `${pct}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** A winding path of lessons with milestones; any lesson can be opened, the suggested one stands out. */
/** Save the journey to My Collection, or copy a link to it. */
function PathActions({ path }: { path: PathDef }) {
  const p = useProgress();
  const id = `path:${path.id}`;
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = `${window.location.origin}${window.location.pathname}?path=${path.id}`;
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { window.prompt("Copy this link", url); }
  };
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <button type="button" className="btn btn-secondary btn-sm" aria-pressed={!!p.bookmarks[id]} onClick={() => toggleBookmark({ id, title: path.title, href: `/learn?path=${path.id}`, context: `${path.lessons.length} lessons` })} data-testid="save-journey">
        {p.bookmarks[id] ? "Saved" : "Save journey"}
      </button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={share}>{copied ? "Link copied" : "Share"}</button>
    </div>
  );
}

function PathMap({ path, p }: { path: PathDef; p: Progress }) {
  const suggested = path.lessons.find((l) => !p.lessons[l.id]?.finished)?.id;
  const done = path.lessons.filter((l) => p.lessons[l.id]?.finished).length;
  return (
    <section aria-labelledby="path-title" data-testid="path-map">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="eyebrow">{{ question: "A question", region: "A region", period: "A period", topic: "A topic", place: "A place" }[path.kind]} · {path.difficulty}</p>
          <h2 id="path-title" className="mt-1 font-serif text-3xl leading-tight">{path.title}</h2>
          <p className="mt-1 max-w-xl text-ink-2">{path.blurb}</p>
          <details className="mt-1 max-w-xl text-sm text-ink-2">
            <summary className="cursor-pointer hover:text-ink">How these records were chosen</summary>
            <p className="mt-1">{path.why}</p>
          </details>
          <PathActions path={path} />
        </div>
        <div className="text-right">
          <ReviewBadge level={path.review === "source_checked" ? "source_checked" : "imported"} />
          <p className="mt-1 text-sm tabular-nums text-ink-2">{done} of {path.lessons.length} done</p>
        </div>
      </div>
      <ol className="relative mx-auto mt-6 max-w-md">
        <span aria-hidden className="absolute bottom-8 left-1/2 top-8 w-1 -translate-x-1/2 rounded-full bg-line" />
        {path.lessons.map((l, i) => {
          const state = p.lessons[l.id]?.finished ? "done" : p.lessons[l.id] ? "started" : l.id === suggested ? "next" : "open";
          const offset = ["sm:-translate-x-16", "", "sm:translate-x-16", ""][i % 4];
          return (
            <li key={l.id} className="relative">
              {l.milestone && (
                <p className="relative mx-auto my-4 w-fit rounded-full border border-line bg-paper-2 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-ink-2">{l.milestone}</p>
              )}
              <Link
                href={lessonHref(l.id, path.id)}
                className={`group relative mx-auto my-3 flex w-fit flex-col items-center gap-1.5 text-center ${offset}`}
                data-state={state}
                aria-label={`Lesson ${i + 1}: ${l.title}, ${l.minutes} minutes, ${state === "done" ? "done" : state === "started" ? "in progress" : state === "next" ? "suggested next" : "not started"}`}
              >
                <span
                  className={`grid h-16 w-16 place-items-center rounded-full border-b-4 font-serif text-2xl shadow-sm transition-transform group-hover:-translate-y-0.5 group-focus-visible:ring-4 group-focus-visible:ring-bronze/50 motion-reduce:transition-none ${
                    state === "done" ? "border-navy/70 bg-navy text-on-accent [[data-theme=dark]_&]:border-bronze/70 [[data-theme=dark]_&]:bg-bronze"
                    : state === "next" || state === "started" ? "border-bronze bg-bronze-soft text-ink ring-4 ring-bronze/30"
                    : "border-line bg-paper-2 text-ink-2"
                  }`}
                >
                  {state === "done" ? "✓" : i + 1}
                </span>
                <span className="max-w-48 rounded-md bg-paper/90 px-2 text-sm font-medium leading-tight">{l.title}</span>
                <span className="text-xs text-ink-2">{l.minutes} min{state === "next" ? " · up next" : state === "started" ? " · in progress" : ""}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function LearnHome() {
  const p = useProgress();
  const params = useSearchParams();
  const router = useRouter();
  const path = pathById(params.get("path") ?? "") ?? CHECKED_PATH;
  const step = useMemo(() => nextStep(p), [p]);
  const reviewable = p.mistakes.filter((m) => m.activity).length;
  const started = Object.keys(p.lessons).length > 0;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <p className="eyebrow">Learn</p>
          <h1 className="mt-2 font-serif text-4xl leading-tight sm:text-5xl">Real history, a few minutes at a time</h1>
          <p className="mt-3 max-w-2xl text-lg text-ink-2">Short lessons built from sourced records: read a little, answer a few questions, see why, and follow where it leads.</p>

          <div className="card mt-6 flex flex-col gap-4 border-2 border-bronze/40 p-5 sm:flex-row sm:items-center" data-testid="continue-learning">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-bronze">{step.resume ? "Continue where you stopped" : started ? "Up next" : "Start here"}</p>
              <p className="mt-1 font-serif text-2xl leading-tight">{step.title}</p>
              <p className="text-sm text-ink-2">{pathById(step.pathId)?.title}</p>
            </div>
            <Link href={lessonHref(step.id, step.pathId)} className="btn btn-primary !px-6 !py-3 text-base">{step.resume ? "Continue" : "Start lesson"}</Link>
          </div>

          <div className="mt-10"><PathMap path={path} p={p} /></div>
        </div>

        <aside className="grid content-start gap-4">
          <Week days={p.days} />
          <Skills p={p} />
          <div className="card p-4" data-testid="review-card">
            <p className="text-sm font-semibold">Review</p>
            <p className="mt-1 text-sm text-ink-2">{reviewable ? `${reviewable} question${reviewable > 1 ? "s" : ""} you missed, ready to try again.` : "Questions you miss come back here."}</p>
            {reviewable > 0 && <Link href="/learn/review" className="btn btn-secondary btn-sm mt-3">Review now</Link>}
          </div>
          <div className="card p-4 text-sm">
            <p className="font-semibold">{totalXp(p)} XP</p>
            <p className="mt-1 text-ink-2">Earned once per lesson or challenge, so it reflects what you&rsquo;ve done, not how often you replayed it. Progress is kept in this browser only.</p>
          </div>
        </aside>
      </div>

      <section className="mt-14" aria-labelledby="choose" id="choose-section">
        <h2 id="choose" className="font-serif text-3xl">Choose a journey</h2>
        <p className="mt-1 max-w-2xl text-ink-2">By question, topic, period, region or place. No journey covers everything.</p>
        <div className="mt-4">
          <JourneyCatalog current={path.id} onPick={(id) => { router.push(`/learn?path=${id}`, { scroll: false }); document.getElementById("path-title")?.scrollIntoView({ behavior: "smooth", block: "start" }); }} />
        </div>
      </section>

      <section className="mt-14 grid gap-4 md:grid-cols-2">
        <Link href="/challenges" className="card card-link block p-5">
          <p className="eyebrow">Practice more</p>
          <p className="mt-1 font-serif text-2xl">Challenges and the daily question</p>
          <p className="mt-1 text-ink-2">Sixteen challenges in five formats, from the checked collection.</p>
        </Link>
        <Link href="/challenges/case/ringstrasse" className="card card-link block p-5">
          <p className="eyebrow">Milestone case</p>
          <p className="mt-1 font-serif text-2xl">When did the Ringstrasse open?</p>
          <p className="mt-1 text-ink-2">Weigh three exhibits and decide what the evidence can settle.</p>
        </Link>
      </section>
    </div>
  );
}
