"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { shuffle } from "@/lib/challenges";
import { SKILLS, type Activity, type MapPoint, type SourceRef } from "@/lib/lessons";
import { loadCountries, type Feature } from "../network/views";

/**
 * A small map of a few points, framed around them, on today's country outlines. Points that would sit on top of
 * each other are fanned out around their spot, with a thin line back to it, so every number stays visible.
 * With `onPick`, each point is a button: hover shows its title, click or Enter selects it.
 */
export function MiniMap({ points, label, className = "", selected, onPick, titles }: { points: MapPoint[]; label: string; className?: string; selected?: number | null; onPick?: (i: number) => void; titles?: string[] }) {
  const [shapes, setShapes] = useState<Feature[] | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => { loadCountries().then(setShapes, () => setShapes([])); }, []);
  const W = 600;
  const H = 340;
  const xs = points.map((p) => p.lng);
  const ys = points.map((p) => p.lat);
  const pad = 4;
  let [x0, x1, y0, y1] = [Math.min(...xs) - pad, Math.max(...xs) + pad, Math.min(...ys) - pad, Math.max(...ys) + pad];
  // Keep the map's aspect, and never closer than about 10 degrees across.
  const kx = Math.cos(((y0 + y1) / 2) * (Math.PI / 180));
  let w = Math.max((x1 - x0) * kx, 10);
  let h = Math.max(y1 - y0, 10 * (H / W));
  if (w / h > W / H) h = w / (W / H); else w = h * (W / H);
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  x0 = cx - w / kx / 2; x1 = cx + w / kx / 2; y0 = cy - h / 2; y1 = cy + h / 2;
  const px = (lng: number, lat: number) => [((lng - x0) / (x1 - x0)) * W, ((y1 - lat) / (y1 - y0)) * H] as const;
  const outline = useMemo(() => {
    if (!shapes) return "";
    const ring = (r: number[][]) => r.map((p, i) => { const [x, y] = px(p[0], p[1]); return `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`; }).join("") + "Z";
    return shapes.map((f) => (f.geometry.type === "Polygon" ? (f.geometry.coordinates as number[][][]).map(ring) : (f.geometry.coordinates as number[][][][]).flatMap((p) => p.map(ring))).join("")).join("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shapes, x0, x1, y0, y1]);
  // Fan out points closer than a marker's width: each group is arranged in a small ring around its centre.
  const placed = useMemo(() => {
    const at = points.map((p) => { const [x, y] = px(p.lng, p.lat); return { x, y, tx: x, ty: y }; });
    const group: number[][] = [];
    at.forEach((a, i) => { const g = group.find((g) => g.some((j) => Math.hypot(at[j].x - a.x, at[j].y - a.y) < 26)); if (g) g.push(i); else group.push([i]); });
    for (const g of group) {
      if (g.length < 2) continue;
      const mx = g.reduce((s, i) => s + at[i].x, 0) / g.length, my = g.reduce((s, i) => s + at[i].y, 0) / g.length;
      const r = 16 + g.length * 4;
      g.forEach((i, k) => { const t = -Math.PI / 2 + (2 * Math.PI * k) / g.length; at[i].x = mx + r * Math.cos(t); at[i].y = my + r * Math.sin(t); });
    }
    return at;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, x0, x1, y0, y1]);
  const short = (l: string) => l.length > 0 && l.length <= 2;
  return (
    <figure className={className}>
      <div className="relative overflow-hidden rounded-lg border border-line bg-paper-3/40">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role={onPick ? "group" : "img"} aria-label={label}>
          <path d={outline} fill="var(--paper-3)" stroke="var(--line)" strokeWidth={0.8} />
          {points.map((p, i) => {
            const { x, y, tx, ty } = placed[i];
            const on = selected === i || hover === i;
            const r = (p.answer ? 13 : 9) + (on ? 3 : 0);
            const name = titles?.[i] ?? p.label;
            return (
              <g key={i} className={onPick ? "cursor-pointer outline-none" : ""} role={onPick ? "button" : undefined} tabIndex={onPick ? 0 : undefined} aria-label={onPick ? name : undefined} aria-pressed={onPick ? selected === i : undefined}
                onClick={() => onPick?.(i)} onKeyDown={(e) => { if (onPick && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onPick(i); } }}
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}>
                {(x !== tx || y !== ty) && <><line x1={tx} y1={ty} x2={x} y2={y} stroke="var(--ink-2)" strokeWidth={1.2} /><circle cx={tx} cy={ty} r={3} fill="var(--ink-2)" /></>}
                <circle cx={x} cy={y} r={r} fill={selected === i ? "var(--oxblood)" : p.answer ? "var(--bronze)" : "var(--navy)"} stroke="#fff" strokeWidth={2.5} />
                {short(p.label) ? <text x={x} y={y + 6} textAnchor="middle" fontSize={17} fontWeight={700} fill="#fff">{p.label}</text>
                  : <text x={x + r + 4} y={y + 7} className={`text-[22px] ${p.answer ? "fill-ink font-semibold" : "fill-ink-2"}`} paintOrder="stroke" stroke="var(--paper)" strokeWidth={4} strokeLinejoin="round">{p.label}</text>}
                {name && <title>{name}</title>}
              </g>
            );
          })}
        </svg>
        {hover != null && titles?.[hover] && (
          <div className="pointer-events-none absolute z-10 max-w-[70%] -translate-x-1/2 -translate-y-full rounded-md border border-line bg-paper px-2 py-1 text-xs shadow" style={{ left: `${(placed[hover].x / W) * 100}%`, top: `calc(${(placed[hover].y / H) * 100}% - 18px)` }}>{titles[hover]}</div>
        )}
      </div>
      <figcaption className="mt-1 text-xs text-ink-2">Today&rsquo;s borders, for orientation only.{onPick ? " Click a number to see that step." : ""}</figcaption>
    </figure>
  );
}

export function Sources({ sources }: { sources: SourceRef[] }) {
  if (!sources.length) return null;
  const unique = sources.filter((s, i) => sources.findIndex((o) => o.url === s.url) === i);
  return (
    <ul className="mt-2 grid gap-1 text-sm">
      {unique.map((s) => (
        <li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer" className="link">{s.label} ↗</a>{s.note && <span className="text-ink-2">, {s.note}</span>}</li>
      ))}
    </ul>
  );
}

function Feedback({ ok, activity, correct, onNext, nextLabel }: { ok: boolean; activity: Activity; correct: string; onNext: () => void; nextLabel: string }) {
  const next = useRef<HTMLButtonElement>(null);
  useEffect(() => { next.current?.focus(); }, []);
  return (
    <div className={`fade-in mt-5 rounded-lg border-2 p-4 ${ok ? "border-navy/50 bg-navy/5" : "border-oxblood/50 bg-oxblood/5"}`} role="status" data-testid="feedback">
      <p className={`font-serif text-2xl ${ok ? "text-navy" : "text-oxblood"}`}>{ok ? "Correct" : "Not quite"}</p>
      {!ok && <p className="mt-1 font-medium">The answer: {correct}</p>}
      <p className="mt-2 leading-relaxed">{activity.explanation}</p>
      {activity.kind === "choice" && activity.note && <p className="mt-1 text-sm text-ink-2">{activity.note}</p>}
      {activity.kind === "choice" && activity.map && <MiniMap className="mt-3 max-w-xl" points={activity.map} label={`Map of the answer options; the answer is ${correct}`} />}
      <p className="mt-3 text-xs font-semibold text-ink-2">Sources</p>
      <Sources sources={activity.sources} />
      {!ok && <p className="mt-2 text-sm text-ink-2">Saved for review, so you can try it again later.</p>}
      <button ref={next} type="button" className="btn btn-primary mt-4 w-full sm:w-auto" onClick={onNext} data-testid="continue">{nextLabel}</button>
    </div>
  );
}

export type Answer = { ok: boolean; correct: string };

/** One question. The answer is checked only on "Check", then explained with its sources. */
export function ActivityView({ activity, seed, onAnswer, onNext, nextLabel = "Continue" }: { activity: Activity; seed: number; onAnswer: (a: Answer) => void; onNext: () => void; nextLabel?: string }) {
  const [result, setResult] = useState<Answer | null>(null);
  const answer = (a: Answer) => { setResult(a); onAnswer(a); };
  return (
    <section data-testid="activity" data-kind={activity.kind} data-skill={activity.skill}>
      <p className="text-xs font-semibold text-bronze">{SKILLS[activity.skill].label}</p>
      <h2 className="mt-1 font-serif text-2xl leading-tight sm:text-3xl" tabIndex={-1} data-step-heading>{activity.prompt}</h2>
      {activity.kind === "choice" && activity.context && <blockquote className="mt-3 rounded-lg bg-paper-3/60 px-4 py-3 leading-relaxed">{activity.context}</blockquote>}
      {activity.kind === "order" ? <Order activity={activity} seed={seed} done={!!result} onCheck={answer} /> : activity.kind === "timeline" ? <TimelineSlot activity={activity} done={!!result} onCheck={answer} /> : <Choice activity={activity} seed={seed} done={!!result} onCheck={answer} />}
      {result && <Feedback ok={result.ok} activity={activity} correct={result.correct} onNext={onNext} nextLabel={nextLabel} />}
    </section>
  );
}

function Choice({ activity, seed, done, onCheck }: { activity: Extract<Activity, { kind: "choice" }>; seed: number; done: boolean; onCheck: (a: Answer) => void }) {
  const [picked, setPicked] = useState<string | null>(null);
  const options = useMemo(() => shuffle(activity.options, seed), [activity, seed]);
  const right = activity.options.find((o) => o.id === activity.answer)!;
  return (
    <>
      <div role="radiogroup" aria-label="Answers" className="mt-4 grid gap-2">
        {options.map((o) => {
          const state = !done ? (picked === o.id ? "picked" : "") : o.id === activity.answer ? "right" : picked === o.id ? "wrong" : "";
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={picked === o.id}
              disabled={done}
              onClick={() => setPicked(o.id)}
              className={`flex min-h-12 items-center gap-3 rounded-lg border-2 px-4 py-2.5 text-left transition-colors ${
                state === "picked" ? "border-bronze bg-bronze-soft/40" : state === "right" ? "border-navy bg-navy/10" : state === "wrong" ? "border-oxblood bg-oxblood/10" : "border-line bg-paper-2 hover:border-bronze/60"
              } disabled:cursor-default`}
            >
              <span aria-hidden className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 text-xs ${picked === o.id ? "border-bronze bg-bronze text-on-accent" : "border-line"}`}>{state === "right" ? "✓" : state === "wrong" ? "✗" : ""}</span>
              <span>{o.label}</span>
            </button>
          );
        })}
      </div>
      {!done && (
        <button type="button" className="btn btn-primary mt-4 w-full sm:w-auto" disabled={!picked} onClick={() => onCheck({ ok: picked === activity.answer, correct: right.label })}>
          Check
        </button>
      )}
    </>
  );
}

function Order({ activity, seed, done, onCheck }: { activity: Extract<Activity, { kind: "order" }>; seed: number; done: boolean; onCheck: (a: Answer) => void }) {
  const [items, setItems] = useState(() => shuffle(activity.items, seed));
  const move = (i: number, d: -1 | 1) => setItems((list) => { const out = [...list]; [out[i], out[i + d]] = [out[i + d], out[i]]; return out; });
  const correctAt = (id: string, i: number) => activity.items[i].id === id;
  return (
    <>
      <p className="mt-2 text-sm text-ink-2">Use the arrows to move an event up or down. Dates appear once you check.</p>
      <ol className="mt-3 grid gap-2" aria-label="Your order">
        {items.map((it, i) => (
          <li key={it.id} className={`flex items-center gap-3 rounded-lg border-2 bg-paper-2 px-3 py-2 ${done ? (correctAt(it.id, i) ? "border-navy" : "border-oxblood") : "border-line"}`}>
            <span className="w-5 shrink-0 text-center font-serif text-lg text-ink-2">{i + 1}</span>
            <span className="min-w-0 flex-1">
              <span className="block">{it.label}</span>
              {done && <span className="block text-sm text-ink-2">{it.when}</span>}
            </span>
            {!done && (
              <span className="flex shrink-0 gap-1">
                <button type="button" className="btn btn-ghost btn-icon" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${it.label} earlier`}>↑</button>
                <button type="button" className="btn btn-ghost btn-icon" disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${it.label} later`}>↓</button>
              </span>
            )}
          </li>
        ))}
      </ol>
      {!done && (
        <button type="button" className="btn btn-primary mt-4 w-full sm:w-auto" onClick={() => onCheck({ ok: items.every((it, i) => correctAt(it.id, i)), correct: activity.items.map((x) => x.label).join(" ") })}>
          Check my order
        </button>
      )}
    </>
  );
}

/** Place a record among dated ones: the gaps between them are the choices. */
function TimelineSlot({ activity, done, onCheck }: { activity: Extract<Activity, { kind: "timeline" }>; done: boolean; onCheck: (a: Answer) => void }) {
  const [picked, setPicked] = useState<number | null>(null);
  const n = activity.anchors.length;
  const slotLabel = (i: number) => (i === 0 ? `Before ${activity.anchors[0].label}` : i === n ? `After ${activity.anchors[n - 1].label}` : `Between ${activity.anchors[i - 1].label} and ${activity.anchors[i].label}`);
  const slot = (i: number) => {
    const state = done ? (i === activity.answer ? "right" : picked === i ? "wrong" : "") : picked === i ? "picked" : "";
    return (
      <button
        key={`s${i}`}
        type="button"
        role="radio"
        aria-checked={picked === i}
        aria-label={slotLabel(i)}
        disabled={done}
        onClick={() => setPicked(i)}
        className={`relative z-10 grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-dashed text-lg font-semibold transition-colors ${
          state === "picked" ? "border-bronze bg-bronze text-paper" : state === "right" ? "border-solid border-navy bg-navy text-on-accent" : state === "wrong" ? "border-solid border-oxblood bg-oxblood text-white" : "border-bronze/70 bg-paper-2 text-bronze hover:bg-bronze-soft"
        }`}
      >
        {state === "right" ? "✓" : state === "wrong" ? "✗" : "+"}
      </button>
    );
  };
  return (
    <>
      <div className="mt-4 rounded-xl border-2 border-bronze bg-bronze-soft/40 px-4 py-3 font-serif text-lg" data-testid="timeline-target">{activity.target}</div>
      <p className="mt-2 text-sm text-ink-2">Choose the gap where it belongs. Dates appear on the others; its own date appears once you check.</p>
      <div role="radiogroup" aria-label="Places on the timeline" className="relative mt-4 overflow-x-auto pb-2">
        <div className="relative flex min-w-max items-start gap-2 px-1">
          <span aria-hidden className="absolute inset-x-6 top-[21px] h-0.5 bg-line" />
          {activity.anchors.map((a, i) => (
            <div key={a.id} className="flex items-start gap-2">
              {slot(i)}
              <div className="relative z-10 flex w-36 flex-col items-center text-center sm:w-40">
                <span className="mt-3 h-4 w-4 rounded-full border-2 border-paper-2 bg-ink-2" aria-hidden />
                <span className="mt-1.5 text-xs font-semibold tabular-nums text-ink">{a.when}</span>
                <span className="mt-0.5 line-clamp-3 text-xs leading-snug text-ink-2">{a.label}</span>
              </div>
            </div>
          ))}
          {slot(n)}
        </div>
      </div>
      {!done && (
        <button type="button" className="btn btn-primary mt-3 w-full sm:w-auto" disabled={picked === null} onClick={() => onCheck({ ok: picked === activity.answer, correct: slotLabel(activity.answer) })}>
          Check
        </button>
      )}
    </>
  );
}
