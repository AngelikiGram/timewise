"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { answerCard, dueCards, removeCard, useMemory, type Card } from "@/lib/memory";
import { Icon } from "../icons";

/** Story memory: questions made from stories, lives and timeline rounds you finished, asked again when due. */
export function MemoryReview() {
  const all = useMemory();
  const [now, setNow] = useState(0);
  useEffect(() => setNow(Date.now()), []);
  const due = useMemo(() => (now ? dueCards(all, now) : []), [all, now]);
  const [queue, setQueue] = useState<Card[] | null>(null);
  const [i, setI] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [right, setRight] = useState(0);
  const start = (cards: Card[]) => { setQueue([...cards].sort(() => Math.random() - 0.5).slice(0, 12)); setI(0); setChosen(null); setRight(0); };
  const c = queue?.[i];
  const next = () => { setI(i + 1); setChosen(null); };
  const pick = (o: string) => { if (!c || chosen) return; setChosen(o); const ok = o === c.answer; if (ok) setRight(right + 1); answerCard(c.id, ok); };
  const soon = all.filter((x) => !due.includes(x)).sort((a, b) => a.due.localeCompare(b.due))[0];

  return (
    <section className="mx-auto mt-10 max-w-3xl px-4 pb-16 sm:px-6" aria-labelledby="memory-title" data-testid="memory-review">
      <h2 id="memory-title" className="flex items-center gap-2 font-serif text-3xl"><Icon name="idea" size={26} className="text-bronze" />Story memory</h2>
      <p className="mt-1 text-ink-2">Finished stories, lives you scrubbed to the end and timeline rounds turn into questions. Each comes back after 1, 3, 7, 16, 35 and 90 days while you get it right, and tomorrow when you don&rsquo;t.</p>

      {!queue && (
        <div className="card mt-4 flex flex-wrap items-center gap-4 p-5">
          <p className="min-w-0 flex-1"><span className="block font-serif text-4xl tabular-nums" data-testid="memory-due">{due.length}</span><span className="text-sm text-ink-2">due now, of {all.length} kept{soon && !due.length ? ` · next one ${new Date(soon.due).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : ""}</span></p>
          {due.length > 0 && <button type="button" className="btn btn-primary" onClick={() => start(due)} data-testid="memory-start">Review {Math.min(12, due.length)} now</button>}
          {!due.length && all.length > 0 && <button type="button" className="btn btn-secondary" onClick={() => start(all)}>Practise early</button>}
          {!all.length && <p className="w-full text-sm text-ink-2">Nothing yet. Finish a <Link className="link" href="/stories">story</Link>, scrub a <Link className="link" href="/explore/life">life</Link> to its end, or play the <Link className="link" href="/challenges/timeline">timeline game</Link>.</p>}
        </div>
      )}

      {queue && c && (
        <div className="card mt-4 p-5" data-testid="memory-card">
          <p className="flex items-center justify-between text-xs text-ink-2"><span>Question {i + 1} of {queue.length}</span><Link href={c.from.href} className="hover:underline">From: {c.from.title}</Link></p>
          <p className="mt-2 font-serif text-2xl leading-snug">{c.prompt}</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {c.options.map((o) => {
              const state = !chosen ? "" : o === c.answer ? "border-green-700 bg-green-50 [[data-theme=dark]_&]:bg-green-950/30" : o === chosen ? "border-oxblood bg-oxblood/5" : "opacity-60";
              return <button key={o} type="button" disabled={!!chosen} onClick={() => pick(o)} className={`rounded-xl border-2 border-line p-3 text-left ${state} ${!chosen ? "hover:border-bronze" : ""}`}>{o}</button>;
            })}
          </div>
          {chosen && (
            <div className="mt-4 rounded-lg bg-paper-2 p-3 text-sm" role="status">
              <p><b>{chosen === c.answer ? "Right." : "Not this time."}</b> {c.explain} {c.source && <a className="link text-xs" href={c.source} target="_blank" rel="noopener noreferrer">source ↗</a>}</p>
              <p className="mt-1 text-xs text-ink-2">{chosen === c.answer ? "It comes back later." : "It comes back tomorrow."}</p>
              <div className="mt-3 flex gap-2"><button type="button" className="btn btn-primary btn-sm" onClick={next}>{i + 1 < queue.length ? "Next" : "Finish"}</button><button type="button" className="btn btn-ghost btn-sm" onClick={() => { removeCard(c.id); next(); }}>Don&rsquo;t ask again</button></div>
            </div>
          )}
        </div>
      )}
      {queue && !c && (
        <div className="card mt-4 p-5"><p className="font-serif text-2xl">{right} of {queue.length} right.</p><button type="button" className="btn btn-secondary mt-3" onClick={() => setQueue(null)}>Done</button></div>
      )}
    </section>
  );
}
