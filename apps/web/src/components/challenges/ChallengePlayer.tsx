"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import { formatWhen } from "@/lib/collection";
import { claim, ESTABLISH_OPTIONS, ev, FORMATS, place, shuffle, source, supportHelp, type Challenge, type Mode } from "@/lib/challenges";
import { recordResult, update, useProgress } from "@/lib/progress";
import { STYLE_URL, applyBasemapPalette } from "../AtlasMap";
import { CreditedImage } from "../ui";

type Outcome = { score: number; max: number; lines: { ok: boolean; text: string }[]; explanation: React.ReactNode; mistakes: { prompt: string; correct: string }[] };

const decade = (iso: string) => `${iso.slice(0, 3)}0s`;
const year = (iso: string) => Number(iso.slice(0, 4));
const km = (a: [number, number], b: [number, number]) => {
  const r = Math.PI / 180;
  const x = (b[0] - a[0]) * r * Math.cos(((a[1] + b[1]) / 2) * r);
  return Math.sqrt(x * x + ((b[1] - a[1]) * r) ** 2) * 6371;
};

export function ChallengePlayer({ challenge, daily, onDone }: { challenge: Challenge; daily?: string; onDone?: () => void }) {
  const [mode, setMode] = useState<Mode>("challenge");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [round, setRound] = useState(1);
  const [earned, setEarned] = useState<number | null>(null);
  const progress = useProgress();
  const doneBefore = progress.results.some((r) => r.id === challenge.id && r.mode === "challenge" && r.xp > 0);

  useEffect(() => {
    setOutcome(null);
    setEarned(null);
  }, [challenge.id]);

  const finish = (o: Outcome) => {
    setOutcome(o);
    const xp = recordResult({ id: challenge.id, score: o.score, max: o.max, mode }, challenge.xp, o.mistakes.map((m) => ({ challengeId: challenge.id, ...m })));
    let bonus = 0;
    if (daily && mode === "challenge") bonus = recordResult({ id: `daily:${daily}`, score: o.score, max: o.max, mode }, 5);
    setEarned(xp + bonus);
    // A correct answer in a later try clears the earlier mistake.
    if (o.score === o.max) update((p) => ({ ...p, mistakes: p.mistakes.filter((m) => m.challengeId !== challenge.id) }));
    onDone?.();
  };
  const retry = () => {
    setOutcome(null);
    setEarned(null);
    setRound(round + 1);
  };

  return (
    <article className="card overflow-hidden" data-testid="challenge" data-kind={challenge.kind}>
      <header className="border-b border-line bg-paper-3/50 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="eyebrow">{FORMATS[challenge.kind].label}{daily ? " · Today’s challenge" : ""}</p>
          <div role="radiogroup" aria-label="Mode" className="flex rounded-full border border-line bg-paper-2 p-0.5 text-sm">
            {(["challenge", "practice"] as Mode[]).map((m) => (
              <button key={m} type="button" role="radio" aria-checked={mode === m} disabled={!!outcome} onClick={() => setMode(m)} className={`rounded-full px-3 py-1 font-medium transition-colors ${mode === m ? "bg-navy text-on-accent dark:bg-bronze" : "text-ink-2 hover:text-ink"} disabled:opacity-60`}>
                {m === "challenge" ? "Challenge" : "Practice"}
              </button>
            ))}
          </div>
        </div>
        <h2 className="mt-2 font-serif text-2xl leading-tight sm:text-3xl">{challenge.title}</h2>
        <p className="mt-1 text-ink-2">{challenge.prompt}</p>
        <p className="mt-1 text-xs text-ink-2">
          {mode === "challenge" ? (doneBefore ? "Already completed: replays are for practice and earn no XP." : `Up to ${challenge.xp} XP, earned once.`) : "Practice: hints and dates are shown, and nothing is scored."}
        </p>
      </header>
      <div className="p-5" key={`${challenge.id}-${round}-${mode}`}>
        {challenge.kind === "order" && <Order c={challenge} mode={mode} seed={round} done={outcome} onSubmit={finish} />}
        {challenge.kind === "locate" && <Locate c={challenge} mode={mode} seed={round} done={outcome} onSubmit={finish} />}
        {challenge.kind === "image" && <ImageDate c={challenge} mode={mode} seed={round} done={outcome} onSubmit={finish} />}
        {challenge.kind === "match" && <Match c={challenge} mode={mode} seed={round} done={outcome} onSubmit={finish} />}
        {challenge.kind === "establish" && <Establish c={challenge} mode={mode} done={outcome} onSubmit={finish} />}
      </div>
      {outcome && (
        <footer className="fade-in border-t border-line bg-paper px-5 py-4" data-testid="challenge-result" aria-live="polite">
          <p className="font-serif text-2xl">
            {outcome.score === outcome.max ? "Well done: all correct." : `${outcome.score} of ${outcome.max} correct.`}
          </p>
          {earned !== null && (
            <p className="mt-1 text-sm text-ink-2">{earned > 0 ? `+${earned} XP` : mode === "practice" ? "Practice round: no XP." : "No XP this time: it was already earned."}</p>
          )}
          <ul className="mt-3 space-y-1.5 text-sm">
            {outcome.lines.map((l, i) => (
              <li key={i} className="flex gap-2"><span aria-hidden className={l.ok ? "text-navy" : "text-oxblood"}>{l.ok ? "✓" : "✗"}</span><span className="sr-only">{l.ok ? "Correct:" : "Not quite:"}</span><span>{l.text}</span></li>
            ))}
          </ul>
          <div className="mt-4 rounded-md border border-line bg-paper-2 p-4 text-[0.95rem] leading-relaxed">{outcome.explanation}</div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={retry} className="btn btn-secondary">Try again</button>
            <Link href="/challenges" className="btn btn-ghost">All challenges</Link>
          </div>
        </footer>
      )}
    </article>
  );
}

type Props<C> = { c: C; mode: Mode; seed?: number; done: Outcome | null; onSubmit: (o: Outcome) => void };

function Order({ c, mode, seed = 1, done, onSubmit }: Props<Extract<Challenge, { kind: "order" }>>) {
  const correct = useMemo(() => [...c.eventIds].sort((a, b) => ev(a).when.start.localeCompare(ev(b).when.start)), [c.eventIds]);
  const [items, setItems] = useState<string[]>(() => shuffle(c.eventIds, c.id.length * 31 + seed * 7));
  const [hints, setHints] = useState(false);
  const [moved, setMoved] = useState<string | null>(null);
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    setItems(next);
    setMoved(next[j]);
  };
  const showDates = mode === "practice" && hints;
  return (
    <div>
      <p className="mb-3 text-sm text-ink-2">Use the arrows to move an event up or down. Earliest at the top.</p>
      <ol className="space-y-2" aria-label="Events to order">
        {items.map((id, i) => {
          const e = ev(id);
          const right = done ? correct[i] === id : null;
          return (
            <li key={id} className={`flex items-center gap-2 rounded-md border bg-paper-2 p-2 pl-3 ${right === null ? "border-line" : right ? "border-navy" : "border-oxblood"} ${moved === id ? "fade-in" : ""}`}>
              <span className="w-6 shrink-0 text-center font-serif text-lg text-ink-2">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-serif text-lg leading-snug">{e.title.en}</span>
                {(showDates || done) && <span className="block text-xs text-ink-2">{done ? formatWhen(e.when) : decade(e.when.start)}</span>}
              </span>
              {!done && (
                <span className="flex shrink-0 gap-1">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${e.title.en} earlier`} className="btn btn-secondary btn-icon">↑</button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label={`Move ${e.title.en} later`} className="btn btn-secondary btn-icon">↓</button>
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {!done && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              const score = items.filter((id, i) => correct[i] === id).length;
              onSubmit({
                score, max: items.length,
                lines: correct.map((id, i) => ({ ok: items[i] === id, text: `${i + 1}. ${ev(id).title.en}: ${formatWhen(ev(id).when)}` })),
                explanation: <p>The dates come from the sourced claims for each event. {correct.map((id) => `${ev(id).title.en} (${formatWhen(ev(id).when)})`).join(", then ")}.</p>,
                mistakes: score < items.length ? [{ prompt: `${c.title}: put in order`, correct: correct.map((id) => ev(id).title.en).join(" → ") }] : [],
              });
            }}
          >
            Check my order
          </button>
          {mode === "practice" && <button type="button" onClick={() => setHints(!hints)} aria-pressed={hints} className="btn btn-ghost">{hints ? "Hide hints" : "Show the decades"}</button>}
        </div>
      )}
    </div>
  );
}

function Locate({ c, mode, seed = 1, done, onSubmit }: Props<Extract<Challenge, { kind: "locate" }>>) {
  const e = ev(c.eventId);
  const target = place(e.placeId!);
  const options = useMemo(() => shuffle(c.options, seed * 13 + 5), [c.options, seed]);
  const [guess, setGuess] = useState<[number, number] | null>(null);
  const [choice, setChoice] = useState("");
  const [useList, setUseList] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const [mapFailed, setMapFailed] = useState(false);

  useEffect(() => {
    if (useList) return;
    let map: MapLibreMap | undefined;
    let cancelled = false;
    (async () => {
      try {
        const maplibre = (await import("maplibre-gl")).default;
        if (cancelled || !box.current) return;
        map = new maplibre.Map({ container: box.current, style: STYLE_URL, center: [12, 47.5], zoom: 3.6, attributionControl: { compact: true } });
        mapRef.current = map;
        map.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
        map.on("style.load", () => applyBasemapPalette(map!, document.documentElement.dataset.theme === "dark" ? "dark" : "light"));
        map.on("error", (ev) => { if (String(ev.error?.message ?? "").includes("styles/")) setMapFailed(true); });
        map.on("click", (ev) => {
          if (doneRef.current) return;
          const ll: [number, number] = [ev.lngLat.lng, ev.lngLat.lat];
          setGuess(ll);
          marker.current?.remove();
          marker.current = new maplibre.Marker({ color: "#8a5a1f" }).setLngLat(ll).addTo(map!);
        });
      } catch {
        setMapFailed(true);
      }
    })();
    return () => { cancelled = true; map?.remove(); mapRef.current = null; };
  }, [useList]);
  const doneRef = useRef(done);
  doneRef.current = done;

  // After answering, show the real place.
  useEffect(() => {
    const m = mapRef.current;
    if (!done || !m) return;
    import("maplibre-gl").then(({ default: maplibre }) => {
      new maplibre.Marker({ color: "#22365a" }).setLngLat([target.lng!, target.lat!]).addTo(m);
      m.flyTo({ center: [target.lng!, target.lat!], zoom: 5 });
    });
  }, [done, target]);

  const submit = () => {
    const truth: [number, number] = [target.lng!, target.lat!];
    if (useList || mapFailed) {
      const ok = choice === target.id;
      return onSubmit({
        score: ok ? 1 : 0, max: 1,
        lines: [{ ok, text: `${e.title.en} took place at ${target.label.en}.` }],
        explanation: <p>{target.label.en} lies at {target.lat!.toFixed(2)}° N, {target.lng!.toFixed(2)}° E{target.names.length > 1 ? `. It has also been called ${target.names.map((n) => n.name).filter((n) => n !== target.label.en).join(", ")}` : ""}. The place comes from the hand-checked record for “{e.title.en}” ({formatWhen(e.when)}).</p>,
        mistakes: ok ? [] : [{ prompt: c.title, correct: target.label.en }],
      });
    }
    const d = km(guess!, truth);
    const score = d < 75 ? 2 : d < 250 ? 1 : 0;
    onSubmit({
      score, max: 2,
      lines: [{ ok: score > 0, text: `Your pin was ${Math.round(d).toLocaleString("en")} km from ${target.label.en}.${score === 2 ? " Spot on." : score === 1 ? " Close." : ""}` }],
      explanation: <p>Within 75 km scores 2, within 250 km scores 1. {target.label.en}{target.names.length > 1 ? ` (also ${target.names.map((n) => n.name).filter((n) => n !== target.label.en).join(", ")})` : ""} is where the hand-checked record places “{e.title.en}”, {formatWhen(e.when)}. The map shows today&rsquo;s borders.</p>,
      mistakes: score === 2 ? [] : [{ prompt: c.title, correct: target.label.en }],
    });
  };

  return (
    <div>
      {!useList && !mapFailed && (
        <>
          <div ref={box} className="h-72 w-full overflow-hidden rounded-md border border-line sm:h-80" role="application" aria-label="Map: click to place your pin" />
          <p className="mt-2 text-sm text-ink-2">{guess ? "Pin placed. Click elsewhere to move it." : "Click the map to place your pin."} {mode === "practice" && <>Hint: it&rsquo;s in today&rsquo;s {new Intl.DisplayNames(["en"], { type: "region" }).of(target.modernCountry) ?? target.modernCountry}.</>}</p>
        </>
      )}
      {(useList || mapFailed) && (
        <fieldset>
          <legend className="text-sm text-ink-2">{mapFailed ? "The map couldn't be loaded, so choose from the list." : "Choose the place:"}</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {options.map((id) => (
              <label key={id} className={`flex cursor-pointer items-center gap-2 rounded-md border p-3 ${choice === id ? "border-bronze bg-paper-3" : "border-line"} ${done ? "pointer-events-none" : ""}`}>
                <input type="radio" name={`${c.id}-place`} value={id} checked={choice === id} onChange={() => setChoice(id)} />
                {place(id).label.en}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {!done && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" disabled={useList || mapFailed ? !choice : !guess} onClick={submit}>Check</button>
          {!mapFailed && <button type="button" className="btn btn-ghost" onClick={() => setUseList(!useList)}>{useList ? "Use the map instead" : "Choose from a list instead"}</button>}
        </div>
      )}
    </div>
  );
}

function ImageDate({ c, mode, seed = 1, done, onSubmit }: Props<Extract<Challenge, { kind: "image" }>>) {
  const e = ev(c.eventId);
  const m = e.media!;
  const made = year(m.created);
  const options = useMemo(() => shuffle(c.options, seed * 3 + 11), [c.options, seed]);
  const [guess, setGuess] = useState(1880);
  const [pick, setPick] = useState("");
  return (
    <div className="grid gap-5 md:grid-cols-[1.2fr_1fr]">
      <div>
        {done ? (
          <CreditedImage src={m.url} alt={m.title} credit={m} imgClassName="max-h-96 w-full object-contain bg-paper-3" />
        ) : (
          // The credit would give the answer away, so it appears once you've answered.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.url} alt="An image to date: its title and credit appear after you answer" className="max-h-96 w-full rounded-md bg-paper-3 object-contain" />
        )}
      </div>
      <div className="space-y-5">
        <label className="block">
          <span className="font-semibold">When was it made?</span>
          <span className="mt-2 flex items-center gap-3">
            <input type="range" min={1830} max={1930} value={guess} disabled={!!done} onChange={(ev) => setGuess(Number(ev.target.value))} className="w-full accent-[var(--bronze)]" aria-label="Year the image was made" />
            <input type="number" min={1830} max={1930} value={guess} disabled={!!done} onChange={(ev) => setGuess(Number(ev.target.value))} className="field !w-24 text-center tabular-nums" aria-label="Year, typed" />
          </span>
          {mode === "practice" && <span className="mt-1 block text-xs text-ink-2">Hint: images of an event are often made later, or show something else.</span>}
        </label>
        <fieldset>
          <legend className="font-semibold">Which event is it shown with?</legend>
          <div className="mt-2 space-y-2">
            {options.map((id) => (
              <label key={id} className={`flex cursor-pointer items-start gap-2 rounded-md border p-3 ${pick === id ? "border-bronze bg-paper-3" : "border-line"} ${done ? "pointer-events-none" : ""}`}>
                <input type="radio" className="mt-1" name={`${c.id}-event`} checked={pick === id} onChange={() => setPick(id)} />
                <span>{ev(id).title.en}{mode === "practice" && <span className="block text-xs text-ink-2">{formatWhen(ev(id).when)}</span>}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {!done && (
          <button
            type="button"
            className="btn btn-primary"
            disabled={!pick}
            onClick={() => {
              const diff = Math.abs(guess - made);
              const yearScore = diff <= 2 ? 2 : diff <= 10 ? 1 : 0;
              const eventOk = pick === e.id;
              onSubmit({
                score: yearScore + (eventOk ? 1 : 0), max: 3,
                lines: [
                  { ok: yearScore > 0, text: `Made in ${m.created}. You said ${guess}: ${diff === 0 ? "exactly right" : `${diff} year${diff === 1 ? "" : "s"} off`}.` },
                  { ok: eventOk, text: `Shown here with “${e.title.en}” (${formatWhen(e.when)}).` },
                ],
                explanation: (
                  <>
                    <p><strong>{m.title}</strong>, by {m.creator}, {m.created}. {m.license}.</p>
                    {m.caveat && <p className="mt-2">{m.caveat}</p>}
                    <p className="mt-2 text-ink-2">Within 2 years scores 2, within 10 scores 1. The date and caveat come from the image&rsquo;s record on Wikimedia Commons.</p>
                  </>
                ),
                mistakes: yearScore + (eventOk ? 1 : 0) < 3 ? [{ prompt: `${c.title}: date the image`, correct: `${m.created}, with “${e.title.en}”` }] : [],
              });
            }}
          >
            Check
          </button>
        )}
      </div>
    </div>
  );
}

function Match({ c, mode, seed = 1, done, onSubmit }: Props<Extract<Challenge, { kind: "match" }>>) {
  const claims = c.claimIds.map(claim);
  const sources = useMemo(() => shuffle([...new Set(claims.map((x) => x.evidence[0].sourceId))], seed * 17 + 3), [claims, seed]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  return (
    <div>
      <ul className="space-y-4">
        {claims.map((cl) => {
          const right = cl.evidence[0].sourceId;
          const ok = done ? answers[cl.id] === right : null;
          return (
            <li key={cl.id} className={`rounded-md border p-4 ${ok === null ? "border-line" : ok ? "border-navy" : "border-oxblood"}`}>
              <p className="font-serif text-lg leading-snug">{cl.statement.en}</p>
              <label className="mt-3 block text-sm">
                <span className="text-ink-2">Supported by</span>
                <select value={answers[cl.id] ?? ""} disabled={!!done} onChange={(e) => setAnswers({ ...answers, [cl.id]: e.target.value })} className="field mt-1">
                  <option value="">Choose a source…</option>
                  {sources.map((s) => <option key={s} value={s}>{source(s).title} ({source(s).provider})</option>)}
                </select>
              </label>
              {mode === "practice" && !done && <p className="mt-2 text-xs text-ink-2">Hint: the source&rsquo;s title usually names the subject of the claim.</p>}
            </li>
          );
        })}
      </ul>
      {!done && (
        <button
          type="button"
          className="btn btn-primary mt-4"
          disabled={claims.some((cl) => !answers[cl.id])}
          onClick={() => {
            const score = claims.filter((cl) => answers[cl.id] === cl.evidence[0].sourceId).length;
            onSubmit({
              score, max: claims.length,
              lines: claims.map((cl) => ({ ok: answers[cl.id] === cl.evidence[0].sourceId, text: `“${cl.statement.en.slice(0, 70)}…” → ${source(cl.evidence[0].sourceId).title}` })),
              explanation: (
                <ul className="space-y-2">
                  {claims.map((cl) => {
                    const s = source(cl.evidence[0].sourceId);
                    return <li key={cl.id}><a href={s.url} target="_blank" rel="noopener noreferrer" className="link">{s.title} ↗</a>: {cl.evidence[0].passage}</li>;
                  })}
                </ul>
              ),
              mistakes: claims.filter((cl) => answers[cl.id] !== cl.evidence[0].sourceId).map((cl) => ({ prompt: `Which source supports: “${cl.statement.en}”`, correct: source(cl.evidence[0].sourceId).title })),
            });
          }}
        >
          Check matches
        </button>
      )}
    </div>
  );
}

function Establish({ c, mode, done, onSubmit }: Props<Extract<Challenge, { kind: "establish" }>>) {
  const cl = claim(c.claimId);
  const [pick, setPick] = useState("");
  return (
    <div>
      <blockquote className="rounded-md border-l-4 border-bronze bg-paper-3/60 p-4 font-serif text-lg leading-snug">{cl.statement.en}</blockquote>
      <ul className="mt-3 space-y-2 text-sm">
        {cl.evidence.map((e) => (
          <li key={e.sourceId} className="rounded-md border border-line p-3">
            <p><span className="font-semibold">{source(e.sourceId).title}</span> <span className="text-ink-2">· {source(e.sourceId).provider} · {source(e.sourceId).recordType.replace(/_/g, " ")}</span></p>
            <p className="mt-1 text-ink-2">What the source does: {e.passage}</p>
          </li>
        ))}
      </ul>
      <fieldset className="mt-4">
        <legend className="font-semibold">The evidence establishes that…</legend>
        <div className="mt-2 space-y-2">
          {ESTABLISH_OPTIONS.map((o) => {
            const state = done ? (o.status === cl.support ? "right" : pick === o.status ? "wrong" : "") : "";
            return (
              <label key={o.status} className={`flex cursor-pointer items-start gap-2 rounded-md border p-3 ${state === "right" ? "border-navy" : state === "wrong" ? "border-oxblood" : pick === o.status ? "border-bronze bg-paper-3" : "border-line"} ${done ? "pointer-events-none" : ""}`}>
                <input type="radio" className="mt-1" name={`${c.id}-status`} checked={pick === o.status} onChange={() => setPick(o.status)} />
                <span>{o.text}{mode === "practice" && <span className="block text-xs text-ink-2">{supportHelp(o.status)}</span>}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
      {!done && (
        <button
          type="button"
          className="btn btn-primary mt-4"
          disabled={!pick}
          onClick={() => {
            const ok = pick === cl.support;
            const right = ESTABLISH_OPTIONS.find((o) => o.status === cl.support)!;
            onSubmit({
              score: ok ? 1 : 0, max: 1,
              lines: [{ ok, text: right.text }],
              explanation: <p>This claim is recorded as <strong>{cl.support}</strong>: {supportHelp(cl.support)} It doesn&rsquo;t establish more than that. {cl.evidence.length > 1 ? "Two sources agree, but two editions of one encyclopedia are not fully independent." : "A single reference work is a starting point, not proof."}</p>,
              mistakes: ok ? [] : [{ prompt: `What does the evidence establish: “${cl.statement.en}”`, correct: right.text }],
            });
          }}
        >
          Check
        </button>
      )}
    </div>
  );
}
