"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { categoryIcon, Icon } from "../icons";
import { formatImportedDate, formatYear, yearOf, type Precision } from "@/lib/dates";
import { recordRound, useExplorer } from "@/lib/explorer";
import { pointOf, qidOf, sparql, v } from "@/lib/live";
import { addCards, firstCard } from "@/lib/memory";
import { atlasHref, CONTINENT_LABELS, loadIndex, type IndexEvent } from "@/lib/world-index";
import { CATEGORY_LABELS } from "@/lib/categories";
import { ExploreMap, type MapItem } from "../modes/ExploreMap";
import { BadgeToast, LevelBar } from "../modes/Gamify";

const ERAS = [
  { id: "all", label: "All of history", lo: -3500, hi: 2026 }, { id: "ancient", label: "Antiquity", lo: -3500, hi: 499 },
  { id: "medieval", label: "Middle Ages", lo: 500, hi: 1449 }, { id: "early", label: "1450–1800", lo: 1450, hi: 1799 },
  { id: "long19", label: "1800–1914", lo: 1800, hi: 1913 }, { id: "wars", label: "1914–1945", lo: 1914, hi: 1945 }, { id: "recent", label: "Since 1945", lo: 1946, hi: 2026 },
];
const LEVELS = [
  { id: "easy", label: "Easy", cards: 5, minLinks: 30, window: 0, help: "Five famous events, far apart" },
  { id: "medium", label: "Medium", cards: 6, minLinks: 15, window: 0, help: "Six events, closer together" },
  { id: "hard", label: "Hard", cards: 8, minLinks: 6, window: 60, help: "Eight events within about sixty years" },
] as const;
type Level = (typeof LEVELS)[number]["id"];
const OK_PRECISION = new Set(["day", "month", "year"]);
const shuffle = <T,>(xs: T[]) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/** Deal a round: well-documented events with distinct years, spread out for easy rounds and close together for hard ones. */
function deal(all: IndexEvent[], era: string, region: string, level: Level): IndexEvent[] {
  const e = ERAS.find((x) => x.id === era)!, L = LEVELS.find((x) => x.id === level)!;
  const pool = all.filter((x) => OK_PRECISION.has(x.p) && x.l >= L.minLinks && (region === "all" || x.ct === region) && (x.n ?? 1) < 5 && yearOf(x.s) >= e.lo && yearOf(x.s) <= e.hi);
  if (pool.length < L.cards) return [];
  for (let attempt = 0; attempt < 40; attempt++) {
    let cand = pool;
    if (L.window) { const a = pool[Math.floor(Math.random() * pool.length)]; const y = yearOf(a.s); cand = pool.filter((x) => Math.abs(yearOf(x.s) - y) <= L.window / 2); }
    const span = Math.max(1, Math.max(...cand.map((x) => yearOf(x.s))) - Math.min(...cand.map((x) => yearOf(x.s))));
    const gap = level === "easy" ? span / 25 : level === "medium" ? span / 60 : 1;
    const picked: IndexEvent[] = [];
    for (const x of shuffle(cand)) {
      if (picked.every((p) => Math.abs(yearOf(p.s) - yearOf(x.s)) >= gap && p.t !== x.t)) picked.push(x);
      if (picked.length === L.cards) return picked;
    }
  }
  return [];
}

/** Build your own timeline: put real events in order, then see them on the true timeline and map. */
export function TimelineGame() {
  const [all, setAll] = useState<IndexEvent[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [era, setEra] = useState("all");
  const [region, setRegion] = useState("all");
  const [level, setLevel] = useState<Level>("easy");
  const [cards, setCards] = useState<IndexEvent[]>([]);
  const [order, setOrder] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [drag, setDrag] = useState<number | null>(null);
  const e = useExplorer();
  useEffect(() => { loadIndex().then(setAll, () => setFailed(true)); }, []);
  const newRound = useCallback(() => {
    if (!all) return;
    const c = deal(all, era, region, level);
    setCards(c); setOrder(shuffle(c.map((x) => x.i))); setDone(false);
  }, [all, era, region, level]);
  useEffect(() => { newRound(); }, [newRound]);

  const byId = useMemo(() => new Map(cards.map((c) => [c.i, c])), [cards]);
  const truth = useMemo(() => [...cards].sort((a, b) => yearOf(a.s) - yearOf(b.s)).map((c) => c.i), [cards]);
  const right = order.filter((id, i) => truth[i] === id).length;
  const move = (from: number, to: number) => { if (to < 0 || to >= order.length || done) return; const n = [...order]; const [x] = n.splice(from, 1); n.splice(to, 0, x); setOrder(n); };

  const submit = () => {
    setDone(true);
    const perfect = right === order.length;
    recordRound(perfect);
    // Every pair placed the wrong way round becomes a review question for later.
    const from = { kind: "game" as const, title: "Timeline game", href: "/challenges/timeline" };
    const wrong: ReturnType<typeof firstCard>[] = [];
    for (let i = 0; i + 1 < order.length; i++) {
      const a = byId.get(order[i])!, b = byId.get(order[i + 1])!;
      if (yearOf(a.s) > yearOf(b.s)) wrong.push(firstCard({ id: a.i, title: a.t, year: yearOf(a.s) }, { id: b.i, title: b.t, year: yearOf(b.s) }, from));
    }
    addCards(wrong.filter((c): c is NonNullable<typeof c> => !!c).slice(0, 3));
  };

  if (failed) return <p className="mt-6 text-ink-2">The event index couldn&rsquo;t be loaded.</p>;
  return (
    <div data-testid="timeline-game">
      <BadgeToast />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Build your own timeline</p>
          <h1 className="mt-1 font-serif text-4xl leading-tight">What came first?</h1>
          <p className="mt-1 max-w-2xl text-ink-2">Drag the cards into order, earliest at the top. Then see where they really fall, on the timeline and the map.</p>
        </div>
        <div className="flex items-center gap-4">
          <p className="text-center"><span className="block font-serif text-3xl tabular-nums">{e.timeline.streak}</span><span className="text-xs text-ink-2">perfect in a row · best {e.timeline.best}</span></p>
          <LevelBar compact />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2" role="group" aria-label="Round settings">
        <label className="text-sm"><span className="sr-only">Era</span><select className="field !py-1.5 text-sm" value={era} onChange={(x) => setEra(x.target.value)}>{ERAS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></label>
        <label className="text-sm"><span className="sr-only">Region</span><select className="field !py-1.5 text-sm" value={region} onChange={(x) => setRegion(x.target.value)}><option value="all">The whole world</option>{Object.entries(CONTINENT_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <div role="radiogroup" aria-label="Difficulty" className="flex gap-1">{LEVELS.map((l) => <button key={l.id} type="button" role="radio" aria-checked={level === l.id} data-on={level === l.id} className="chip" title={l.help} onClick={() => setLevel(l.id)}>{l.label}</button>)}</div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={newRound}><Icon name="reset" size={15} />New cards</button>
      </div>

      {!all && <div className="skeleton mt-5 h-80 rounded-xl" role="status" aria-label="Loading events" />}
      {all && !cards.length && <p className="mt-6 rounded-xl border border-line bg-paper-2 p-4 text-ink-2">Not enough well-documented events for this era and region at this level. Try an easier level or the whole world.</p>}

      {cards.length > 0 && (
        <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <p className="mb-2 text-xs font-semibold text-ink-2">{done ? "Your order" : "Earliest"}</p>
            <ol className="grid gap-2" data-testid="timeline-cards">
              {order.map((id, i) => {
                const c = byId.get(id)!;
                const ok = done && truth[i] === id;
                return (
                  <li key={id} draggable={!done} onDragStart={() => setDrag(i)} onDragOver={(x) => { x.preventDefault(); }} onDrop={() => { if (drag != null) move(drag, i); setDrag(null); }}
                    className={`flex items-center gap-3 rounded-xl border-2 bg-paper p-3 transition-colors ${done ? (ok ? "border-green-700/60 bg-green-50 [[data-theme=dark]_&]:bg-green-950/30" : "border-oxblood/60 bg-oxblood/5") : drag === i ? "border-bronze opacity-60" : "cursor-grab border-line hover:border-bronze"}`}>
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-paper-3 font-serif tabular-nums">{i + 1}</span>
                    <Icon name={categoryIcon(c.c)} size={20} className="shrink-0 text-bronze" />
                    <span className="min-w-0 flex-1"><span className="block font-medium leading-snug">{c.t}</span>{!done && <span className="block text-xs text-ink-2">{[CATEGORY_LABELS[c.c], c.k ? c.k.replaceAll("_", " ").replace(/^./, (x) => x.toUpperCase()) : c.ct ? CONTINENT_LABELS[c.ct] : null].filter(Boolean).join(", ")}</span>}{done && <span className="block text-sm text-ink-2">{formatImportedDate(c.s, c.e, c.p as Precision)}{!ok && <> · belongs at {truth.indexOf(id) + 1}</>}</span>}</span>
                    {!done ? (
                      <span className="flex shrink-0 flex-col">
                        <button type="button" className="btn btn-ghost btn-sm !min-h-0 !px-1.5 !py-0.5" aria-label={`Move ${c.t} earlier`} onClick={() => move(i, i - 1)} disabled={i === 0}>▲</button>
                        <button type="button" className="btn btn-ghost btn-sm !min-h-0 !px-1.5 !py-0.5" aria-label={`Move ${c.t} later`} onClick={() => move(i, i + 1)} disabled={i === order.length - 1}>▼</button>
                      </span>
                    ) : <span aria-label={ok ? "Right place" : "Wrong place"} className={`text-xl ${ok ? "text-green-700" : "text-oxblood"}`}>{ok ? "✓" : "✗"}</span>}
                  </li>
                );
              })}
            </ol>
            <p className="mt-2 text-xs text-ink-2">{done ? "Latest at the bottom." : "Latest. Drag, or use the arrows."}</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {!done ? <button type="button" className="btn btn-primary" onClick={submit} data-testid="timeline-submit">Check my timeline</button> : (
                <>
                  <p className="font-serif text-2xl" role="status" data-testid="timeline-score">{right === order.length ? "All in the right place" : `${right} of ${order.length} in the right place`}</p>
                  <button type="button" className="btn btn-primary" onClick={newRound}>Next round<Icon name="forward" size={15} /></button>
                </>
              )}
            </div>
            {done && right < order.length && <p className="mt-2 text-sm text-ink-2">The pairs you swapped are now in your <Link href="/learn/review" className="link">review</Link>, to ask again tomorrow.</p>}
          </div>
          <div>{done ? <Reveal events={truth.map((id) => byId.get(id)!)} /> : <Hint n={cards.length} />}</div>
        </div>
      )}
    </div>
  );
}

function Hint({ n }: { n: number }) {
  return (
    <div className="grid h-full min-h-48 place-items-center rounded-xl border-2 border-dashed border-line p-6 text-center text-ink-2">
      <p><Icon name="timeline" size={40} className="mx-auto text-bronze" /><span className="mt-2 block">Put the {n} events in order.</span><span className="block text-sm">The real timeline and map appear when you check.</span></p>
    </div>
  );
}

/** The events on their true timeline, and on a map where Wikidata places them. */
function Reveal({ events }: { events: IndexEvent[] }) {
  const [points, setPoints] = useState<MapItem[] | null>(null);
  useEffect(() => {
    const ac = new AbortController();
    sparql(`SELECT ?x ?c WHERE { VALUES ?x { ${events.map((x) => `wd:${x.i}`).join(" ")} } OPTIONAL { ?x wdt:P625 ?c1 } OPTIONAL { ?x wdt:P276/wdt:P625 ?c2 } BIND(COALESCE(?c1, ?c2) AS ?c) FILTER(BOUND(?c)) }`, ac.signal)
      .then((rows) => {
        const seen = new Set<string>();
        setPoints(rows.flatMap((r) => { const id = qidOf(v(r, "x")), pt = pointOf(v(r, "c")); const ev = events.find((x) => x.i === id); if (!id || !pt || !ev || seen.has(id)) return []; seen.add(id); return [{ id, label: ev.t, lng: pt[0], lat: pt[1], layer: "round", year: yearOf(ev.s), sub: formatYear(yearOf(ev.s)), links: [{ href: atlasHref(ev), label: "Open in the atlas" }, { href: `/stories/live?q=${id}`, label: "Tell as a story" }] }]; }));
      }, () => setPoints([]));
    return () => ac.abort();
  }, [events]);
  const ys = events.map((x) => yearOf(x.s));
  const lo = Math.min(...ys), hi = Math.max(...ys), span = Math.max(1, hi - lo);
  return (
    <div className="grid gap-4" data-testid="timeline-reveal">
      <div className="rounded-xl border border-line bg-paper-2 p-4">
        <p className="text-xs font-semibold text-ink-2">The real timeline · {formatYear(lo)}–{formatYear(hi)}</p>
        <div className="relative mt-3" style={{ height: events.length * 30 + 20 }}>
          <span className="absolute left-0 right-0 top-2 h-1 rounded bg-bronze/40" />
          {events.map((x, i) => {
            const at = ((yearOf(x.s) - lo) / span) * 100;
            return (
              <div key={x.i} className="absolute" style={{ left: `${at}%`, top: 0 }}>
                <span className="absolute -left-1.5 top-0.5 h-3.5 w-3.5 rounded-full border-2 border-paper bg-oxblood" />
                <span className="absolute w-px bg-line" style={{ left: 0, top: 16, height: i * 30 + 8 }} />
                <Link href={atlasHref(x)} className={`absolute whitespace-nowrap text-xs hover:text-bronze ${at > 60 ? "right-1" : "left-1"}`} style={{ top: i * 30 + 22 }}><b className="tabular-nums">{formatYear(yearOf(x.s))}</b> {x.t.length > 34 ? `${x.t.slice(0, 33)}…` : x.t}</Link>
              </div>
            );
          })}
        </div>
      </div>
      {points === null ? <div className="skeleton h-72 rounded-xl" /> : points.length > 0 ? <ExploreMap items={points} layers={[{ id: "round", label: "This round", color: "#8a5a1c" }]} colorByYear label="Where these events happened" height={320} /> : <p className="text-sm text-ink-2">Wikidata gives no single place for these events.</p>}
    </div>
  );
}
