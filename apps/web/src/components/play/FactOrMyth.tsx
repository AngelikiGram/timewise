"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PEOPLE } from "@/lib/explore";
import { readExplorer, recordFact, useExplorer } from "@/lib/explorer";
import { FEATURED_PEOPLE } from "@/lib/featured";
import { claimDetail, factClaims, resolveMany, type FactClaim, type Verdict } from "@/lib/live-more";
import { Icon } from "../icons";
import { BadgeToast, LevelBar } from "../modes/Gamify";

const VERDICTS: { id: Verdict; label: string; help: string; color: string }[] = [
  { id: "supported", label: "Supported", help: "Recorded with references and no doubt attached", color: "#2f6b3a" },
  { id: "uncertain", label: "Uncertain or disputed", help: "Recorded, but marked circa, disputed, presumably…", color: "#b8901c" },
  { id: "wrong", label: "Marked wrong", help: "A value Wikidata's editors deprecated: a myth, an old error or a superseded claim", color: "#7a1f2b" },
];
const ROUND = 8;
const KEY = "tw-famous-ids-v1";
const shuffle = <T,>(xs: T[]) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/** Well-known people to ask about: the prebuilt lives, lives you followed, and the featured names, matched once. */
async function pool(signal: AbortSignal): Promise<string[]> {
  let famous: string[] = [];
  try { famous = JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[]; } catch { /* none kept */ }
  if (!famous.length) {
    famous = (await resolveMany(FEATURED_PEOPLE, signal)).map((x) => x.id);
    try { localStorage.setItem(KEY, JSON.stringify(famous)); } catch { /* fine */ }
  }
  return [...new Set([...PEOPLE.map((p) => p.id), ...Object.keys(readExplorer().lives).filter((id) => /^Q\d+$/.test(id)), ...famous])];
}

/** Pick a round with all three verdicts where possible: the "marked wrong" ones are the rarest and most interesting. */
function round(claims: FactClaim[]): FactClaim[] {
  const by = (v: Verdict) => shuffle(claims.filter((c) => c.verdict === v));
  const wrong = by("wrong").slice(0, 3), unsure = by("uncertain").slice(0, 2);
  const used = new Set([...wrong, ...unsure].map((c) => c.personId));
  const sure = by("supported").filter((c) => !used.has(c.personId)).slice(0, ROUND - wrong.length - unsure.length);
  return shuffle([...wrong, ...unsure, ...sure]);
}

/** Fact or myth? Judge claims about well-known lives, then see what Wikidata's editors recorded and why. */
export function FactOrMyth() {
  const [claims, setClaims] = useState<FactClaim[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<Verdict | null>(null);
  const [score, setScore] = useState(0);
  const [detail, setDetail] = useState<{ value: string; preferred: string[] } | null>(null);
  const e = useExplorer();

  const start = useCallback(() => {
    const ac = new AbortController();
    setClaims(null); setErr(null); setI(0); setPicked(null); setScore(0);
    pool(ac.signal).then((ids) => factClaims(shuffle(ids).slice(0, 45), ac.signal)).then((c) => { const r = round(c); if (r.length < 3) setErr("Wikidata didn't return enough claims this time. Try again."); else setClaims(r); }, (x: Error) => { if (x.name !== "AbortError") setErr(x.message); });
    return () => ac.abort();
  }, []);
  useEffect(() => start(), [start]);
  const c = claims?.[i];
  useEffect(() => {
    setDetail(null);
    if (!c) return;
    const ac = new AbortController();
    claimDetail(c, ac.signal).then(setDetail, () => setDetail({ value: c.value, preferred: [] }));
    return () => ac.abort();
  }, [c]);

  const answer = (v: Verdict) => { if (!c || picked) return; setPicked(v); const ok = v === c.verdict; if (ok) setScore(score + 1); recordFact(ok); };
  const isDate = c && (c.prop === "P569" || c.prop === "P570");
  const sentence = c ? (isDate ? (detail ? c.statement.replace("…", `${detail.value}.`) : null) : c.statement) : null;
  const finished = claims && i >= claims.length;

  return (
    <div data-testid="fact-or-myth">
      <BadgeToast />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Fact or myth?</p>
          <h1 className="mt-1 font-serif text-4xl leading-tight">What does the record say?</h1>
          <p className="mt-1 max-w-2xl text-ink-2">Claims about when and where famous people were born and died. Some are well supported, some uncertain, and some are old myths or errors that Wikidata&rsquo;s editors have marked wrong. Judge each one, then see why.</p>
        </div>
        <div className="flex items-center gap-4"><p className="text-center"><span className="block font-serif text-3xl tabular-nums">{e.facts.right}</span><span className="text-xs text-ink-2">judged right so far</span></p><LevelBar compact /></div>
      </div>

      {err && <p className="mt-6 rounded-xl border border-line bg-paper-2 p-4 text-ink-2" role="alert">{err} <button type="button" className="link" onClick={start}>Try again</button></p>}
      {!claims && !err && <div className="mt-6" role="status"><p className="text-ink-2">Gathering claims from Wikidata…</p><div className="skeleton mt-3 h-56 rounded-xl" /></div>}

      {claims && !finished && c && (
        <div className="mt-6 max-w-3xl">
          <div className="flex items-center gap-2 text-sm text-ink-2"><span className="tabular-nums">Claim {i + 1} of {claims.length}</span><span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line"><span className="block h-full bg-bronze" style={{ width: `${(i / claims.length) * 100}%` }} /></span><span>{score} right</span></div>
          <blockquote className="mt-4 rounded-2xl border-2 border-line bg-paper p-6 font-serif text-2xl leading-snug sm:text-3xl" data-testid="fact-claim">
            {sentence ?? <span className="text-ink-2">Reading the claim…</span>}
          </blockquote>
          <div className="mt-4 grid gap-2 sm:grid-cols-3" role="group" aria-label="Your verdict">
            {VERDICTS.map((x) => {
              const chosen = picked === x.id, truth = picked && c.verdict === x.id;
              return (
                <button key={x.id} type="button" disabled={!!picked || !sentence} onClick={() => answer(x.id)} data-testid={`verdict-${x.id}`}
                  className={`rounded-xl border-2 p-3 text-left transition ${truth ? "ring-4" : ""} ${chosen && !truth ? "opacity-70" : ""} ${!picked ? "hover:-translate-y-0.5 hover:shadow" : ""}`}
                  style={{ borderColor: picked ? (truth ? x.color : "var(--line)") : x.color, ...(truth ? { ["--tw-ring-color" as string]: `${x.color}33` } : {}) }}>
                  <span className="block font-semibold" style={{ color: x.color }}>{chosen ? (truth ? "✓ " : "✗ ") : truth ? "→ " : ""}{x.label}</span>
                  <span className="block text-xs text-ink-2">{x.help}</span>
                </button>
              );
            })}
          </div>
          {picked && (
            <div className="mt-4 rounded-xl bg-paper-2 p-4" role="status" data-testid="fact-reveal">
              <p className="font-serif text-xl">{picked === c.verdict ? "Right!" : `Not quite: it's “${VERDICTS.find((x) => x.id === c.verdict)!.label}”.`}</p>
              <p className="mt-1">{c.why}</p>
              {detail && detail.preferred.length > 0 && <p className="mt-1 text-sm">The value Wikidata prefers: <b>{detail.preferred.slice(0, 2).join("; ")}</b>.</p>}
              <p className="mt-2 flex flex-wrap gap-3 text-sm"><a className="link" href={c.source} target="_blank" rel="noopener noreferrer">See the statement and its references ↗</a><Link className="link" href={`/explore/life?${PEOPLE.some((p) => p.id === c.personId) ? "id" : "q"}=${c.personId}`}>Follow {c.person}&rsquo;s life →</Link></p>
              <button type="button" className="btn btn-primary mt-3" onClick={() => { setI(i + 1); setPicked(null); }} data-testid="fact-next">{i + 1 < claims.length ? "Next claim" : "See my score"}<Icon name="forward" size={15} /></button>
            </div>
          )}
        </div>
      )}

      {finished && (
        <div className="mt-6 max-w-xl rounded-2xl border-2 border-bronze/50 bg-paper p-6" data-testid="fact-done">
          <p className="font-serif text-3xl">{score} of {claims!.length} {score === claims!.length ? "— a perfect record! 🏆" : score >= claims!.length / 2 ? "— a good eye. 🔍" : "— myths are sneaky. 🕵️"}</p>
          <p className="mt-2 text-ink-2">“Marked wrong” isn&rsquo;t always a myth: it can be an old calendar, a rounding, or a disputed hypothesis. The statement page says which.</p>
          <button type="button" className="btn btn-primary mt-4" onClick={start}>Play another round</button>
        </div>
      )}
      <p className="mt-8 text-xs text-ink-2">Verdicts come from how each statement is recorded on Wikidata (rank, qualifiers, references), not from TIMEWISE. Dates are shown as the statement gives them, in their own calendar.</p>
    </div>
  );
}
