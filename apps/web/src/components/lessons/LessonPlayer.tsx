"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { finishLesson, logAnswer, queueReview, readProgress, saveLessonStep, useProgress } from "@/lib/progress";
import type { Activity } from "@/lib/lessons";
import type { Entity } from "@/lib/entities";
import { completeLessonAtlas, encounterEntities, type AtlasGrowth } from "@/lib/progress";
import { EntityPanel } from "../atlas/EntityPanel";
import { aboutOf, LessonContext, LessonSide, lessonOrder } from "./LessonSide";
import { ConnectExercise } from "../atlas/ConnectExercise";
import { MeanwhileQuiz } from "./MeanwhileQuiz";

/** The entities a finished lesson practised: its records, their places, and the people it names. */
const centralOf = (l: Lesson): Entity[] => {
  const seen = new Map<string, Entity>();
  for (const c of l.cards) for (const e of [c.entity, c.place, ...(c.people ?? []).map((x) => x.entity)]) if (e && !seen.has(e.id)) seen.set(e.id, e);
  return [...seen.values()];
};
const PLURAL: Record<string, [string, string]> = { event: ["event", "events"], person: ["person", "people"], place: ["place", "places"], country: ["country", "countries"], organization: ["organisation", "organisations"], object: ["object", "objects"] };
function describeGrowth(g: AtlasGrowth) {
  const parts = Object.entries(g.newByType).map(([t, n]) => `${n} new ${PLURAL[t]?.[n === 1 ? 0 : 1] ?? t}`);
  if (g.newEdges) parts.push(`${g.newEdges} sourced connection${g.newEdges === 1 ? "" : "s"}`);
  if (g.earlier.length) parts.push(`${g.earlier.length} link${g.earlier.length === 1 ? "" : "s"} to earlier lessons`);
  return parts.length ? parts.join(", ") : "nothing new this time, but you practised what's already there";
}

/** The text a question is filed under in Review, the same whether it was missed or added by hand. */
const reviewPrompt = (a: Activity) => `${a.prompt}${a.kind === "choice" && a.context ? ` ${a.context}` : a.kind === "timeline" ? ` ${a.target}` : ""}`;
const correctOf = (a: Activity) => (a.kind === "choice" ? a.options.find((o) => o.id === a.answer)?.label ?? "" : a.kind === "order" ? a.items.map((x) => x.label).join(" ") : a.answer === 0 ? `Before ${a.anchors[0].label}` : a.answer === a.anchors.length ? `After ${a.anchors[a.anchors.length - 1].label}` : `Between ${a.anchors[a.answer - 1].label} and ${a.anchors[a.answer].label}`);
import { continentOfPath, ERA_COLOR, eraOf, lessonHref, loadLesson, nextInPath, pathById, SKILLS, type LearnCard, type Lesson, type Skill } from "@/lib/lessons";
import { CreditedImage, ReviewBadge, SaveButton } from "../ui";
import { ActivityView, MiniMap, Sources, type Answer } from "./activities";
import { formatYear } from "@/lib/dates";

/**
 * Where and when the lesson's records are, before the first card: a map and a timeline that point at the same
 * numbered steps. Click a number on either, or a line of the list, to see what that step is about and go to it.
 */
function Overview({ cards, onJump }: { cards: LearnCard[]; onJump: (i: number) => void }) {
  const [sel, setSel] = useState<number | null>(null);
  const placed = cards.map((c, i) => ({ c, i })).filter((x) => x.c.point);
  const dated = cards.map((c, i) => ({ c, i })).filter((x) => x.c.year !== undefined).sort((a, b) => a.c.year! - b.c.year!);
  const lo = dated[0]?.c.year ?? 0;
  const hi = dated[dated.length - 1]?.c.year ?? 0;
  const span = Math.max(1, hi - lo);
  const pick = (i: number) => setSel(sel === i ? null : i);
  const s = sel != null ? cards[sel] : null;
  return (
    <div className="mt-5 grid gap-4 md:grid-cols-2" data-testid="lesson-overview">
      {placed.length > 0 && (
        <div className="min-w-0">
          <MiniMap points={placed.map(({ c, i }) => ({ label: String(i + 1), lng: c.point![0], lat: c.point![1], answer: true }))} titles={placed.map(({ c, i }) => `${i + 1}. ${c.title}${c.where ? ` · ${c.where}` : ""}`)}
            selected={sel == null ? null : placed.findIndex((x) => x.i === sel)} onPick={(k) => pick(placed[k].i)} label={`Map of the lesson's ${placed.length} records`} />
        </div>
      )}
      {dated.length > 1 && (
        <figure className="flex min-w-0 flex-col justify-center px-4">
          <div className="relative h-24" role="group" aria-label={`Timeline from ${formatYear(lo)} to ${formatYear(hi)}`}>
            <span aria-hidden className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded bg-line" />
            {dated.map(({ c, i }, k) => {
              const at = ((c.year! - lo) / span) * 100;
              const up = k % 2 === 1;
              return (
                <button key={c.id} type="button" onClick={() => pick(i)} aria-pressed={sel === i} title={`${i + 1}. ${c.title}, ${c.when}`}
                  className="group absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${at}%` }}>
                  <span className={`grid h-8 w-8 place-items-center rounded-full border-2 border-white text-sm font-bold text-white shadow transition-transform group-hover:scale-125 ${sel === i ? "scale-125 bg-oxblood" : "bg-bronze"}`}>{i + 1}</span>
                  <span className={`absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-xs tabular-nums ${sel === i ? "font-semibold text-ink" : "text-ink-2"} ${up ? "bottom-10" : "top-10"}`}>{formatYear(c.year!)}</span>
                </button>
              );
            })}
          </div>
          <figcaption className="mt-1 text-center text-xs text-ink-2">{formatYear(lo)} to {formatYear(hi)} · click a number</figcaption>
        </figure>
      )}
      <ol className="grid gap-1 text-sm md:col-span-2">
        {cards.map((c, i) => (
          <li key={c.id}>
            <button type="button" onClick={() => pick(i)} aria-pressed={sel === i} className={`flex w-full gap-2 rounded-lg px-1.5 py-1 text-left ${sel === i ? "bg-bronze-soft/50" : "hover:bg-paper-2"}`}>
              <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold text-white ${sel === i ? "bg-oxblood" : "bg-bronze"}`}>{i + 1}</span>
              <span className="min-w-0">{c.title} <span className="text-ink-2">· {c.when}{c.where ? ` · ${c.where}` : " · no single location"}</span></span>
            </button>
          </li>
        ))}
      </ol>
      {s && sel != null && (
        <div className="fade-in rounded-xl border-2 border-bronze/50 bg-paper p-4 md:col-span-2" data-testid="overview-detail">
          <div className="flex gap-4">
            {s.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.image.url} alt={s.image.title} className="h-24 w-24 shrink-0 rounded-lg object-cover" />
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold text-bronze">Step {sel + 1} · {s.when}{s.where ? ` · ${s.where}` : ""}</p>
              <p className="font-serif text-2xl leading-tight">{s.title}</p>
              {s.summary && <p className="mt-1 text-sm leading-relaxed">{s.summary.length > 320 ? `${s.summary.slice(0, 310).replace(/\s\S*$/, "")}…` : s.summary}</p>}
              {!s.summary && s.claims[0] && <p className="mt-1 text-sm leading-relaxed">{s.claims[0].text}</p>}
              {s.image && <p className="mt-1 text-[10px] text-ink-2">{[s.image.creator, s.image.license].filter(Boolean).join(" · ")}</p>}
            </div>
          </div>
          <button type="button" className="btn btn-primary btn-sm mt-3" onClick={() => onJump(sel)}>Go to step {sel + 1}</button>
        </div>
      )}
    </div>
  );
}

function EntityButton({ entity, onOpen, met, children, className = "" }: { entity: Entity; onOpen: (e: Entity) => void; met?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <button type="button" onClick={() => onOpen(entity)} className={`underline decoration-bronze/60 decoration-dotted decoration-2 underline-offset-4 hover:decoration-solid ${className}`} data-entity={entity.id} aria-label={`${entity.label}: open details${met ? ", met before" : ""}`}>
      {children}{met && <span className="ml-1 align-super text-[0.6em] text-bronze" aria-hidden>●</span>}
    </button>
  );
}

function Card({ card, review, onOpen, metBefore, context }: { card: LearnCard; review: Lesson["review"]; onOpen: (e: Entity) => void; metBefore: (id: string) => boolean; context?: React.ReactNode }) {
  return (
    <article data-testid="learn-card">
      <p className="text-xs font-semibold text-bronze">{card.when}{card.where ? <> · {card.place ? <EntityButton entity={card.place} onOpen={onOpen} met={metBefore(card.place.id)} className="">{card.where}</EntityButton> : card.where}</> : ""}</p>
      <h2 className="mt-1 font-serif text-3xl leading-tight" tabIndex={-1} data-step-heading><EntityButton entity={card.entity} onOpen={onOpen} met={metBefore(card.entity.id)} className="text-left">{card.title}</EntityButton></h2>
      {(card.people?.length ?? 0) > 0 && (
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm" data-testid="card-people">
          <span className="text-ink-2">People:</span>
          {card.people!.map((x) => x.entity
            ? <EntityButton key={x.name} entity={x.entity} onOpen={onOpen} met={metBefore(x.entity.id)}>{x.name}</EntityButton>
            : <span key={x.name} title="Not linked: this name's identity hasn't been resolved">{x.name}</span>)}
        </p>
      )}
      {[card.entity, card.place, ...(card.people ?? []).map((x) => x.entity)].some((e) => e && metBefore(e.id)) && (
        <p className="mt-2 text-sm text-bronze" data-testid="seen-before">● You&rsquo;ve met {[card.entity, card.place, ...(card.people ?? []).map((x) => x.entity)].filter((e): e is Entity => !!e && metBefore(e.id)).map((e) => e.label).join(", ")} in an earlier lesson. Open the name to see where.</p>
      )}
      {card.summary && (
        <p className="mt-3 text-lg leading-relaxed">
          {card.summary}
          {card.summarySource && <span className="mt-1 block text-xs text-ink-2">{card.summarySource}, not checked by TIMEWISE.</span>}
        </p>
      )}
      {context}
      {card.image && <CreditedImage className="mt-4" src={card.image.url} alt={card.image.title} credit={card.image} imgClassName="max-h-56 w-full rounded-md object-cover" />}
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
        {card.explore && <Link href={card.explore} className="btn btn-sm btn-ghost">Explore connections</Link>}
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
  const [panel, setPanel] = useState<Entity | null>(null);
  const [growth, setGrowth] = useState<AtlasGrowth | null>(null);
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

  // One record, then one question about it, then the next record; questions about the whole lesson come last.
  const order = useMemo(() => lessonOrder(lesson), [lesson]);
  const steps = order.length;
  const slot = order[step];
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
  const summaryAt = steps - 1;
  const cardAt = slot?.kind === "card" ? lesson?.cards[slot.i] : undefined;
  const actAt = slot?.kind === "act" ? slot.i : -1;
  const stepOfCard = (ci: number) => order.findIndex((o) => o.kind === "card" && o.i === ci);
  const score = Object.values(answers).filter((a) => a.ok).length;
  const asked = Object.keys(answers).length;

  // Finish once the summary is reached.
  useEffect(() => {
    if (lesson && step === summaryAt && steps > 2 && xp === null) {
      setXp(finishLesson(lesson.id, score, asked));
      setGrowth(completeLessonAtlas(lesson.id, centralOf(lesson), lesson.edges, lesson.extra));
    }
  }, [step, summaryAt, steps, lesson, score, asked, xp]);

  // A card's entities are encountered when it's shown: seen, not yet explored or learned.
  useEffect(() => {
    const o = order[step];
    if (!lesson || o?.kind !== "card") return;
    const c = lesson.cards[o.i];
    encounterEntities(lesson.id, [c.entity, ...(c.place ? [c.place] : []), ...(c.people ?? []).flatMap((x) => (x.entity ? [x.entity] : []))]);
  }, [lesson, step, order]);
  const metBefore = (id: string) => (progress.atlas?.nodes[id]?.lessons ?? []).some((l) => l !== lesson?.id && progress.lessons[l]);
  const lessonTitles = Object.fromEntries(Object.entries(progress.lessons).map(([k, v]) => [k, v.title]));
  const entityMap: Record<string, Entity> = lesson ? Object.fromEntries([...lesson.cards.flatMap((c) => [c.entity, c.place, ...(c.people ?? []).map((x) => x.entity)]), ...(lesson.extra ?? [])].filter((e): e is Entity => !!e).map((e) => [e.id, e])) : {};
  const labels = lesson ? Object.fromEntries([...lesson.cards.flatMap((c) => [c.entity, c.place, ...(c.people ?? []).map((x) => x.entity)]), ...(lesson.extra ?? [])].filter((e): e is Entity => !!e).map((e) => [e.id, e.label])) : {};

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
    <div className="mx-auto max-w-[1500px] px-4 pb-16 pt-3 sm:px-6" data-testid="lesson" data-lesson={lesson.id}>
      <div className="sticky top-14 z-20 -mx-4 flex flex-wrap items-center gap-x-3 gap-y-1 bg-paper/95 px-4 py-2.5 backdrop-blur sm:-mx-6 sm:px-6">
        <Link href={`/learn?path=${lesson.pathId}`} className="btn btn-ghost btn-icon" aria-label="Leave the lesson (your place is saved)">✕</Link>
        <nav aria-label="Where you are" className="min-w-0 flex-1 truncate text-sm text-ink-2">
          <Link href={`/learn?path=${lesson.pathId}`} className="hover:text-ink">{path?.title ?? "Lesson"}</Link>
          <span aria-hidden> › </span><span className="text-ink">{lesson.title}</span>
          {path && <span> · lesson {path.lessons.findIndex((l) => l.id === lesson.id) + 1} of {path.lessons.length}</span>}
        </nav>
        <div className="flex items-center gap-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Lesson progress">
          <span className="text-sm tabular-nums text-ink-2">{step + 1}/{steps}</span>
          <ol className="flex gap-1" aria-hidden>
            {Array.from({ length: steps }, (_, i) => <li key={i} className={`h-2.5 w-2.5 rounded-full ${i < step ? "bg-bronze" : i === step ? "bg-oxblood ring-2 ring-oxblood/30" : "border border-bronze/60"}`} />)}
          </ol>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0">

      {panel && <EntityPanel entity={panel} edges={lesson.edges} labels={labels} lessonTitle={lesson.title} lessonHref={lessonHref(lesson.id, lesson.pathId)} lessonTitles={lessonTitles} onClose={() => setPanel(null)} />}
      <div ref={stage} className="mt-4" key={step}>
        {slot?.kind === "intro" && (
          <section data-testid="lesson-intro" className="fade-in">
            <p className="eyebrow">{path?.title ?? "Lesson"}</p>
            <h1 className="mt-2 font-serif text-4xl leading-tight" tabIndex={-1} data-step-heading>{lesson.title}</h1>
            <div className="mt-3"><ReviewBadge level={lesson.review === "source_checked" ? "source_checked" : "imported"} /></div>
            <p className="mt-4 leading-relaxed text-ink-2">{lesson.intro}</p>
            <Overview cards={lesson.cards} onJump={(ci) => go(stepOfCard(ci))} />
            <ul className="mt-5 grid gap-1 text-ink-2">
              <li>About {lesson.minutes} minutes</li>
              <li>{lesson.cards.length} short steps, each followed by a question, then {Math.max(0, lesson.activities.length - order.filter((o, k) => o.kind === "act" && order[k - 1]?.kind === "card").length)} to put it together</li>
              <li>Practises: {skills.map((s) => SKILLS[s].label.toLowerCase()).join(", ")}</li>
            </ul>
            {progress.lessons[lesson.id]?.finished && <p className="mt-3 text-sm text-ink-2">You&rsquo;ve finished this lesson before. Replaying is good practice, but earns no new XP.</p>}
            <button type="button" className="btn btn-primary mt-6 w-full sm:w-auto" onClick={() => go(1)} data-testid="continue">Start</button>
          </section>
        )}
        {cardAt && (
          <div className="fade-in">
            <Card card={cardAt} review={lesson.review} onOpen={setPanel} metBefore={metBefore} context={<LessonContext cards={lesson.cards} current={cardAt} onPick={(c) => go(stepOfCard(lesson.cards.indexOf(c)))} />} />
            <div className="mt-6 flex gap-2">
              <button type="button" className="btn btn-secondary" onClick={() => go(step - 1)}>Back</button>
              <button type="button" className="btn btn-primary flex-1 sm:flex-none" onClick={() => go(step + 1)} data-testid="continue">{order[step + 1]?.kind === "act" ? "Check yourself" : "Next"}</button>
            </div>
          </div>
        )}
        {actAt >= 0 && (() => {
          const i = actAt;
          const a = lesson.activities[i];
          return (
            <div className="fade-in">
              <ActivityView
                activity={a}
                seed={(id.length + i) * 7 + 3}
                onAnswer={(r) => {
                  setAnswers((all) => ({ ...all, [i]: r }));
                  logAnswer(lesson.id, a.skill, r.ok, { prompt: reviewPrompt(a), correct: r.correct, activity: a });
                }}
                onNext={() => go(step + 1)}
                nextLabel={step + 1 === summaryAt ? "See what you learned" : "Continue"}
              />
              {/* After answering: where it happened and when, among the lesson's other records. */}
              {answers[i] && <LessonContext cards={lesson.cards} current={aboutOf(a, lesson.cards)} showMap={!(a.kind === "choice" && a.map)} />}
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
            {growth && (
              <div className="mt-5 rounded-xl bg-bronze-soft/50 p-4" data-testid="atlas-growth">
                <p className="font-semibold">Your atlas grew: {describeGrowth(growth)}.</p>
                {growth.earlier.length > 0 && <p className="mt-1 text-sm">Already in your atlas from earlier lessons: {growth.earlier.map((e) => e.label).join(", ")}.</p>}
                <Link href={`/my-atlas?back=${encodeURIComponent(lessonHref(lesson.id, lesson.pathId))}`} className="link mt-2 inline-block text-sm">Open my atlas</Link>
              </div>
            )}
            {growth && progress.atlas && <ConnectExercise lessonId={lesson.id} nodes={progress.atlas.nodes} edges={progress.atlas.edges} />}
            <MeanwhileQuiz cards={lesson.cards} continent={continentOfPath(lesson.pathId)} />
            <h2 className="mt-6 font-serif text-2xl">Key events, in order</h2>
            <ol className="relative mt-3 space-y-3 border-l-2 border-bronze/50 pl-5" data-testid="recap-timeline">
              {[...lesson.cards].sort((a, b) => (a.year ?? 0) - (b.year ?? 0)).map((c) => (
                <li key={c.id} className="relative">
                  <span aria-hidden className="absolute -left-[1.65rem] top-1 h-3 w-3 rounded-full border-2 border-paper bg-bronze" style={c.year !== undefined ? { background: ERA_COLOR[eraOf(c.year)!.id] } : undefined} />
                  <span className="block text-xs font-semibold tabular-nums text-bronze">{c.when}{c.where ? ` · ${c.where}` : ""}{c.year !== undefined ? <span className="font-normal text-ink-2"> · {eraOf(c.year)!.label}</span> : null}</span>
                  <span className="font-medium">{c.title}</span>
                  {c.claims.length > 0 && <span className="block text-xs text-ink-2">{c.claims.length} sourced statement{c.claims.length > 1 ? "s" : ""}</span>}
                </li>
              ))}
            </ol>
            <h2 className="mt-6 font-serif text-2xl">Revisit later</h2>
            <p className="mt-1 text-sm text-ink-2">Questions you missed are already waiting in Review. Add any others you&rsquo;d like to see again.</p>
            <ul className="mt-2 grid gap-1.5" data-testid="revisit">
              {lesson.activities.map((a, i) => {
                const queued = progress.mistakes.some((m) => m.prompt === reviewPrompt(a));
                return (
                  <li key={i} className="flex items-center gap-2 rounded-md border border-line bg-paper-2 px-3 py-2 text-sm">
                    <span className="min-w-0 flex-1">{a.prompt}{a.kind === "timeline" ? ` ${a.target}` : ""}</span>
                    <button type="button" className="btn btn-ghost btn-sm shrink-0" disabled={queued} onClick={() => queueReview(lesson.id, { prompt: reviewPrompt(a), correct: correctOf(a), activity: a, skill: a.skill })}>{queued ? "In review" : "Add to review"}</button>
                  </li>
                );
              })}
            </ul>
            {lesson.gaps.length > 0 && (
              <div className="mt-4 rounded-md border border-dashed border-line p-3 text-sm text-ink-2">
                <p className="font-semibold text-ink">What this lesson couldn&rsquo;t cover</p>
                <ul className="mt-1 list-disc pl-5">{lesson.gaps.map((g) => <li key={g}>{g}</li>)}</ul>
              </div>
            )}
            {asked > score && <p className="mt-4"><Link href="/learn/review" className="link">Review the {asked - score} question{asked - score > 1 ? "s" : ""} you missed</Link></p>}
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              {next ? (
                <button type="button" className="btn btn-primary" onClick={() => router.push(lessonHref(next.id, lesson.pathId))} data-testid="next-lesson">Next lesson: {next.title}</button>
              ) : (
                <Link href="/learn" className="btn btn-primary">Path complete: choose another</Link>
              )}
              <button type="button" className="btn btn-secondary" onClick={() => { setAnswers({}); setXp(null); go(0); }}>Replay</button>
            </div>
            <h2 className="mt-8 font-serif text-xl">Keep exploring</h2>
            <ul className="mt-2 grid gap-1.5">
              {lesson.related.map((r) => <li key={r.href}><Link href={r.href} className="link">{r.label}</Link></li>)}
            </ul>
          </section>
        )}
      </div>
      </div>
      <LessonSide
        lesson={lesson}
        focus={cardAt ?? (actAt >= 0 ? aboutOf(lesson.activities[actAt], lesson.cards) : undefined)}
        hidden={actAt >= 0 && !answers[actAt]}
        path={path}
        progress={progress}
        growth={growth}
        onOpen={setPanel}
        entities={entityMap}
      />
      </div>
    </div>
  );
}
