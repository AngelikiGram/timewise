"use client";

import { useMemo, useState } from "react";
import type { Activity } from "@/lib/lessons";
import { logAnswer, type AtlasEdge, type AtlasNode } from "@/lib/progress";
import { ActivityView } from "../lessons/activities";

/**
 * One "Connect what you learned" question from the learner's own atlas: only from stored, sourced edges,
 * and only when the answer is unambiguous. Prefers links that reach back to an earlier lesson.
 */
export function buildConnectExercise(lessonId: string, nodes: Record<string, AtlasNode>, edges: Record<string, AtlasEdge>): Activity | null {
  const all = Object.values(edges);
  const label = (id: string) => nodes[id]?.label;
  const earlier = (id: string) => (nodes[id]?.lessons ?? []).some((l) => l !== lessonId);
  const mine = all.filter((e) => e.lessons.includes(lessonId) && label(e.from) && label(e.to));
  const ranked = [...mine].sort((a, b) => Number(earlier(b.from) || earlier(b.to)) - Number(earlier(a.from) || earlier(a.to)));

  for (const e of ranked) {
    const from = nodes[e.from], to = nodes[e.to];
    // Match an event to its place.
    if (e.label === "took place in") {
      const answers = all.filter((x) => x.from === e.from && x.label === "took place in").map((x) => x.to);
      const others = Object.values(nodes).filter((n) => (n.type === "place") && !answers.includes(n.id)).slice(0, 3);
      if (others.length >= 2) return {
        kind: "choice", skill: "geography", prompt: `Where did ${from.label} take place?`,
        options: [{ id: to.id, label: to.label }, ...others.map((o) => ({ id: o.id, label: o.label }))], answer: to.id,
        explanation: `${from.label} took place in ${to.label}${e.date ? ` (${e.date})` : ""}.`, sources: e.source.url ? [e.source] : [],
      };
    }
    // Match a person to an event.
    if (from.type === "person" && to.type === "event") {
      const answers = all.filter((x) => x.from === e.from).map((x) => x.to);
      const others = Object.values(nodes).filter((n) => n.type === "event" && !answers.includes(n.id)).slice(0, 3);
      if (others.length >= 2) return {
        kind: "choice", skill: "people", prompt: `Which event is ${from.label} connected to?`,
        options: [{ id: to.id, label: to.label }, ...others.map((o) => ({ id: o.id, label: o.label }))], answer: to.id,
        explanation: `${from.label} ${e.label} ${to.label}${e.date ? ` (${e.date})` : ""}.`, sources: e.source.url ? [e.source] : [],
      };
    }
  }
  // Select the documented relationship between two entities, when the atlas holds several kinds.
  const kinds = [...new Set(all.map((e) => e.label))];
  const pick = ranked.find((e) => kinds.length >= 3 && !all.some((x) => x !== e && x.from === e.from && x.to === e.to));
  if (pick) return {
    kind: "choice", skill: "cause", prompt: `How are ${label(pick.from)} and ${label(pick.to)} connected?`,
    context: `${label(pick.from)} … ${label(pick.to)}`,
    options: kinds.slice(0, 4).includes(pick.label) ? kinds.slice(0, 4).map((k) => ({ id: k, label: k })) : [pick.label, ...kinds.filter((k) => k !== pick.label).slice(0, 3)].map((k) => ({ id: k, label: k })),
    answer: pick.label,
    explanation: `${label(pick.from)} ${pick.label} ${label(pick.to)}${pick.date ? ` (${pick.date})` : ""}.`, sources: pick.source.url ? [pick.source] : [],
  };
  // Put dated events in order, only when their years don't overlap.
  const dated = Object.values(nodes).filter((n) => n.type === "event" && n.year !== undefined);
  const distinct = dated.filter((n, i) => dated.findIndex((m) => m.year === n.year) === i).sort((a, b) => a.year! - b.year!);
  if (distinct.length >= 3) {
    const three = [distinct[0], distinct[Math.floor(distinct.length / 2)], distinct[distinct.length - 1]];
    return {
      kind: "order", skill: "chronology", prompt: "Put these events from your atlas in order, earliest first.",
      items: three.map((n) => ({ id: n.id, label: n.label, when: n.dates ?? String(n.year) })),
      explanation: three.map((n) => `${n.label}: ${n.dates ?? n.year}`).join(". ") + ".",
      sources: three.map((n) => n.source).filter((x): x is NonNullable<typeof x> => !!x?.url),
    };
  }
  return null;
}

export function ConnectExercise({ lessonId, nodes, edges }: { lessonId: string; nodes: Record<string, AtlasNode>; edges: Record<string, AtlasEdge> }) {
  // Built once, from the atlas as it was when the lesson finished.
  const activity = useMemo(() => buildConnectExercise(lessonId, nodes, edges), [lessonId]); // eslint-disable-line react-hooks/exhaustive-deps
  const [done, setDone] = useState(false);
  if (!activity) return null;
  return (
    <section className="mt-6 rounded-xl border-2 border-bronze/50 p-4" data-testid="connect-exercise">
      <p className="eyebrow">Connect what you learned</p>
      <div className="mt-2">
        <ActivityView
          activity={activity}
          seed={lessonId.length + 5}
          onAnswer={(a) => logAnswer(lessonId, activity.skill, a.ok, { prompt: `${activity.prompt}`, correct: a.correct, activity })}
          onNext={() => setDone(true)}
          nextLabel="Done"
        />
      </div>
      {done && <p className="mt-2 text-sm text-ink-2">Wrong answers wait in Review. Nothing you&rsquo;ve discovered is ever removed.</p>}
    </section>
  );
}

/**
 * "Restore the hidden link": one stored, sourced edge is hidden, and the reader restores it, either by its
 * relation (when the atlas holds at least three kinds) or by the missing entity. Null when the answer
 * would be ambiguous.
 */
export function restoreLinkQuestion(e: AtlasEdge, nodes: Record<string, AtlasNode>, edges: Record<string, AtlasEdge>): Activity | null {
  const all = Object.values(edges);
  const from = nodes[e.from], to = nodes[e.to];
  if (!from || !to) return null;
  const sources = e.source.url ? [e.source] : [];
  const explanation = `${from.label} ${e.label} ${to.label}${e.date ? ` (${e.date})` : ""}.`;
  const kinds = [...new Set(all.map((x) => x.label))];
  const pairLabels = all.filter((x) => (x.from === e.from && x.to === e.to) || (x.from === e.to && x.to === e.from)).map((x) => x.label);
  if (kinds.length >= 3 && pairLabels.length === 1) {
    const options = [e.label, ...kinds.filter((k) => k !== e.label).slice(0, 3)].sort();
    return { kind: "choice", skill: "cause", prompt: `Restore the hidden link: how are ${from.label} and ${to.label} connected?`, context: `${from.label} → ? → ${to.label}`, options: options.map((k) => ({ id: k, label: k })), answer: e.label, explanation, sources };
  }
  const taken = all.filter((x) => x.from === e.from && x.label === e.label).map((x) => x.to);
  const others = Object.values(nodes).filter((n) => n.type === to.type && n.id !== e.from && !taken.includes(n.id)).slice(0, 3);
  if (others.length < 2) return null;
  const options = [to, ...others].map((n) => ({ id: n.id, label: n.label })).sort((a, b) => a.label.localeCompare(b.label));
  return { kind: "choice", skill: "cause", prompt: `Restore the hidden link: ${from.label} ${e.label} …?`, options, answer: to.id, explanation, sources };
}
