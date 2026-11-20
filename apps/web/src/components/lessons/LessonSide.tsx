"use client";

import Link from "next/link";
import { useState } from "react";
import type { Entity, Edge } from "@/lib/entities";
import { formatYear } from "@/lib/dates";
import { ERA_COLOR, eraOf, type Activity, type LearnCard, type Lesson, type PathDef, type SourceRef } from "@/lib/lessons";
import { dueReviews, type AtlasGrowth, type Progress } from "@/lib/progress";
import { Icon } from "../icons";
import { TYPE_ICON } from "../atlas/EntityPanel";
import { MiniMap } from "./activities";

/** Which card a question is about: the record whose title, or one of whose claims, it mentions. */
export function aboutOf(a: Activity, cards: LearnCard[]): LearnCard | undefined {
  const text = `${a.prompt} ${a.kind === "choice" ? a.context ?? "" : ""} ${a.kind === "timeline" ? a.target : ""}`;
  return cards.find((c) => text.includes(c.title)) ?? cards.find((c) => c.claims.some((cl) => text.includes(cl.text)));
}

export type Slot = { kind: "intro" } | { kind: "card"; i: number } | { kind: "act"; i: number } | { kind: "summary" };

/**
 * The order of a lesson's steps: each record is followed by one question about it, so reading and
 * practice alternate. Questions about several records (ordering, for instance) come at the end.
 */
export function lessonOrder(lesson?: Pick<Lesson, "cards" | "activities"> | null): Slot[] {
  if (!lesson) return [];
  const used = new Set<number>();
  const out: Slot[] = [{ kind: "intro" }];
  lesson.cards.forEach((c, ci) => {
    out.push({ kind: "card", i: ci });
    const k = lesson.activities.findIndex((a, j) => !used.has(j) && a.kind !== "order" && aboutOf(a, lesson.cards) === c);
    if (k >= 0) { used.add(k); out.push({ kind: "act", i: k }); }
  });
  lesson.activities.forEach((_, j) => { if (!used.has(j)) out.push({ kind: "act", i: j }); });
  out.push({ kind: "summary" });
  return out;
}

/** The lesson's places on one map and its records on one timeline, with the current one highlighted. */
export function LessonContext({ cards, current, onPick, showMap = true }: { cards: LearnCard[]; current?: LearnCard; onPick?: (c: LearnCard) => void; showMap?: boolean }) {
  const placed = cards.filter((c) => c.point);
  const dated = cards.filter((c) => c.year !== undefined).sort((a, b) => a.year! - b.year!);
  const lo = dated[0]?.year ?? 0, hi = dated[dated.length - 1]?.year ?? 0;
  const span = Math.max(1, hi - lo);
  return (
    <div className="mt-5 grid gap-3" data-testid="lesson-context">
      {showMap && placed.length > 0 && (
        <MiniMap className="max-w-2xl" points={placed.map((c) => ({ label: c === current ? (c.where ?? c.title) : "", lng: c.point![0], lat: c.point![1], answer: c === current }))} label={current?.where ? `Map: ${current.where}, among this lesson's places` : "Map of this lesson's places"} />
      )}
      {dated.length > 1 && (
        <div className="relative mx-4 h-16" role="group" aria-label="This lesson's records in time">
          <span aria-hidden className="absolute inset-x-0 top-4 h-0.5 rounded bg-bronze/40" />
          {dated.map((c) => {
            const on = c === current;
            const era = eraOf(c.year);
            const x = ((c.year! - lo) / span) * 100;
            return (
              <button key={c.id} type="button" disabled={!onPick} onClick={() => onPick?.(c)} aria-current={on ? "step" : undefined} aria-label={`${c.title}, ${c.when}`} title={`${c.title} · ${c.when}`} className="absolute top-0 flex -translate-x-1/2 flex-col items-center disabled:cursor-default" style={{ left: `${x}%` }}>
                <span className={`grid place-items-center rounded-full border-2 ${on ? "h-8 w-8 border-oxblood bg-oxblood/15" : "mt-1.5 h-5 w-5 bg-paper-2"}`} style={on ? undefined : { borderColor: ERA_COLOR[era?.id ?? ""] }}>{on && <span className="h-3 w-3 rounded-full bg-oxblood" />}</span>
                <span className={`mt-1 whitespace-nowrap rounded-full px-2 text-xs tabular-nums ${on ? "bg-oxblood font-semibold text-white" : "text-ink-2"}`}>{formatYear(c.year!)}</span>
              </button>
            );
          })}
        </div>
      )}
      {dated.length > 1 && <EraKey years={dated.map((c) => c.year!)} />}
    </div>
  );
}

/** The eras a set of years falls in, each with its colour and name, so colour never stands alone. */
export function EraKey({ years }: { years: number[] }) {
  const eras = [...new Set(years.map((y) => eraOf(y)!.id))];
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-2" aria-label="Eras" data-testid="era-key">
      {eras.map((id) => <li key={id} className="inline-flex items-center gap-1.5"><span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: ERA_COLOR[id] }} />{eraOf(years.find((y) => eraOf(y)!.id === id))!.label}</li>)}
    </ul>
  );
}

const POS: [number, number][] = [[18, 16], [82, 16], [18, 86], [82, 86], [50, 8], [50, 94]];

/** The record in focus with its sourced links in this lesson: a small, fixed layout, never a hairball. */
function ConnectionsMini({ focus, edges, labels, types, onOpen }: { focus: Entity; edges: Edge[]; labels: Record<string, string>; types: Record<string, Entity["type"]>; onOpen: (id: string) => void }) {
  const links = edges.filter((e) => e.from === focus.id || e.to === focus.id).slice(0, 4);
  return (
    <div className="relative h-64" data-testid="side-connections">
      <svg className="absolute inset-0 h-full w-full" aria-hidden>
        {links.map((e, i) => <line key={i} x1="50%" y1="50%" x2={`${POS[i][0]}%`} y2={`${POS[i][1]}%`} stroke="var(--bronze)" strokeWidth={1.5} />)}
      </svg>
      {links.map((e, i) => {
        const other = e.from === focus.id ? e.to : e.from;
        const text = e.from === focus.id ? e.label : `← ${e.label}`;
        const [x, y] = POS[i];
        return (
          <div key={`n${i}`}>
            <span className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-paper px-1 text-[11px] italic text-ink-2" style={{ left: `${x}%`, top: `${y + (y < 50 ? 10 : -10)}%` }}>{text}</span>
            <button type="button" onClick={() => onOpen(other)} className="absolute flex max-w-[46%] -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-full border border-bronze/60 bg-paper-2 px-2.5 py-1 text-xs font-semibold shadow-sm hover:border-bronze" style={{ left: `${x}%`, top: `${y}%` }} title={labels[other]}>
              <Icon name={TYPE_ICON[types[other] ?? "event"]} size={14} className="shrink-0 text-bronze" /><span className="truncate">{labels[other] ?? other}</span>
            </button>
          </div>
        );
      })}
      <button type="button" onClick={() => onOpen(focus.id)} className="absolute left-1/2 top-1/2 flex max-w-[50%] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 rounded-2xl border-2 border-bronze bg-bronze-soft px-3 py-2 text-center font-serif text-sm font-semibold leading-tight shadow">
        <Icon name={TYPE_ICON[focus.type]} size={20} className="text-bronze" />{focus.label}
      </button>
      {!links.length && <p className="absolute inset-x-0 bottom-2 text-center text-xs text-ink-2">No sourced links recorded for this one yet.</p>}
    </div>
  );
}

/** The right-hand column: connections and sources for the step, what joins the atlas, path progress and review. */
export function LessonSide({ lesson, focus, hidden, path, progress, growth, onOpen, entities }: {
  lesson: Lesson;
  /** The card in focus for this step, if any. */
  focus?: LearnCard;
  /** True before a question is answered, so the panel can't give the answer away. */
  hidden: boolean;
  path?: PathDef;
  progress: Progress;
  growth: AtlasGrowth | null;
  onOpen: (e: Entity) => void;
  entities: Record<string, Entity>;
}) {
  const [showSources, setShowSources] = useState(false);
  const labels = Object.fromEntries(Object.entries(entities).map(([k, e]) => [k, e.label]));
  const types = Object.fromEntries(Object.entries(entities).map(([k, e]) => [k, e.type]));
  const sources: SourceRef[] = focus ? [...focus.claims.flatMap((c) => c.sources), ...(focus.entity.source ? [focus.entity.source] : [])].filter((s, i, a) => s.url && a.findIndex((o) => o.url === s.url) === i) : [];
  const seen = Object.values(entities).filter((e) => progress.atlas?.nodes[e.id]?.lessons.includes(lesson.id));
  const done = path ? path.lessons.filter((l) => progress.lessons[l.id]?.finished).length : 0;
  const due = dueReviews(progress).length;
  return (
    <aside className="grid content-start gap-4 lg:sticky lg:top-20" aria-label="Connections and progress" data-testid="lesson-side">
      <section className="card p-4">
        <h2 className="flex items-center gap-2 font-serif text-xl"><Icon name="network" size={20} className="text-bronze" />Connections</h2>
        {focus && !hidden ? (
          <>
            <ConnectionsMini focus={focus.entity} edges={lesson.edges} labels={labels} types={types} onOpen={(id) => entities[id] && onOpen(entities[id])} />
            <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-line pt-3 text-sm">
              <Icon name="source" size={16} className="text-bronze" />
              <span className="font-semibold">Sources</span>
              {sources.slice(0, 2).map((s) => <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className="chip max-w-[12rem] !text-xs"><span className="truncate">{s.label}</span></a>)}
              {sources.length > 2 && <button type="button" className="link ml-auto text-sm" onClick={() => setShowSources(!showSources)}>{showSources ? "Fewer" : `All ${sources.length}`}</button>}
            </div>
            {showSources && <ul className="mt-2 grid gap-1 text-xs">{sources.map((s) => <li key={s.url}><a className="link" href={s.url} target="_blank" rel="noopener noreferrer">{s.label} ↗</a></li>)}</ul>}
          </>
        ) : (
          <p className="mt-2 text-sm text-ink-2">{hidden ? "Answer the question to see how this connects." : "Each record's sourced links appear here as you go."}</p>
        )}
      </section>

      <section className="card flex items-center gap-3 p-4" data-testid="side-atlas">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${growth ? "bg-navy text-on-accent [[data-theme=dark]_&]:bg-bronze" : "bg-paper-3 text-bronze"}`}><Icon name={growth ? "checked" : "idea"} size={18} /></span>
        <p className="min-w-0 flex-1 text-sm">
          {growth ? <>Added to My Atlas: {Object.entries(growth.newByType).map(([t, n]) => `+${n} ${t === "person" ? (n === 1 ? "person" : "people") : `${t}${n === 1 ? "" : "s"}`}`).join(" · ") || "nothing new"}{growth.newEdges ? ` · +${growth.newEdges} links` : ""}</>
            : <>Seen in this lesson: {seen.length} of {Object.keys(entities).length}. They join your atlas as <em>practised</em> when you finish.</>}
        </p>
        <Link href="/my-atlas" className="btn btn-secondary btn-sm shrink-0">My Atlas</Link>
      </section>

      {path && (
        <section className="card p-4" data-testid="side-path">
          <div className="flex items-baseline justify-between gap-2"><h2 className="font-serif text-lg leading-tight">{path.title}</h2><span className="text-sm tabular-nums text-ink-2">{done}/{path.lessons.length}</span></div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-navy [[data-theme=dark]_&]:bg-bronze" style={{ width: `${(done / path.lessons.length) * 100}%` }} /></div>
          <Link href={`/learn?path=${path.id}`} className="link mt-2 inline-block text-sm">See the path</Link>
        </section>
      )}

      <Link href="/learn/review" className="card card-link flex items-center gap-3 p-4" data-testid="side-review">
        <Icon name="book" size={22} className="text-bronze" />
        <span className="flex-1 font-serif text-lg">{due ? `Review ${due} question${due === 1 ? "" : "s"}` : "Nothing due for review"}</span>
        <Icon name="forward" size={18} />
      </Link>
    </aside>
  );
}
