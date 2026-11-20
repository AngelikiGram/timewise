"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatYear } from "@/lib/dates";
import { recordSurprise, recordWhy } from "@/lib/explorer";
import { FEATURED_EVENTS, pick } from "@/lib/featured";
import { searchEntities, wdUrl } from "@/lib/live";
import { loadLinks, type Link as WLink } from "@/lib/live-more";
import { Icon } from "../icons";
import { BadgeToast, LevelBar } from "./Gamify";
import { LiveSearch } from "./LiveSearch";

type N = { id: string; label: string; description?: string; year: number | null; depth: number; state: "closed" | "loading" | "open" | "failed" };
type E = { from: string; to: string; kind: "cause" | "seq"; source: string };
const W = 230, H = 58, COL = 290, ROW = 74;

/**
 * Why did this happen? An event's documented causes on the left and consequences on the right, as a network
 * you grow by clicking: each click opens that event's own causes and effects. Every arrow is a Wikidata statement.
 */
export function WhyView() {
  const sp = useSearchParams();
  const q = sp.get("q"), find = sp.get("find");
  if (q && /^Q\d+$/.test(q)) return <Frame><Network root={q} key={q} /></Frame>;
  if (find) return <FindWhy words={find} key={find} />;
  return <Frame><Intro /></Frame>;
}

function FindWhy({ words }: { words: string }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    const ac = new AbortController();
    searchEntities(words, ac.signal, 1).then((h) => { if (h[0]) router.replace(`/explore/why?q=${h[0].id}`); else setErr(`Nothing on Wikidata matches “${words}”.`); }, (e: Error) => { if (e.name !== "AbortError") setErr(e.message); });
    return () => ac.abort();
  }, [words, router]);
  return <Frame>{err ? <p role="alert" className="text-ink-2">{err}</p> : <p role="status" className="text-ink-2">Finding “{words}”…</p>}</Frame>;
}

function Frame({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-[1400px] px-4 pb-16 pt-6 sm:px-6" data-testid="why">
      <BadgeToast />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1 sm:max-w-xl"><LiveSearch label="Find an event" placeholder="Why did… the French Revolution happen? World War I? The Reformation?" local={FEATURED_EVENTS.map((e) => ({ id: e, label: e, href: `/explore/why?find=${encodeURIComponent(e)}` }))} live={(s, sig) => searchEntities(s, sig)} hrefFor={(h) => `/explore/why?q=${h.id}`} testId="why-search" /></div>
        <button type="button" className="btn btn-primary" onClick={() => { recordSurprise(); router.push(`/explore/why?find=${encodeURIComponent(pick(FEATURED_EVENTS))}`); }}>Surprise me</button>
        <span className="sm:ml-auto"><LevelBar compact /></span>
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}

function Intro() {
  return (
    <div>
      <p className="eyebrow">Why did this happen?</p>
      <h1 className="mt-1 font-serif text-4xl">Causes on the left, consequences on the right</h1>
      <p className="mt-1 max-w-2xl text-ink-2">Pick an event and see what Wikidata documents as its causes and its effects. Click any of them to open their causes and effects in turn, and watch history connect.</p>
      <ul className="mt-5 flex flex-wrap gap-2">{FEATURED_EVENTS.map((e) => <li key={e}><Link href={`/explore/why?find=${encodeURIComponent(e)}`} className="chip"><Icon name="cause" size={14} />{e}</Link></li>)}</ul>
    </div>
  );
}

function Network({ root }: { root: string }) {
  const [nodes, setNodes] = useState<Map<string, N>>(new Map([[root, { id: root, label: "…", year: null, depth: 0, state: "closed" }]]));
  const [edges, setEdges] = useState<E[]>([]);
  const [sel, setSel] = useState(root);
  const [err, setErr] = useState<string | null>(null);

  const started = useRef(new Set<string>());
  const open = useCallback(async (id: string) => {
    if (started.current.has(id)) return;
    started.current.add(id);
    setNodes((m) => { const cur = m.get(id); if (!cur) return m; const n = new Map(m); n.set(id, { ...cur, state: "loading" }); return n; });
    try {
      const { node, links } = await loadLinks(id);
      recordWhy(id, node.label);
      const side = (k: WLink["kind"]) => links.filter((l) => l.kind === k).sort((a, b) => (a.year ?? 1e9) - (b.year ?? 1e9)).slice(0, 10);
      setNodes((m) => {
        const n = new Map(m), me = n.get(id)!;
        n.set(id, { ...me, label: node.label, description: node.description, year: node.year ?? me.year, state: "open" });
        for (const l of [...side("cause"), ...side("before"), ...side("effect"), ...side("after")]) {
          if (n.has(l.id)) continue;
          n.set(l.id, { id: l.id, label: l.label, description: l.description, year: l.year, depth: me.depth + (l.kind === "cause" || l.kind === "before" ? -1 : 1), state: "closed" });
        }
        return n;
      });
      setEdges((es) => {
        const add = [...side("cause"), ...side("before"), ...side("effect"), ...side("after")].map<E>((l) => (l.kind === "cause" || l.kind === "before" ? { from: l.id, to: id, kind: l.kind === "cause" ? "cause" : "seq", source: l.source } : { from: id, to: l.id, kind: l.kind === "effect" ? "cause" : "seq", source: l.source }));
        return [...es, ...add.filter((a) => !es.some((x) => x.from === a.from && x.to === a.to))];
      });
    } catch (e) {
      started.current.delete(id);
      setNodes((m) => { const n = new Map(m); const me = n.get(id); if (me) n.set(id, { ...me, state: "failed" }); return n; });
      if (id === root) setErr((e as Error).message);
    }
  }, [root]);
  useEffect(() => { open(root); }, [open, root]);

  const layout = useMemo(() => {
    const cols = new Map<number, N[]>();
    for (const n of nodes.values()) cols.set(n.depth, [...(cols.get(n.depth) ?? []), n]);
    const depths = [...cols.keys()].sort((a, b) => a - b);
    const tallest = Math.max(1, ...[...cols.values()].map((c) => c.length));
    const pos = new Map<string, { x: number; y: number }>();
    depths.forEach((d, ci) => {
      const col = cols.get(d)!.sort((a, b) => (a.year ?? 1e9) - (b.year ?? 1e9) || a.label.localeCompare(b.label));
      const off = ((tallest - col.length) * ROW) / 2;
      col.forEach((n, ri) => pos.set(n.id, { x: 20 + ci * COL, y: 30 + off + ri * ROW }));
    });
    return { pos, width: 40 + depths.length * COL - (COL - W), height: 60 + tallest * ROW, depths };
  }, [nodes]);

  const rootNode = nodes.get(root)!;
  const s = nodes.get(sel);
  const touching = edges.filter((e) => e.from === sel || e.to === sel);
  if (err) return <p role="alert" className="rounded-xl border border-line bg-paper-2 p-4 text-ink-2">{err}</p>;
  const lonely = rootNode.state === "open" && nodes.size === 1;

  return (
    <div>
      <p className="eyebrow">Why did this happen?</p>
      <h1 className="mt-1 font-serif text-4xl leading-tight">{rootNode.label}{rootNode.year != null && <span className="text-2xl text-ink-2"> · {formatYear(rootNode.year)}</span>}</h1>
      {rootNode.description && <p className="mt-1 text-ink-2">{rootNode.description}</p>}
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
        <li className="inline-flex items-center gap-1.5"><svg width="28" height="8"><line x1="0" y1="4" x2="28" y2="4" stroke="var(--oxblood)" strokeWidth="2" /></svg>cause → effect</li>
        <li className="inline-flex items-center gap-1.5"><svg width="28" height="8"><line x1="0" y1="4" x2="28" y2="4" stroke="var(--ink-2)" strokeWidth="2" strokeDasharray="4 3" /></svg>came before → came after</li>
        <li>Click a box to open its own causes and effects.</li>
      </ul>
      {!lonely && rootNode.state === "open" && nodes.size <= 4 && <p className="mt-3 text-sm text-ink-2">Wikidata documents only {nodes.size - 1} direct cause or effect link{nodes.size === 2 ? "" : "s"} for {rootNode.label}. Click a box to follow the chain further, or <Link className="link" href={`/stories/live?q=${root}`}>read it as a story through its parts</Link>, or see its <Link className="link" href={`/connections?id=${root}`}>people, places and other connections</Link>.</p>}
      {lonely && <p className="mt-4 rounded-xl border border-line bg-paper-2 p-4 text-ink-2">Wikidata records no causes or effects for {rootNode.label} yet. Try a larger event, or <Link className="link" href={`/stories/live?q=${root}`}>read it as a story</Link> through its parts.</p>}
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="overflow-auto rounded-2xl border border-line bg-paper-2" style={{ maxHeight: "70vh" }} data-testid="why-graph">
          <svg width={layout.width} height={layout.height} role="group" aria-label={`Causes and effects around ${rootNode.label}`}>
            <defs>
              <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" fill="var(--oxblood)" /></marker>
              <marker id="arr2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" fill="var(--ink-2)" /></marker>
            </defs>
            {layout.depths.length > 1 && layout.depths.map((d, ci) => <text key={d} x={20 + ci * COL + W / 2} y={18} textAnchor="middle" fontSize={11} fill="var(--ink-2)">{d < 0 ? (d === -1 ? "Causes" : `Causes of causes${d < -2 ? ` (${-d})` : ""}`) : d > 0 ? (d === 1 ? "Consequences" : `Further on${d > 2 ? ` (${d})` : ""}`) : "The event"}</text>)}
            {edges.map((e) => {
              const a = layout.pos.get(e.from), b = layout.pos.get(e.to);
              if (!a || !b) return null;
              const x1 = a.x + W, y1 = a.y + H / 2, x2 = b.x, y2 = b.y + H / 2;
              const back = x2 <= x1;
              const d = back ? `M${a.x + W / 2},${a.y + H} C${a.x + W / 2},${a.y + H + 40} ${b.x + W / 2},${b.y + H + 40} ${b.x + W / 2},${b.y + H}` : `M${x1},${y1} C${x1 + 50},${y1} ${x2 - 50},${y2} ${x2 - 2},${y2}`;
              const on = e.from === sel || e.to === sel;
              return <path key={`${e.from}>${e.to}`} d={d} fill="none" stroke={e.kind === "cause" ? "var(--oxblood)" : "var(--ink-2)"} strokeDasharray={e.kind === "seq" ? "5 4" : undefined} strokeWidth={on ? 2.6 : 1.4} opacity={on ? 1 : 0.55} markerEnd={`url(#${e.kind === "cause" ? "arr" : "arr2"})`} />;
            })}
            {[...nodes.values()].map((n) => {
              const p = layout.pos.get(n.id)!;
              const isRoot = n.id === root, picked = n.id === sel;
              const fill = isRoot ? "var(--oxblood)" : n.depth < 0 ? "#e3ecf4" : n.depth > 0 ? "#e8efe1" : "var(--paper)";
              const ink = isRoot ? "#fff" : "#2a2418";
              return (
                <g key={n.id} transform={`translate(${p.x},${p.y})`} className="cursor-pointer" role="button" tabIndex={0} aria-label={`${n.label}${n.year != null ? `, ${formatYear(n.year)}` : ""}. ${n.state === "open" ? "Opened" : "Open its causes and effects"}`}
                  onClick={() => { setSel(n.id); if (n.state === "closed" || n.state === "failed") open(n.id); }} onKeyDown={(k) => { if (k.key === "Enter" || k.key === " ") { k.preventDefault(); setSel(n.id); if (n.state === "closed" || n.state === "failed") open(n.id); } }}>
                  <rect width={W} height={H} rx={12} fill={fill} stroke={picked ? "var(--bronze)" : "var(--line)"} strokeWidth={picked ? 3 : 1} />
                  <text x={12} y={23} fontSize={13} fontWeight={600} fill={ink}>{n.label.length > 30 ? `${n.label.slice(0, 29)}…` : n.label}<title>{n.label}</title></text>
                  <text x={12} y={42} fontSize={11} fill={isRoot ? "#f3e2c8" : "#6b604c"}>{n.year != null ? formatYear(n.year) : "undated"}{n.state === "loading" ? " · opening…" : n.state === "closed" ? " · click to open" : ""}</text>
                  {n.state === "closed" && <circle cx={W - 16} cy={H / 2} r={9} fill="var(--bronze)" />}
                  {n.state === "closed" && <text x={W - 16} y={H / 2 + 4} fontSize={13} fontWeight={700} textAnchor="middle" fill="#fff">+</text>}
                </g>
              );
            })}
          </svg>
        </div>
        <aside className="rounded-2xl border border-line bg-paper p-4" aria-live="polite" data-testid="why-panel">
          {s && (
            <>
              <p className="text-xs font-semibold text-bronze">{s.id === root ? "The event" : s.depth < 0 ? "A cause, or what came before" : "A consequence, or what came after"}</p>
              <h2 className="mt-1 font-serif text-2xl leading-tight">{s.label}</h2>
              <p className="text-sm text-ink-2">{[s.year != null ? formatYear(s.year) : null, s.description].filter(Boolean).join(" · ")}</p>
              <ul className="mt-3 grid gap-1.5 text-sm">
                {touching.map((e) => { const a = nodes.get(e.from)!, b = nodes.get(e.to)!; return <li key={`${e.from}>${e.to}`}><b>{a.label}</b> {e.kind === "cause" ? "led to" : "was followed by"} <b>{b.label}</b>. <a className="link text-xs" href={e.source} target="_blank" rel="noopener noreferrer">statement ↗</a></li>; })}
              </ul>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={`/stories/live?q=${s.id}`} className="btn btn-secondary btn-sm"><Icon name="book" size={15} />Read as a story</Link>
                {s.id !== root && <Link href={`/explore/why?q=${s.id}`} className="btn btn-ghost btn-sm"><Icon name="cause" size={15} />Centre on this</Link>}
                {s.year != null && <Link href={`/explore/year?y=${s.year}`} className="btn btn-ghost btn-sm"><Icon name="timeline" size={15} />{formatYear(s.year)}</Link>}
                <a href={wdUrl(s.id)} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">Wikidata ↗</a>
              </div>
            </>
          )}
          <p className="mt-6 text-xs text-ink-2">Arrows follow Wikidata&rsquo;s has cause, has effect, immediate cause, follows and followed by. They show what is documented, which is not everything that mattered: absent arrows are gaps in the record, not proof of no influence.</p>
        </aside>
      </div>
    </div>
  );
}
