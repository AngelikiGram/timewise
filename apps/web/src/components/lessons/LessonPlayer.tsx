"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { finishLesson, logAnswer, readProgress, saveLessonStep, useProgress } from "@/lib/progress";
import { lessonHref, loadLesson, nextInPath, pathById, SKILLS, type LearnCard, type Lesson, type Skill } from "@/lib/lessons";
import { CreditedImage, ReviewBadge, SaveButton } from "../ui";
import { ActivityView, MiniMap, Sources, type Answer } from "./activities";

function Card({ card, review }: { card: LearnCard; review: Lesson["review"] }) {
  return (
    <article data-testid="learn-card">
      <p className="text-xs font-semibold uppercase tracking-wider text-bronze">{card.when}{card.where ? ` · ${card.where}` : ""}</p>
      <h2 className="mt-1 font-serif text-3xl leading-tight" tabIndex={-1} data-step-heading>{card.title}</h2>
      {card.summary && (
        <p className="mt-3 text-lg leading-relaxed">
          {card.summary}
          {card.summarySource && <span className="mt-1 block text-xs text-ink-2">{card.summarySource}, not checked by TIMEWISE.</span>}
        </p>
      )}
      {card.image ? (
        <CreditedImage className="mt-4" src={card.image.url} alt={card.image.title} credit={card.image} imgClassName="max-h-64 w-full rounded-md object-cover" />
      ) : card.point ? (
        <MiniMap className="mt-4" points={[{ label: card.where ?? card.title, lng: card.point[0], lat: card.point[1], answer: true }]} label={`Map: ${card.where ?? card.title}`} />
      ) : null}
      {card.claims.length > 0 && (
        <div className="mt-4 grid gap-3">
          {card.claims.map((c, i) => (
            <div key={i} className="rounded-md border border-line bg-paper-2 p-3">
              <p className="leading-relaxed">{c.text}</p>
              <p className="mt-1 text-xs text-ink-2"><span className="badge mr-1.5" title={c.supportHelp}>{c.support}</span>{c.supportHelp}</p>
              <Sources sources={c.sources} />
            </div>
          ))}
        </div>
      )}
      {review === "imported" && (
        <p className="mt-3 text-sm text-ink-2">Source: <a className="link" href={`https://www.wikidata.org/wiki/${card.id}`} target="_blank" rel="noopener noreferrer">Wikidata {card.id} ↗</a></p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <SaveButton id={card.id} title={card.title} href={card.saveHref} context={card.where} />
        {card.explore && <Link href={card.explore} className="btn btn-sm btn-ghost">Explore connections →</Link>}
      </div>
    </article>
  );
}

/**
 * One short lesson: an intro, a card per record, a few questions with explanations, and a summary.
 * The step is saved as the reader goes, so "Continue learning" returns to it.
 */
export function LessonPlayer() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("id") ?? "";
  const pathId = params.get("path") ?? "";
  const progress = useProgress();
  const [lesson, setLesson] = useState<Lesson | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<number, Answer>>({});
  const [xp, setXp] = useState<number | null>(null);
  const started = useRef(false);
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ac = new AbortController();
    setLesson(undefined);
    setFailed(false);
    setAnswers({});
    setXp(null);
    started.current = false;
    loadLesson(id, pathId || undefined, ac.signal).then(setLesson, (e) => { if (e.name !== "AbortError") setFailed(true); });
    return () => ac.abort();
  }, [id, pathId, retry]);

  const steps = lesson ? 1 + lesson.cards.length + lesson.activities.length + 1 : 0;
  const path = pathById(lesson?.pathId || pathId);

  // Resume where the reader stopped, once.
  useEffect(() => {
    if (!lesson || started.current) return;
    started.current = true;
    const saved = readProgress().lessons[lesson.id];
    setStep(saved && !saved.finished && saved.step < steps - 1 ? saved.step : 0);
  }, [lesson, steps]);

  useEffect(() => {
    if (!lesson || !started.current || !lesson.cards.length) return;
    if (step < steps - 1) saveLessonStep(lesson.id, { step, steps, title: lesson.title, pathId: lesson.pathId });
    stage.current?.querySelector<HTMLElement>("[data-step-heading]")?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [step, lesson, steps]);

  const go = (n: number) => setStep(Math.max(0, Math.min(steps - 1, n)));
  const cardStart = 1;
  const actStart = 1 + (lesson?.cards.length ?? 0);
  const summaryAt = steps - 1;
  const score = Object.values(answers).filter((a) => a.ok).length;
  const asked = Object.keys(answers).length;

  // Finish once the summary is reached.
  useEffect(() => {
    if (lesson && step === summaryAt && steps > 2 && xp === null) setXp(finishLesson(lesson.id, score, asked));
  }, [step, summaryAt, steps, lesson, score, asked, xp]);

  const next = lesson ? nextInPath(lesson.pathId, lesson.id) : undefined;
  const skills = useMemo(() => [...new Set(lesson?.activities.map((a) => a.skill) ?? [])] as Skill[], [lesson]);

  if (failed) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="font-serif text-2xl">This lesson couldn&rsquo;t be loaded.</p>
        <p className="mt-2 text-ink-2">Its records come from a data file that didn&rsquo;t arrive. Check the connection and try again.</p>
        <div className="mt-4 flex justify-center gap-2"><button type="button" className="btn btn-primary" onClick={() => setRetry((r) => r + 1)}>Try again</button><Link href="/learn" className="btn btn-secondary">All lessons</Link></div>
      </div>
    );
  }
  if (lesson === undefined) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16" role="status">
        <div className="skeleton h-3 w-full rounded-full" />
        <div className="skeleton mt-8 h-10 w-2/3 rounded" />
        <div className="skeleton mt-4 h-24 w-full rounded" />
        <p className="mt-4 text-ink-2">Gathering the records for this lesson…</p>
      </div>
    );
  }
  if (lesson === null) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="font-serif text-2xl">There&rsquo;s no lesson with this name.</p>
        <Link href="/learn" className="btn btn-primary mt-4">Choose a lesson</Link>
      </div>
    );
  }
  if (!lesson.cards.length) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center" data-testid="lesson-unavailable">
        <p className="font-serif text-2xl">{lesson.title}: not enough records yet</p>
        <p className="mt-2 text-ink-2">{lesson.gaps[0]}</p>
        <div className="mt-4 flex justify-center gap-2">
          {next && <Link href={lessonHref(next.id, lesson.pathId)} className="btn btn-primary">Try {next.title}</Link>}
          <Link href="/learn" className="btn btn-secondary">All lessons</Link>
        </div>
      </div>
    );
  }

  const pct = Math.round((step / (steps - 1)) * 100);
  return (
    <div className="mx-auto max-w-2xl px-4 pb-16 pt-4 sm:px-6" data-testid="lesson" data-lesson={lesson.id}>
      <div className="sticky top-14 z-20 -mx-4 flex items-center gap-3 bg-paper/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <Link href={`/learn?path=${lesson.pathId}`} className="btn btn-ghost btn-icon" aria-label="Leave the lesson (your place is saved)">✕</Link>
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Lesson progress">
          <div className="h-full rounded-full bg-bronze transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-sm tabular-nums text-ink-2">{step + 1}/{steps}</span>
      </div>

      <div ref={stage} className="mt-4" key={step}>
        {step === 0 && (
          <section data-testid="lesson-intro" className="fade-in">
            <p className="eyebrow">{path?.title ?? "Lesson"}</p>
            <h1 className="mt-2 font-serif text-4xl leading-tight" tabIndex={-1} data-step-heading>{lesson.title}</h1>
            <div className="mt-3"><ReviewBadge level={lesson.review === "source_checked" ? "source_checked" : "imported"} /></div>
            <p className="mt-4 text-lg leading-relaxed">{lesson.intro}</p>
            <ul className="mt-5 grid gap-1 text-ink-2">
              <li>About {lesson.minutes} minutes</li>
              <li>{lesson.cards.length} records to read, then {lesson.activities.length} questions</li>
              <li>Practises: {skills.map((s) => SKILLS[s].label.toLowerCase()).join(", ")}</li>
            </ul>
            {progress.lessons[lesson.id]?.finished && <p className="mt-3 text-sm text-ink-2">You&rsquo;ve finished this lesson before. Replaying is good practice, but earns no new XP.</p>}
            <button type="button" className="btn btn-primary mt-6 w-full sm:w-auto" onClick={() => go(1)} data-testid="continue">Start</button>
          </section>
        )}
        {step >= cardStart && step < actStart && (
          <div className="fade-in">
            <Card card={lesson.cards[step - cardStart]} review={lesson.review} />
            <div className="mt-6 flex gap-2">
              <button type="button" className="btn btn-secondary" onClick={() => go(step - 1)}>Back</button>
              <button type="button" className="btn btn-primary flex-1 sm:flex-none" onClick={() => go(step + 1)} data-testid="continue">{step + 1 === actStart ? "Start the questions" : "Next"}</button>
            </div>
          </div>
        )}
        {step >= actStart && step < summaryAt && (() => {
          const i = step - actStart;
          const a = lesson.activities[i];
          return (
            <div className="fade-in">
              <ActivityView
                activity={a}
                seed={(id.length + i) * 7 + 3}
                onAnswer={(r) => {
                  setAnswers((all) => ({ ...all, [i]: r }));
                  logAnswer(lesson.id, a.skill, r.ok, { prompt: `${a.prompt}${a.kind === "choice" && a.context ? ` ${a.context}` : ""}`, correct: r.correct, activity: a });
                }}
                onNext={() => go(step + 1)}
                nextLabel={step + 1 === summaryAt ? "See what you learned" : "Continue"}
              />
            </div>
          );
        })()}
        {step === summaryAt && (
          <section className="fade-in" data-testid="lesson-summary">
            <p className="eyebrow">Lesson complete</p>
            <h1 className="mt-2 font-serif text-4xl leading-tight" tabIndex={-1} data-step-heading>{lesson.title}</h1>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="card p-4"><p className="font-serif text-3xl tabular-nums">{score}/{asked}</p><p className="text-sm text-ink-2">answered correctly</p></div>
              <div className="card p-4"><p className="font-serif text-3xl tabular-nums">{xp ?? 0}</p><p className="text-sm text-ink-2">{xp ? "XP earned" : "XP (earned once per lesson)"}</p></div>
              <div className="card col-span-2 p-4 sm:col-span-1"><p className="text-sm font-semibold">Skills practised</p><p className="text-sm text-ink-2">{skills.map((s) => SKILLS[s].label).join(", ")}</p></div>
            </div>
            <h2 className="mt-6 font-serif text-2xl">What you learned</h2>
            <ul className="mt-2 grid gap-2">
              {lesson.cards.map((c) => (
                <li key={c.id} className="rounded-md border border-line bg-paper-2 px-3 py-2">
                  <span className="font-medium">{c.title}</span> <span className="text-ink-2">· {c.when}{c.where ? ` · ${c.where}` : ""}</span>
                  {c.claims.length > 0 && <span className="block text-xs text-ink-2">{c.claims.length} sourced statement{c.claims.length > 1 ? "s" : ""}</span>}
                </li>
              ))}
            </ul>
            {lesson.gaps.length > 0 && (
              <div className="mt-4 rounded-md border border-dashed border-line p-3 text-sm text-ink-2">
                <p className="font-semibold text-ink">What this lesson couldn&rsquo;t cover</p>
                <ul className="mt-1 list-disc pl-5">{lesson.gaps.map((g) => <li key={g}>{g}</li>)}</ul>
              </div>
            )}
            {asked > score && <p className="mt-4"><Link href="/learn/review" className="link">Review the {asked - score} question{asked - score > 1 ? "s" : ""} you missed →</Link></p>}
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              {next ? (
                <button type="button" className="btn btn-primary" onClick={() => router.push(lessonHref(next.id, lesson.pathId))} data-testid="next-lesson">Next lesson: {next.title} →</button>
              ) : (
                <Link href="/learn" className="btn btn-primary">Path complete: choose another →</Link>
              )}
              <button type="button" className="btn btn-secondary" onClick={() => { setAnswers({}); setXp(null); go(0); }}>Replay</button>
            </div>
            <h2 className="mt-8 font-serif text-xl">Keep exploring</h2>
            <ul className="mt-2 grid gap-1.5">
              {lesson.related.map((r) => <li key={r.href}><Link href={r.href} className="link">{r.label} →</Link></li>)}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
