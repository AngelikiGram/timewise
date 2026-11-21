"use client";

import { useEffect, useMemo, useState } from "react";
import { dueCards, useMemory } from "@/lib/memory";
import { dueReviews, useProgress } from "@/lib/progress";
import { Quests } from "../profile/ExplorerCard";

const DAY = 86400000;

/**
 * The top of Review: what is due now, what comes back over the next two weeks, and how you are doing.
 * Two kinds of question come back here: ones missed in lessons, and memory cards made from stories, lives and games.
 */
export function ReviewHub() {
  const p = useProgress();
  const cards = useMemory();
  const [now, setNow] = useState(0);
  useEffect(() => setNow(Date.now()), []);
  const lessonDue = now ? dueReviews(p, now).length : 0;
  const cardDue = now ? dueCards(cards, now).length : 0;
  const total = lessonDue + cardDue;
  const kept = p.mistakes.filter((m) => m.activity).length + cards.length;
  const acc = p.reviewLog && p.reviewLog.total ? Math.round((p.reviewLog.ok / p.reviewLog.total) * 100) : null;

  // How many come back on each of the next 14 days (today includes anything overdue).
  const days = useMemo(() => {
    if (!now) return [];
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    const out = Array.from({ length: 14 }, (_, i) => ({ t: start.getTime() + i * DAY, n: 0 }));
    const add = (iso?: string) => { const t = iso ? Date.parse(iso) : now; const i = Math.max(0, Math.floor((t - start.getTime()) / DAY)); if (i < 14) out[i].n++; };
    p.mistakes.filter((m) => m.activity).forEach((m) => add(m.due));
    cards.forEach((c) => add(c.due));
    return out;
  }, [now, p.mistakes, cards]);
  const max = Math.max(1, ...days.map((d) => d.n));

  return (
    <div className="mx-auto max-w-5xl px-4 pt-8 sm:px-6" data-testid="review-hub">
      <h1 className="font-serif text-5xl leading-tight">Review</h1>
      <p className="mt-1 max-w-2xl text-ink-2">Questions come back just before you would forget them: missed ones tomorrow, right ones a few days later, then further apart each time.</p>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="rounded-xl border border-line bg-paper-2 p-5">
          <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
            <p><span className="block font-serif text-6xl leading-none tabular-nums" style={{ color: total ? "var(--oxblood)" : "var(--ink)" }}>{total}</span><span className="text-sm text-ink-2">due now</span></p>
            <p><span className="block font-serif text-3xl leading-none tabular-nums">{kept}</span><span className="text-sm text-ink-2">questions kept</span></p>
            <p><span className="block font-serif text-3xl leading-none tabular-nums">{acc == null ? "–" : `${acc}%`}</span><span className="text-sm text-ink-2">right in review</span></p>
            {total > 0 && <a href={lessonDue ? "#review" : "#memory-review"} className="btn btn-primary ml-auto">Start with {Math.min(total, 12)}</a>}
          </div>
          <h2 className="mt-6 text-sm font-semibold">Coming back over the next two weeks</h2>
          <div className="mt-2 flex h-28 items-end gap-1.5" role="img" aria-label={`Due in the next 14 days: ${days.map((d) => d.n).join(", ")}`}>
            {days.map((d, i) => (
              <div key={d.t} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${new Date(d.t).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}: ${d.n}`}>
                {d.n > 0 && <span className="mb-0.5 text-center text-[10px] tabular-nums text-ink-2">{d.n}</span>}
                <div className="rounded-t" style={{ height: `${d.n ? Math.max(6, (d.n / max) * 100) : 2}%`, background: i === 0 ? "var(--oxblood)" : d.n ? "var(--navy)" : "var(--line)" }} />
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-ink-2"><span>Today</span><span>In a week</span><span>In two weeks</span></div>
        </div>
        <div className="rounded-xl border border-line bg-paper-2 p-5"><Quests compact /></div>
      </div>

      {!kept && <p className="mt-6 rounded-xl border border-dashed border-line p-5 text-ink-2">Nothing to review yet. Finish a lesson, read a story to its end or play the timeline game, and the questions you meet will start coming back here.</p>}
    </div>
  );
}
