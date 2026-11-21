"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Activity } from "@/lib/lessons";
import { dueReviews, logAnswer, readProgress, useProgress, type Mistake } from "@/lib/progress";
import { ActivityView } from "./activities";
import { recordReview } from "@/lib/explorer";

/**
 * Questions missed in lessons, asked again one at a time. A right answer takes a question off the list;
 * a wrong one keeps it. Missed challenge answers are listed with a link back to their challenge.
 */
export function ReviewSession() {
  const p = useProgress();
  // A fixed list for this session, taken once the stored progress is readable.
  const [queue, setQueue] = useState<Mistake[] | null>(null);
  useEffect(() => { setQueue(dueReviews(readProgress())); }, []);
  const [i, setI] = useState(0);
  const [right, setRight] = useState(0);
  const legacy = p.mistakes.filter((m) => !m.activity);
  const items = queue ?? [];
  const current = items[i];

  return (
    <div id="review" className="mx-auto max-w-3xl scroll-mt-24 px-4 pt-10 sm:px-6" data-testid="review">
      <h2 className="font-serif text-3xl leading-tight">Questions from lessons</h2>
      {queue === null ? (
        <p className="mt-4 text-ink-2" role="status">Loading your review…</p>
      ) : !items.length ? (
        <p className="mt-4 text-lg text-ink-2">Nothing due right now.{p.mistakes.filter((m) => m.activity).length ? ` ${p.mistakes.filter((m) => m.activity).length} question${p.mistakes.filter((m) => m.activity).length === 1 ? " is" : "s are"} scheduled for a later day: each right answer spaces the next review further out (1, 3, then 7 days).` : " Questions you miss in a lesson come back here, with their explanation."}</p>
      ) : current ? (
        <div className="mt-6" key={i}>
          <p className="mb-3 text-sm text-ink-2">{i + 1} of {items.length}</p>
          <ActivityView
            activity={current.activity as Activity}
            seed={i + 11}
            onAnswer={(a) => {
              if (a.ok) setRight((r) => r + 1);
              recordReview();
              logAnswer(current.challengeId, current.skill ?? (current.activity as Activity).skill, a.ok, { prompt: current.prompt, correct: current.correct, activity: current.activity }, true);
            }}
            onNext={() => setI(i + 1)}
            nextLabel={i + 1 < items.length ? "Next question" : "Finish"}
          />
        </div>
      ) : (
        <div className="mt-6 card p-5" data-testid="review-done">
          <p className="font-serif text-2xl">{right} of {items.length} right this time.</p>
          <p className="mt-1 text-ink-2">{right === items.length ? "All answered. Each comes back once more, a few days later, until it sticks." : "The ones you missed come back tomorrow; the right ones, a few days later."}</p>
          {p.reviewLog && p.reviewLog.total > 0 && <p className="mt-1 text-sm text-ink-2">Review accuracy so far: {Math.round((p.reviewLog.ok / p.reviewLog.total) * 100)}% ({p.reviewLog.ok}/{p.reviewLog.total}).</p>}
          <Link href="/learn" className="btn btn-primary mt-4">Back to learning</Link>
        </div>
      )}
      {legacy.length > 0 && (
        <section className="mt-10">
          <h2 className="font-serif text-xl">From challenges</h2>
          <ul className="mt-2 grid gap-2">
            {legacy.map((m) => (
              <li key={m.prompt} className="rounded-md border border-line p-3 text-sm">
                <p>{m.prompt}</p>
                <p className="mt-1 text-ink-2">Answer: {m.correct}</p>
                <Link href={`/challenges/${m.challengeId}`} className="link mt-1 inline-block">Try the challenge again</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
