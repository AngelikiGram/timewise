"use client";

import { useEffect, useState } from "react";
import { formatImportedDate, type Precision } from "@/lib/dates";
import { isWikidata, wikidataUrl } from "@/lib/entities";
import type { LearnCard } from "@/lib/lessons";
import { fetchRecord, statementUrl, type RecordData } from "@/lib/record";
import { CONTINENT_LABELS, loadIndex } from "@/lib/world-index";
import { pickMeanwhile, type MeanwhilePick } from "../Meanwhile";

type Verdict = { linked: boolean; relation?: string; url?: string; checked: "both" | "one" };
const qidOf = (c: LearnCard) => c.entity.qid ?? (isWikidata(c.entity.id) ? c.entity.id : undefined);

/** Whether either record carries a Wikidata statement naming the other. */
function verdictFor(anchor: RecordData | null, other: RecordData | null, anchorId: string | undefined, otherId: string): Verdict {
  const a = anchor?.links.find((l) => l.documented && l.target === otherId);
  const b = anchorId ? other?.links.find((l) => l.documented && l.target === anchorId) : undefined;
  const hit = a ?? b;
  return { linked: !!hit, relation: hit?.relation, url: hit ? statementUrl(hit) ?? wikidataUrl(hit.statementOn ?? otherId) : undefined, checked: anchor && other ? "both" : "one" };
}

/**
 * After a lesson: two events from other continents in the same years. The reader decides whether each is a
 * coincidence in time or a documented connection, and the answer comes from the Wikidata statements themselves.
 */
export function MeanwhileQuiz({ cards, continent }: { cards: LearnCard[]; continent?: string | null }) {
  const anchor = cards.find((c) => qidOf(c) && c.year !== undefined) ?? cards.find((c) => c.year !== undefined);
  const [picks, setPicks] = useState<MeanwhilePick[] | null>(null);
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({});
  const [guesses, setGuesses] = useState<Record<string, boolean>>({});
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    if (!anchor) return;
    let live = true;
    const aq = qidOf(anchor);
    const start = `${String(anchor.year).padStart(4, "0")}-01-01`;
    (async () => {
      try {
        const events = await loadIndex();
        const anchorRec = aq ? await fetchRecord(aq).catch(() => null) : null;
        // One documented partner first, when the anchor's own statements name a same-time event elsewhere.
        const ids = new Set(events.map((e) => e.i));
        const near = pickMeanwhile(events, { id: aq ?? anchor.id, title: anchor.title, start, continent }, continent ?? null, 8);
        const linked = anchorRec?.links.filter((l) => l.documented && ids.has(l.target)).map((l) => events.find((e) => e.i === l.target)!).filter((e) => e && e.ct && e.ct !== continent) ?? [];
        const two = [...linked.slice(0, 1).map((e) => ({ ...e, gap: 0 })), ...near].filter((e, i, a) => a.findIndex((x) => x.i === e.i) === i).slice(0, 2);
        const recs = await Promise.all(two.map((e) => fetchRecord(e.i).catch(() => null)));
        if (!live) return;
        setPicks(two);
        setVerdicts(Object.fromEntries(two.map((e, i) => [e.i, verdictFor(anchorRec, recs[i], aq, e.i)])));
        setState("ready");
      } catch { if (live) setState("failed"); }
    })();
    return () => { live = false; };
  }, [anchor?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!anchor || state === "failed" || (state === "ready" && !picks?.length)) return null;
  return (
    <section className="mt-6 rounded-xl border border-bronze/50 bg-paper-2 p-4" data-testid="meanwhile-quiz" aria-labelledby="mw-title">
      <h2 id="mw-title" className="font-serif text-2xl italic">Meanwhile, elsewhere…</h2>
      <p className="mt-1 text-sm text-ink-2">Around the time of <strong className="text-ink">{anchor.title}</strong> ({anchor.when}). For each event, decide: a coincidence in time, or a documented connection?</p>
      {state === "loading" && <p className="mt-3 text-sm text-ink-2" role="status">Finding events and reading their Wikidata statements…</p>}
      <ul className="mt-3 grid gap-3 md:grid-cols-2">
        {picks?.map((e) => {
          const v = verdicts[e.i], g = guesses[e.i];
          const answered = g !== undefined;
          return (
            <li key={e.i} className="rounded-lg border border-line bg-paper p-3" data-testid="meanwhile-item">
              <p className="text-xs text-ink-2"><span className="font-semibold text-ink">{CONTINENT_LABELS[e.ct!] ?? "Elsewhere"}</span>, {formatImportedDate(e.s, e.e, e.p as Precision)}</p>
              <p className="font-serif text-lg leading-snug">{e.t}</p>
              {!answered ? (
                <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={`Is ${e.t} connected to ${anchor.title}?`}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setGuesses((x) => ({ ...x, [e.i]: false }))}>Coincidence</button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setGuesses((x) => ({ ...x, [e.i]: true }))}>Documented connection</button>
                </div>
              ) : (
                <div className={`mt-2 rounded-md p-2 text-sm ${g === v.linked ? "bg-bronze-soft/50" : "bg-paper-3"}`} role="status">
                  <p className="font-semibold">{g === v.linked ? "Right." : "Not quite."}</p>
                  {v.linked ? (
                    <p>A Wikidata statement links them{v.relation ? ` (${v.relation})` : ""}. {v.url && <a className="link" href={v.url} target="_blank" rel="noopener noreferrer">See the statement ↗</a>}</p>
                  ) : (
                    <p>{v.checked === "both" ? "Neither record has a Wikidata statement naming the other" : `${e.t}'s record has no Wikidata statement naming ${anchor.title}`}, so as far as these records show it is a coincidence in time. A missing statement is not proof that no link existed.</p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
