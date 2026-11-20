"use client";

import Link from "next/link";
import { useState } from "react";
import { claim, source } from "@/lib/challenges";
import { recordResult, saveStoryStep, useProgress } from "@/lib/progress";
import { STORIES } from "@/lib/stories";
import { GeometrySketch } from "../visuals";
import { ReviewBadge } from "../ui";

// A detective case: a question, a few pieces of sourced evidence, competing explanations, and an
// evidence-based verdict. Every exhibit is a checked claim; the explanations are judged only on what
// those claims say. "The evidence can't settle it" is always an option.

type Exhibit = { id: string; label: string; claimIds: string[]; note: string; sketch?: string };
type Explanation = { id: string; text: string; verdict: "best" | "partly" | "unsupported"; why: string };

const CASE = {
  id: "ringstrasse-case",
  question: "When did Vienna's Ringstrasse open?",
  setup: "Guidebooks often give a single opening date for the boulevard that replaced Vienna's city walls. Look at what the sources actually record, then decide which explanation they support.",
  exhibits: [
    { id: "A", label: "Exhibit A: the decree", claimIds: ["c-dec-1", "c-dec-2"], note: "An imperial order, signed in December 1857." },
    { id: "B", label: "Exhibit B: the opening", claimIds: ["c-ring-1"], note: "What the City of Vienna's history wiki records for 1865, and what else it mentions." },
    { id: "C", label: "Exhibit C: the street today", claimIds: [], note: "Today's street, drawn from OpenStreetMap. It shows where the Ring runs now, not the road as it was in 1865.", sketch: "m-ringstrasse" },
  ] as Exhibit[],
  explanations: [
    { id: "1857", text: "It opened in 1857, when the emperor signed the decree.", verdict: "unsupported", why: "Exhibit A records an order to demolish the walls and moats, signed in 1857. An order to begin is not an opening, and nothing here says the road was usable then." },
    { id: "1865", text: "It opened on 1 May 1865, and that is the only date that counts.", verdict: "partly", why: "Exhibit B does date the first section's public opening to 1 May 1865. But the same source also records a smaller stretch of road opened in 1858, so “the only date” goes further than the evidence." },
    { id: "1858", text: "It really opened in 1858, so 1865 is wrong.", verdict: "partly", why: "The 1858 stretch is recorded, but it was a small piece of road. Whether it counts as “the Ringstrasse” is a question of definition, which the sources don't decide. Exhibit B doesn't make 1865 wrong." },
    { id: "insufficient", text: "There's no single answer: it depends on what counts as the Ringstrasse.", verdict: "best", why: "This is the best-supported answer. The sources record an order in 1857, a small stretch in 1858 and the first section's opening in 1865. Which one is “the opening” depends on a definition the evidence doesn't settle." },
  ] as Explanation[],
};

export function DetectiveCase() {
  const [stage, setStage] = useState(0);
  const [seen, setSeen] = useState<string[]>([]);
  const [pick, setPick] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [earned, setEarned] = useState(0);
  const p = useProgress();
  const story = STORIES.find((s) => s.id === CASE.id)!;
  const next = STORIES.filter((s) => story.next.includes(s.id));
  const chosen = CASE.explanations.find((e) => e.id === pick);
  const go = (n: number) => {
    setStage(n);
    saveStoryStep(CASE.id, story.chapters[n].id, n + 1, n === 3);
    document.getElementById("case-top")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div id="case-top" className="mx-auto max-w-3xl scroll-mt-28">
      <ol className="flex gap-1" aria-label="Case progress">
        {story.chapters.map((c, i) => (
          <li key={c.id} className="flex-1">
            <span className={`block h-1.5 rounded-full ${i <= stage ? "bg-bronze" : "bg-line"}`} />
            <span className={`mt-1 block text-xs ${i === stage ? "font-semibold text-ink" : "text-ink-2"}`} aria-current={i === stage ? "step" : undefined}>{c.title}</span>
          </li>
        ))}
      </ol>

      {stage === 0 && (
        <section className="fade-in mt-8">
          <p className="eyebrow">A detective case, Vienna, 1857–1865</p>
          <h1 className="mt-3 font-serif text-4xl leading-tight sm:text-5xl">{CASE.question}</h1>
          <p className="mt-4 text-lg leading-relaxed text-ink-2">{CASE.setup}</p>
          <ul className="mt-6 grid gap-3 text-sm sm:grid-cols-3">
            <li className="card p-3"><strong className="block">3 exhibits</strong>A decree, an opening, a map</li>
            <li className="card p-3"><strong className="block">4 explanations</strong>Including “it can’t be settled”</li>
            <li className="card p-3"><strong className="block">About {story.minutes} minutes</strong>{story.difficulty}</li>
          </ul>
          <div className="mt-6 flex items-center gap-3"><button type="button" onClick={() => go(1)} className="btn btn-primary">Examine the evidence</button><ReviewBadge level="source_checked" /></div>
          {p.stories[CASE.id]?.finished && <p className="mt-3 text-sm text-ink-2">You&rsquo;ve solved this case before. Your verdict this time won&rsquo;t earn XP again.</p>}
        </section>
      )}

      {stage === 1 && (
        <section className="fade-in mt-8">
          <h2 className="font-serif text-3xl">The evidence</h2>
          <p className="mt-2 text-ink-2">Open each exhibit. The statements are paraphrased from the sources, which are linked.</p>
          <div className="mt-5 space-y-3">
            {CASE.exhibits.map((x) => (
              <details key={x.id} className="card group" onToggle={(e) => (e.target as HTMLDetailsElement).open && setSeen((s) => [...new Set([...s, x.id])])}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
                  <span>
                    <span className="block font-serif text-xl">{x.label}</span>
                    <span className="text-sm text-ink-2">{x.note}</span>
                  </span>
                  <span aria-hidden className="text-ink-2 transition-transform group-open:rotate-180">▾</span>
                </summary>
                <div className="space-y-3 border-t border-line p-4">
                  {x.claimIds.map((id) => {
                    const c = claim(id);
                    return (
                      <div key={id}>
                        <p className="font-serif text-lg leading-snug">{c.statement.en}</p>
                        {c.evidence.map((e) => (
                          <p key={e.sourceId} className="mt-1 text-sm text-ink-2">
                            Source: <a href={source(e.sourceId).url} target="_blank" rel="noopener noreferrer" className="link">{source(e.sourceId).title} ↗</a> ({source(e.sourceId).provider}). {e.passage}
                          </p>
                        ))}
                      </div>
                    );
                  })}
                  {x.sketch && <GeometrySketch id={x.sketch} label="Today's Ringstrasse, drawn from OpenStreetMap" className="max-w-md" />}
                </div>
              </details>
            ))}
          </div>
          <div className="mt-6 flex items-center gap-3">
            <button type="button" onClick={() => go(0)} className="btn btn-ghost">Back</button>
            <button type="button" onClick={() => go(2)} className="btn btn-primary">{seen.length < CASE.exhibits.length ? `Continue (${seen.length} of ${CASE.exhibits.length} exhibits opened)` : "I’ve seen the evidence"}</button>
          </div>
        </section>
      )}

      {stage === 2 && (
        <section className="fade-in mt-8">
          <h2 className="font-serif text-3xl">Your verdict</h2>
          <p className="mt-2 text-ink-2">Which explanation does the evidence support best?</p>
          <fieldset className="mt-5 space-y-2">
            <legend className="sr-only">Explanations</legend>
            {CASE.explanations.map((e) => (
              <label key={e.id} className={`flex cursor-pointer items-start gap-3 rounded-md border p-4 ${pick === e.id ? "border-bronze bg-paper-3" : "border-line bg-paper-2"}`}>
                <input type="radio" className="mt-1.5" name="verdict" checked={pick === e.id} onChange={() => setPick(e.id)} />
                <span className="font-serif text-lg leading-snug">{e.text}</span>
              </label>
            ))}
          </fieldset>
          <div className="mt-6 flex items-center gap-3">
            <button type="button" onClick={() => go(1)} className="btn btn-ghost">Back to the evidence</button>
            <button
              type="button"
              disabled={!pick}
              onClick={() => {
                const v = CASE.explanations.find((e) => e.id === pick)!.verdict;
                setEarned(recordResult({ id: CASE.id, score: v === "best" ? 2 : v === "partly" ? 1 : 0, max: 2, mode: "challenge" }, 30, v === "best" ? [] : [{ challengeId: CASE.id, prompt: CASE.question, correct: CASE.explanations.find((e) => e.verdict === "best")!.text }]));
                setSubmitted(true);
                go(3);
              }}
              className="btn btn-primary"
            >
              Give my verdict
            </button>
          </div>
        </section>
      )}

      {stage === 3 && submitted && chosen && (
        <section className="fade-in mt-8" data-testid="case-explanation">
          <p className="eyebrow">What the evidence shows</p>
          <h2 className="mt-2 font-serif text-3xl leading-tight">
            {chosen.verdict === "best" ? "Case closed: well reasoned." : chosen.verdict === "partly" ? "Partly right." : "The evidence doesn't support that."}
          </h2>
          <p className="mt-2 text-sm text-ink-2">{earned > 0 ? `+${earned} XP` : "No XP this time."}</p>
          <ul className="mt-5 space-y-3">
            {CASE.explanations.map((e) => (
              <li key={e.id} className={`rounded-md border p-4 ${e.verdict === "best" ? "border-navy" : "border-line"} ${e.id === pick ? "ring-2 ring-bronze/50" : ""}`}>
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                  <span className={e.verdict === "best" ? "text-navy" : e.verdict === "partly" ? "text-bronze" : "text-oxblood"}>{e.verdict === "best" ? "Best supported" : e.verdict === "partly" ? "Partly supported" : "Not supported"}</span>
                  {e.id === pick && <span className="badge text-ink-2">Your answer</span>}
                </p>
                <p className="mt-1 font-serif text-lg leading-snug">{e.text}</p>
                <p className="mt-2 leading-relaxed text-ink-2">{e.why}</p>
              </li>
            ))}
          </ul>
          <p className="mt-5 rounded-md bg-paper-3 p-4 leading-relaxed">
            <strong>The lesson:</strong> a precise-looking date can hide a choice of definition. When sources record several beginnings, say which one you mean.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {next.map((s) => <Link key={s.id} href={s.href} className="btn btn-primary">Next: {s.title}</Link>)}
            <Link href="/challenges" className="btn btn-secondary">More challenges</Link>
          </div>
        </section>
      )}
      {stage === 3 && !submitted && (
        <p className="mt-8 text-ink-2">Give your verdict first. <button type="button" className="link" onClick={() => go(2)}>Back to the verdict</button></p>
      )}
    </div>
  );
}
