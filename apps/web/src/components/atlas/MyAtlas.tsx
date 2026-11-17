"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { fold } from "@/lib/dedupe";
import { isWikidata, TYPE_LABEL, wikidataUrl, type EntityType } from "@/lib/entities";
import { lessonHref, pathById } from "@/lib/lessons";
import { exploreEntity, logAnswer, toggleSaveEntity, useProgress, type AtlasEdge, type AtlasNode } from "@/lib/progress";
import { fetchRecord, statementUrl, type RecordData } from "@/lib/record";
import { Icon, iconPath, type IconName } from "../icons";
import { TYPE_ICON } from "./EntityPanel";
import { restoreLinkQuestion } from "./ConnectExercise";
import { ActivityView } from "../lessons/activities";
import type { Activity } from "@/lib/lessons";

const FIRST = 6, MORE = 12;
// Relations read from the focus's point of view that put the other record before or after it.
const EARLIER = new Set(["caused by", "immediate cause", "follows", "replaces", "influenced by", "based on", "inspired by", "preceded by"]);
const LATER = new Set(["led to", "followed by", "replaced by", "influenced", "succeeded by"]);
const PW = 172, PH = 48, FW = 230, FH = 76, MS = 460;
type Zone = "top" | "bottom" | "left" | "right";
type Placed = { id: string; x: number; y: number; t: number };
type Pos = { x: number; y: number; o: number };
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const TYPES: EntityType[] = ["event", "person", "place", "country", "organization", "object"];
const STATE_LABEL = { encountered: "Encountered", explored: "Explored", saved: "Saved", practised: "Practised" } as const;

type Neighbour = { id: string; node?: AtlasNode; label: string; type: EntityType; edge?: AtlasEdge; preview?: { relation: string; url: string; group: string } };

/** A distinct outline for each kind of entity, so type never depends on colour or icon alone. */
function Shape({ type, r, className }: { type: EntityType; r: number; className?: string }) {
  if (type === "person") return <rect x={-r} y={-r} width={2 * r} height={2 * r} rx={r * 0.45} className={className} />;
  if (type === "place") return <polygon points={`0,${-r * 1.2} ${r * 1.2},0 0,${r * 1.2} ${-r * 1.2},0`} className={className} />;
  if (type === "country") return <polygon points={[0, 1, 2, 3, 4, 5].map((i) => `${Math.cos((Math.PI / 3) * i) * r * 1.1},${Math.sin((Math.PI / 3) * i) * r * 1.1}`).join(" ")} className={className} />;
  if (type === "object") return <rect x={-r} y={-r} width={2 * r} height={2 * r} className={className} />;
  if (type === "organization") return <polygon points={`0,${-r * 1.2} ${r * 1.15},${r * 0.8} ${-r * 1.15},${r * 0.8}`} className={className} />;
  return <circle r={r} className={className} />;
}
/** The type's outline with its icon inside: type never rests on colour alone. */
function TypeBadge({ type, size = 30, dim, solid }: { type: EntityType; size?: number; dim?: boolean; solid?: boolean }) {
  return (
    <svg viewBox="-16 -16 32 32" width={size} height={size} className={`shrink-0 ${solid ? "text-paper" : dim ? "text-ink-2" : "text-bronze"}`} aria-hidden>
      <Shape type={type} r={12} className={solid ? "fill-bronze" : `fill-paper ${dim ? "stroke-ink-2/60" : "stroke-bronze"} [stroke-width:1.5]`} />
      <path d={iconPath(TYPE_ICON[type])} transform="translate(-8,-8) scale(0.667)" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
const ago = (iso?: string) => { if (!iso) return ""; const d = Math.round((Date.now() - Date.parse(iso)) / 86400000); return d <= 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`; };

export function MyAtlas() {
  const p = useProgress();
  const router = useRouter();
  const params = useSearchParams();
  const back = params.get("back");
  const nodes = useMemo(() => p.atlas?.nodes ?? {}, [p.atlas]);
  const edges = useMemo(() => Object.values(p.atlas?.edges ?? {}), [p.atlas]);
  const all = useMemo(() => Object.values(nodes), [nodes]);
  // The first view: the most recent entity that has sourced links, so the graph never opens empty.
  const latest = useMemo(() => {
    const linked = new Set(edges.flatMap((e) => [e.from, e.to]));
    const recent = [...all].sort((a, b) => (b.explored ?? b.encountered ?? "").localeCompare(a.explored ?? a.encountered ?? ""));
    return (recent.find((n) => linked.has(n.id)) ?? recent[0])?.id;
  }, [all, edges]);
  const [focus, setFocus] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [more, setMore] = useState(false);
  const [types, setTypes] = useState<Set<EntityType>>(new Set(TYPES));
  const [path, setPath] = useState("");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [detail, setDetail] = useState<RecordData | null>(null);
  const [wd, setWd] = useState<"off" | "loading" | "on" | "failed">("off");
  // "Restore the hidden link": one sourced edge is hidden until the reader restores it.
  const [restore, setRestore] = useState<{ edge: AtlasEdge; q: Activity; answered: boolean } | null>(null);

  useEffect(() => { const f = params.get("focus"); setFocus(f && nodes[f] ? f : (f ?? null)); }, [params, nodes]);
  // Opening an entity by its link counts as exploring it; the automatic first view does not.
  const explicit = params.get("focus");
  useEffect(() => { if (explicit && nodes[explicit] && !nodes[explicit].explored) exploreEntity(nodes[explicit]); }, [explicit]); // eslint-disable-line react-hooks/exhaustive-deps
  const current = focus && nodes[focus] ? focus : latest ?? null;
  const node = current ? nodes[current] : undefined;

  // A Wikidata entity's documented statements load with it, so its unexplored links show without a click.
  useEffect(() => {
    setMore(false); setDetail(null); setWd("off");
    if (!node || !isWikidata(node.id)) return;
    let live = true;
    setWd("loading");
    fetchRecord(node.id).then((r) => { if (live) { setDetail(r); setWd("on"); } }, () => live && setWd("failed"));
    return () => { live = false; };
  }, [current]); // eslint-disable-line react-hooks/exhaustive-deps

  const lessonTitle = (l: string) => p.lessons[l]?.title ?? l;
  const pathsInAtlas = useMemo(() => [...new Set(all.flatMap((n) => n.lessons.map((l) => p.lessons[l]?.pathId)).filter(Boolean))] as string[], [all, p.lessons]);
  const yFrom = from.trim() ? Number(from) : -Infinity, yTo = to.trim() ? Number(to) : Infinity;
  const visible = (n: { type: EntityType; year?: number; lessons?: string[] }) =>
    types.has(n.type) && (n.year === undefined || (n.year >= yFrom && n.year <= yTo)) && (!path || (n.lessons ?? []).some((l) => p.lessons[l]?.pathId === path));

  const neighbours: Neighbour[] = useMemo(() => {
    if (!node) return [];
    const out: Neighbour[] = [];
    const seen = new Set([node.id]);
    for (const e of edges) {
      const other = e.from === node.id ? e.to : e.to === node.id ? e.from : null;
      if (!other || seen.has(other) || !nodes[other] || !visible(nodes[other])) continue;
      seen.add(other);
      out.push({ id: other, node: nodes[other], label: nodes[other].label, type: nodes[other].type, edge: e });
    }
    out.sort((a, b) => a.id.localeCompare(b.id));
    // Documented Wikidata statements, taken in turn from each kind of link so one kind never fills the graph.
    if (wd === "on" && detail?.id === node.id) {
      const groups = new Map<string, typeof detail.links>();
      for (const l of detail.links) if (l.documented && !l.href && isWikidata(l.target) && !seen.has(l.target)) groups.set(l.group, [...(groups.get(l.group) ?? []), l]);
      const queues = [...groups.values()];
      for (let i = 0; out.length < MORE + 6 && queues.some((q) => q.length); i++) {
        const l = queues[i % queues.length].shift();
        if (!l || seen.has(l.target)) continue;
        const type: EntityType = nodes[l.target]?.type ?? (l.group === "people" ? (/member/.test(l.relation) ? "organization" : "person") : l.group === "places" ? (l.relation === "country" ? "country" : "place") : l.group === "ideas" ? "object" : "event");
        if (!types.has(type)) continue;
        seen.add(l.target);
        out.push({ id: l.target, node: nodes[l.target], label: nodes[l.target]?.label ?? l.label, type, preview: { relation: l.relation, url: statementUrl(l) ?? wikidataUrl(l.target), group: l.group } });
      }
    }
    return out;
  }, [node, edges, nodes, wd, detail, types, path, from, to]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = useMemo(() => neighbours.slice(0, more ? MORE : FIRST), [neighbours, more]);
  // Shared a lesson: listed beside the graph, never drawn as a link.
  const lessonMates = useMemo(() => (node ? all.filter((n) => n.id !== node.id && !neighbours.some((x) => x.id === n.id) && visible(n) && n.lessons.some((l) => node.lessons.includes(l))).sort((a, b) => a.label.localeCompare(b.label)) : []), [node, all, neighbours]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (id: string) => {
    if (current) setHistory((h) => [...h, current].slice(-30));
    setFocus(id);
    const n = nodes[id];
    if (n) exploreEntity(n);
    const u = new URLSearchParams(params.toString());
    u.set("focus", id);
    router.replace(`/my-atlas?${u}`, { scroll: false });
  };
  const goPreview = (nb: Neighbour) => { if (!nodes[nb.id]) exploreEntity({ id: nb.id, label: nb.label, type: nb.type, qid: nb.id, source: { label: `Wikidata ${nb.id}`, url: wikidataUrl(nb.id) } }); go(nb.id); };
  const open = (nb: Neighbour) => (nb.preview ? goPreview(nb) : go(nb.id));
  const hiddenEdge = (nb: Neighbour) => !!restore && !restore.answered && !!nb.edge && nb.edge.from === restore.edge.from && nb.edge.to === restore.edge.to && nb.edge.label === restore.edge.label;
  const hiddenNode = (nb: Neighbour) => hiddenEdge(nb) && restore!.q.kind === "choice" && restore!.q.answer === nb.id;
  const startRestore = () => {
    const mine = edges.filter((e) => e.from === current || e.to === current);
    const pool = [...mine.sort(() => Math.random() - 0.5), ...edges.filter((e) => !mine.includes(e)).sort(() => Math.random() - 0.5)];
    for (const e of pool) {
      const q = restoreLinkQuestion(e, nodes, p.atlas?.edges ?? {});
      if (!q) continue;
      if (e.from !== current && e.to !== current) go(e.from);
      setMore(true);
      setRestore({ edge: e, q, answered: false });
      return;
    }
  };

  // "Explore next": unexplored entities one documented link away from something already explored.
  const suggestions = useMemo(() => {
    const out: { id: string; why: string }[] = [];
    for (const e of edges) {
      for (const [a, b] of [[e.from, e.to], [e.to, e.from]] as const) {
        const known = nodes[a], next = nodes[b];
        if (known?.explored && next && !next.explored && !out.some((x) => x.id === b)) out.push({ id: b, why: `${TYPE_LABEL[next.type]} linked to ${known.label} (${e.label}), which you explored ${ago(known.explored)}.` });
      }
    }
    return out.slice(0, 4);
  }, [edges, nodes]);

  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(800);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(320, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = 540, cx = W / 2, cy = H / 2;

  // Where each neighbour goes, by meaning: people and groups above, places below, earlier events left, later right.
  const placed: Placed[] = useMemo(() => {
    if (!node) return [];
    const fy = node.year;
    const zoneOf = (nb: Neighbour): Zone | null => {
      if (nb.type === "person" || nb.type === "organization") return "top";
      if (nb.type === "place" || nb.type === "country") return "bottom";
      const outward = nb.edge ? nb.edge.from === node.id : true;
      const rel = nb.edge?.label ?? nb.preview?.relation ?? "";
      if (EARLIER.has(rel)) return outward ? "left" : "right";
      if (LATER.has(rel)) return outward ? "right" : "left";
      const y = nb.node?.year;
      if (y !== undefined && fy !== undefined && y !== fy) return y < fy ? "left" : "right";
      return null;
    };
    const across = Math.max(1, Math.floor((W - 24) / (PW + 14)));
    const cap: Record<Zone, number> = { top: across, bottom: across, left: 3, right: 3 };
    const zones: Record<Zone, Neighbour[]> = { top: [], bottom: [], left: [], right: [] };
    const fallback: Record<Zone, Zone[]> = { top: ["left", "right", "bottom"], bottom: ["left", "right", "top"], left: ["top", "bottom", "right"], right: ["top", "bottom", "left"] };
    const roomiest = (zs: Zone[]) => zs.filter((z) => zones[z].length < cap[z]).sort((a, b) => zones[a].length / cap[a] - zones[b].length / cap[b])[0];
    const later: Neighbour[] = [];
    for (const nb of shown) {
      const z = zoneOf(nb);
      if (!z) { later.push(nb); continue; }
      const to = zones[z].length < cap[z] ? z : roomiest(fallback[z]);
      if (to) zones[to].push(nb);
    }
    for (const nb of later) { const to = roomiest(["left", "right", "top", "bottom"]); if (to) zones[to].push(nb); }
    const out: Placed[] = [];
    const sx = PW / 2 + 12;
    (["top", "bottom"] as const).forEach((z) => {
      const list = zones[z], gap = Math.min(PW + 40, (W - 24) / Math.max(1, list.length));
      list.forEach((nb, i) => out.push({ id: nb.id, x: cx + (i - (list.length - 1) / 2) * gap, y: z === "top" ? 40 : H - 40, t: i % 2 ? 0.66 : 0.42 }));
    });
    (["left", "right"] as const).forEach((z) => {
      const list = [...zones[z]].sort((a, b) => (a.node?.year ?? 0) - (b.node?.year ?? 0));
      list.forEach((nb, i) => out.push({ id: nb.id, x: z === "left" ? sx : W - sx, y: cy + (i - (list.length - 1) / 2) * 118, t: -1 }));
    });
    return out;
  }, [shown, node, W]); // eslint-disable-line react-hooks/exhaustive-deps

  // Glide from the old layout to the new one: the chosen node moves to the centre, new ones grow out of it, old ones fade.
  const [frame, setFrame] = useState<Record<string, Pos>>({});
  const frameRef = useRef<Record<string, Pos>>({});
  const kept = useRef<Record<string, Neighbour>>({});
  for (const nb of shown) kept.current[nb.id] = nb;
  // Animate only when the layout itself changes, not on every re-render.
  const layoutKey = `${current}|${cx},${cy}|${placed.map((pl) => `${pl.id}@${Math.round(pl.x)},${Math.round(pl.y)}`).join(";")}`;
  useEffect(() => {
    if (!current) return;
    const target: Record<string, Pos> = { [current]: { x: cx, y: cy, o: 1 } };
    for (const pl of placed) target[pl.id] = { x: pl.x, y: pl.y, o: 1 };
    const start = frameRef.current;
    const origin = start[current] ?? { x: cx, y: cy, o: 1 };
    const ids = new Set([...Object.keys(start), ...Object.keys(target)]);
    const a: Record<string, Pos> = {}, b: Record<string, Pos> = {};
    for (const id of ids) {
      a[id] = start[id] ?? { x: origin.x, y: origin.y, o: 0 };
      b[id] = target[id] ?? { ...a[id], o: 0 };
    }
    const still = !Object.keys(start).length || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finish = () => { frameRef.current = target; setFrame(target); };
    if (still) { finish(); return; }
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const k = ease(Math.min(1, (now - t0) / MS));
      const f: Record<string, Pos> = {};
      for (const id of ids) f[id] = { x: a[id].x + (b[id].x - a[id].x) * k, y: a[id].y + (b[id].y - a[id].y) * k, o: a[id].o + (b[id].o - a[id].o) * k };
      frameRef.current = f;
      setFrame(f);
      if (k < 1) raf = requestAnimationFrame(step); else finish();
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [layoutKey]); // eslint-disable-line react-hooks/exhaustive-deps

  /** The point where the line from (x1,y1) towards (x2,y2) leaves a w×h box centred on (x1,y1). */
  const exit = (x1: number, y1: number, x2: number, y2: number, w: number, h: number) => {
    const dx = x2 - x1, dy = y2 - y1;
    const k = Math.min(dx ? w / 2 / Math.abs(dx) : Infinity, dy ? h / 2 / Math.abs(dy) : Infinity, 1);
    return [x1 + dx * k, y1 + dy * k] as const;
  };

  const counts = { encountered: all.filter((n) => n.encountered).length, explored: all.filter((n) => n.explored).length, saved: all.filter((n) => n.saved).length, practised: all.filter((n) => n.practised).length };
  const list = all.filter((n) => visible(n) && (!q.trim() || fold(n.label).includes(fold(q)))).sort((a, b) => a.label.localeCompare(b.label));

  if (!all.length) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center" data-testid="atlas-empty">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-bronze text-paper"><Icon name="network" size={34} /></span>
        <h1 className="mt-4 font-serif text-4xl">Your history atlas</h1>
        <p className="mt-2 text-ink-2">It grows as you learn: every finished lesson adds its people, places and events, and the sourced links between them.</p>
        <Link href={lessonHref("austria-rails", "austria")} className="btn btn-primary mt-6">Start with Austria: Empire to Republic</Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col" data-testid="my-atlas">
      <div className="grid flex-1 gap-0 lg:grid-cols-[280px_minmax(0,1fr)_360px]">
        {/* Left: search, filters, paths, suggestions, and the whole atlas as a list */}
        <aside className="border-b border-line p-4 lg:border-b-0 lg:border-r" aria-label="Filters">
          <h1 className="font-serif text-2xl">My history atlas</h1>
          <p className="mt-1 text-xs text-ink-2">{counts.encountered} encountered · {counts.explored} explored · {counts.saved} saved · {counts.practised} practised. Its size isn&rsquo;t a score.</p>
          <label className="mt-3 block"><span className="sr-only">Search my atlas</span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search my atlas" className="field !py-1.5 text-sm" /></label>
          <fieldset className="mt-3"><legend className="text-xs font-semibold uppercase tracking-wider text-ink-2">Types</legend>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {TYPES.filter((t) => all.some((n) => n.type === t)).map((t) => (
                <button key={t} type="button" aria-pressed={types.has(t)} onClick={() => setTypes((s) => { const n = new Set(s); if (n.has(t)) n.delete(t); else n.add(t); return n; })} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${types.has(t) ? "border-bronze bg-paper-2" : "border-line text-ink-2 line-through opacity-60"}`}>
                  <svg viewBox="-12 -12 24 24" className="h-3.5 w-3.5" aria-hidden><Shape type={t} r={8} className="fill-none stroke-current" /></svg>{TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          </fieldset>
          {pathsInAtlas.length > 0 && (
            <label className="mt-3 block text-xs font-semibold uppercase tracking-wider text-ink-2">Learning path
              <select value={path} onChange={(e) => setPath(e.target.value)} className="field mt-1 !py-1.5 text-sm normal-case tracking-normal">
                <option value="">All paths</option>
                {pathsInAtlas.map((id) => <option key={id} value={id}>{pathById(id)?.title ?? id}</option>)}
              </select>
            </label>
          )}
          {suggestions.length > 0 && (
            <section className="mt-4" aria-labelledby="next-title">
              <h2 id="next-title" className="text-xs font-semibold uppercase tracking-wider text-ink-2">Explore next</h2>
              <ul className="mt-1.5 grid gap-1.5">{suggestions.map((s) => <li key={s.id}><button type="button" onClick={() => go(s.id)} className="w-full rounded-md border border-dashed border-bronze/60 p-2 text-left text-sm hover:bg-paper-3"><span className="font-medium">{nodes[s.id].label}</span><span className="block text-xs text-ink-2">{s.why}</span></button></li>)}</ul>
            </section>
          )}
          <details className="mt-4" open={list.length < 30}>
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-ink-2">All {list.length} in the atlas, as a list</summary>
            <ul className="mt-1.5 max-h-72 overflow-y-auto" data-testid="atlas-list-alt">
              {list.map((n) => <li key={n.id}><button type="button" onClick={() => go(n.id)} aria-current={n.id === current ? "true" : undefined} className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-paper-3 ${n.id === current ? "bg-paper-3 font-semibold" : ""}`}><Icon name={TYPE_ICON[n.type]} size={14} className="shrink-0 text-bronze" /><span className="truncate">{n.label}</span>{n.saved && <span className="ml-auto text-bronze" aria-label="saved">★</span>}</button></li>)}
            </ul>
          </details>
        </aside>

        {/* Centre: the focused graph */}
        <section className="relative min-w-0 border-b border-line lg:border-b-0" aria-label="Connections of the selected entity">
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2">
            <button type="button" className="btn btn-ghost btn-sm" disabled={!history.length} onClick={() => { const prev = history[history.length - 1]; setHistory((h) => h.slice(0, -1)); setFocus(prev); }}><Icon name="back" size={15} />Back</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setHistory([]); setFocus(latest ?? null); setTypes(new Set(TYPES)); setPath(""); setFrom(""); setTo(""); }}><Icon name="reset" size={15} />Reset view</button>
            {edges.length > 0 && <button type="button" className="btn btn-secondary btn-sm" onClick={startRestore} disabled={!!restore && !restore.answered} data-testid="restore-start"><Icon name="idea" size={15} />Restore a hidden link</button>}
            {back && <Link href={back} className="btn btn-secondary btn-sm ml-auto" data-testid="back-to-lesson">← Back to the lesson</Link>}
          </div>
          <div ref={box} className="relative hidden overflow-hidden sm:block" style={{ height: H }} role="group" aria-label={node ? `${node.label} and ${shown.length} connections` : "Atlas"} data-testid="atlas-graph">
            <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${W} ${H}`} aria-hidden>
              <defs>
                {(["doc", "wd"] as const).map((k) => (
                  <marker key={k} id={`atlas-arrow-${k}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={k === "doc" ? "var(--bronze)" : "var(--ink-2)"} /></marker>
                ))}
              </defs>
              {node && frame[current!] && shown.map((nb) => {
                const f = frame[current!], p = frame[nb.id];
                if (!p) return null;
                const [ax, ay] = exit(f.x, f.y, p.x, p.y, FW + 10, FH + 10);
                const [bx, by] = exit(p.x, p.y, f.x, f.y, PW + 10, PH + 10);
                const doc = !!nb.edge, inward = nb.edge?.to === current;
                return <line key={nb.id} x1={ax} y1={ay} x2={bx} y2={by} opacity={p.o} stroke={doc ? "var(--bronze)" : "var(--ink-2)"} strokeOpacity={doc ? 0.85 : 0.55} strokeWidth={doc ? 2 : 1.4} strokeDasharray={doc ? undefined : "2 4"} strokeLinecap="round" markerEnd={inward ? undefined : `url(#atlas-arrow-${doc ? "doc" : "wd"})`} markerStart={inward ? `url(#atlas-arrow-${doc ? "doc" : "wd"})` : undefined} />;
              })}
            </svg>
            {/* Relation labels sit on their line, nearer the neighbour, so labels in one row stay apart */}
            {node && frame[current!] && shown.map((nb) => {
              const f = frame[current!], p = frame[nb.id], pl = placed.find((x) => x.id === nb.id);
              if (!p || !pl) return null;
              const [ax, ay] = exit(f.x, f.y, p.x, p.y, FW + 10, FH + 10);
              const [bx, by] = exit(p.x, p.y, f.x, f.y, PW + 10, PH + 10);
              const text = hiddenEdge(nb) ? "?" : nb.edge?.label ?? nb.preview?.relation ?? "";
              return <span key={`l-${nb.id}`} className={`pointer-events-none absolute left-0 top-0 max-w-[9.5rem] truncate whitespace-nowrap rounded-full border px-2 py-px text-[11px] ${nb.edge ? "border-bronze/50 bg-paper text-ink" : "border-line bg-paper text-ink-2"}`} style={{ transform: pl.t < 0 ? `translate(${p.x}px, ${p.y - PH / 2 - 11}px) translate(-50%, -50%)` : `translate(${ax + (bx - ax) * pl.t}px, ${ay + (by - ay) * pl.t}px) translate(-50%, -50%)`, opacity: p.o }} title={text}>{text}</span>;
            })}
            {/* Neighbours as pills; ones leaving fade where they stand */}
            {Object.entries(frame).filter(([id]) => id !== current && kept.current[id]).map(([id, p]) => {
              const nb = kept.current[id];
              const live = shown.some((x) => x.id === id);
              const unexplored = !!nb.preview && !nb.node;
              const sub = unexplored ? "Wikidata · not explored yet" : [TYPE_LABEL[nb.type], nb.node?.dates ?? (nb.node?.year !== undefined ? String(nb.node.year) : "")].filter(Boolean).join(" · ");
              return (
                <button key={id} type="button" tabIndex={live ? 0 : -1} disabled={!live} onClick={() => open(nb)} data-atlas-node={live ? id : undefined} data-preview={live ? unexplored : undefined}
                  aria-label={hiddenNode(nb) ? "Hidden entity" : `${nb.label}, ${TYPE_LABEL[nb.type]}${unexplored ? ", not explored yet" : ""}`} title={hiddenNode(nb) ? "Hidden until you restore the link" : nb.label}
                  className={`absolute left-0 top-0 flex items-center gap-2 rounded-xl border bg-paper-2 px-2 text-left shadow-sm transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-oxblood ${unexplored ? "border-dashed border-ink-2/50" : "border-bronze/70"}`}
                  style={{ width: PW, height: PH, transform: `translate(${p.x - PW / 2}px, ${p.y - PH / 2}px)`, opacity: p.o, pointerEvents: live ? undefined : "none" }}>
                  <TypeBadge type={nb.type} dim={unexplored} />
                  <span className="min-w-0 flex-1 leading-tight"><span className="block truncate text-[13px] font-semibold">{hiddenNode(nb) ? "?" : nb.label}</span><span className="block truncate text-[11px] text-ink-2">{sub}</span></span>
                </button>
              );
            })}
            {node && (() => {
              const f = frame[current!] ?? { x: cx, y: cy, o: 1 };
              return (
                <div data-atlas-focus={node.id} className="absolute left-0 top-0 flex items-center gap-3 rounded-2xl border-2 border-bronze bg-bronze-soft px-3 shadow-md" style={{ width: FW, height: FH, transform: `translate(${f.x - FW / 2}px, ${f.y - FH / 2}px)` }}>
                  <TypeBadge type={node.type} size={40} solid />
                  <span className="min-w-0 flex-1"><span className="line-clamp-2 font-serif text-[15px] font-semibold leading-tight" title={node.label}>{node.label}</span><span className="mt-0.5 block truncate text-[11px] text-ink-2">{[TYPE_LABEL[node.type], node.dates ?? detail?.when.text].filter(Boolean).join(" · ")}</span></span>
                </div>
              );
            })()}
            {node && !shown.length && wd !== "loading" && <p className="absolute inset-x-6 bottom-6 text-center text-sm text-ink-2" data-testid="atlas-no-links">No sourced links are stored for {node.label} yet{wd === "failed" ? ", and Wikidata could not be reached" : ""}. Sharing a lesson is not a historical link, so those are listed on the right instead.</p>}
          </div>
          {restore && (
            <div className="border-t border-line p-4" data-testid="restore-link">
              <ActivityView
                key={`${restore.edge.from}|${restore.edge.label}|${restore.edge.to}`}
                activity={restore.q}
                seed={restore.edge.label.length * 7 + 3}
                onAnswer={(r) => { setRestore((x) => (x ? { ...x, answered: true } : x)); logAnswer("my-atlas", restore.q.skill, r.ok, { prompt: restore.q.prompt, correct: r.correct, activity: restore.q }); }}
                onNext={() => setRestore(null)}
                nextLabel="Done"
              />
            </div>
          )}
          {/* Phones: the entity, then its connections as cards */}
          <ul className="grid gap-2 p-4 sm:hidden">
            {shown.map((nb) => <li key={nb.id}><button type="button" onClick={() => open(nb)} className={`card flex w-full items-center gap-3 p-3 text-left ${nb.preview && !nb.node ? "border-dashed" : ""}`}><TypeBadge type={nb.type} dim={!!nb.preview && !nb.node} /><span className="min-w-0 flex-1"><span className="block truncate font-medium">{nb.label}</span><span className="text-xs text-ink-2">{nb.edge ? nb.edge.label : `${nb.preview?.relation} · documented on Wikidata${nb.node ? "" : ", not explored yet"}`}</span></span></button></li>)}
          </ul>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pb-3 text-xs text-ink-2" data-testid="atlas-legend">
            <span className="inline-flex items-center gap-1"><svg width="26" height="8" aria-hidden><line x1="1" y1="4" x2="20" y2="4" stroke="var(--bronze)" strokeWidth="2" /><path d="M19,0 L25,4 L19,8 z" fill="var(--bronze)" /></svg>sourced, in your atlas</span>
            <span className="inline-flex items-center gap-1"><svg width="26" height="8" aria-hidden><line x1="1" y1="4" x2="20" y2="4" stroke="var(--ink-2)" strokeWidth="1.4" strokeDasharray="2 4" strokeLinecap="round" /><path d="M19,0 L25,4 L19,8 z" fill="var(--ink-2)" /></svg>documented on Wikidata</span>
            <span>People above · places below · earlier left · later right</span>
            {wd === "loading" && <span className="text-bronze">Reading Wikidata statements…</span>}
            {wd === "failed" && <span>Wikidata unreachable: showing your sourced links only.</span>}
            <span className="ml-auto flex gap-2">
              {neighbours.length > FIRST && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMore(!more)}>{more ? "Show fewer" : `Show ${Math.min(neighbours.length, MORE) - FIRST} more`}</button>}
            </span>
          </div>
        </section>

        {/* Right: details and sources */}
        <aside className="p-4 lg:border-l lg:border-line" aria-label="Details" data-testid="atlas-details">
          {node ? (
            <>
              <p className="text-xs font-semibold uppercase tracking-wider text-bronze">{TYPE_LABEL[node.type]}{node.dates ? ` · ${node.dates}` : detail?.when.text ? ` · ${detail.when.text}` : ""}</p>
              <h2 className="font-serif text-2xl leading-tight">{node.label}</h2>
              {detail?.image && <figure className="mt-3">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={detail.image.url} alt="" className="max-h-44 w-full rounded-lg object-cover" /><figcaption className="mt-1 truncate text-[11px] text-ink-2">{[detail.image.artist, detail.image.license].filter(Boolean).join(" · ")} · <a className="link" href={detail.image.page} target="_blank" rel="noopener noreferrer">source</a></figcaption></figure>}
              <p className="mt-3 text-sm leading-relaxed">{node.description ?? detail?.description ?? "No description is recorded."}</p>
              <p className="mt-1 text-xs text-ink-2">Source: {node.source?.url ? <a className="link" href={node.source.url} target="_blank" rel="noopener noreferrer">{node.source.label} ↗</a> : "TIMEWISE checked collection"}</p>
              <ul className="mt-3 grid grid-cols-2 gap-1 text-xs" data-testid="atlas-states">
                {(Object.keys(STATE_LABEL) as (keyof typeof STATE_LABEL)[]).map((k) => <li key={k} className={`rounded-md border px-2 py-1 ${node[k] ? "border-bronze bg-bronze-soft/40" : "border-dashed border-line text-ink-2"}`}>{STATE_LABEL[k]}{node[k] ? ` · ${ago(node[k])}` : ": not yet"}</li>)}
              </ul>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className="btn btn-primary btn-sm" aria-pressed={!!node.saved} onClick={() => toggleSaveEntity(node)}>{node.saved ? "Saved ✓" : "Save"}</button>
                {isWikidata(node.id) && <Link href={`/connections?id=${node.id}`} className="btn btn-secondary btn-sm">Explore connections</Link>}
              </div>
              <h3 className="mt-5 text-sm font-semibold">Sourced relationships</h3>
              <ul className="mt-1.5 grid gap-1.5">
                {edges.filter((e) => e.from === node.id || e.to === node.id).map((e) => (
                  <li key={`${e.from}${e.label}${e.to}`} className="rounded-md border border-line bg-paper-2 p-2 text-sm">
                    <span className="font-medium">{nodes[e.from]?.label ?? e.from}</span> <span className="text-bronze">{e.label}</span> <span className="font-medium">{nodes[e.to]?.label ?? e.to}</span>{e.date && <span className="text-ink-2"> · {e.date}</span>}
                    <span className="block text-xs text-ink-2">{e.source.url ? <a className="link" href={e.source.url} target="_blank" rel="noopener noreferrer">{e.source.label} ↗</a> : e.source.label}</span>
                  </li>
                ))}
                {!edges.some((e) => e.from === node.id || e.to === node.id) && <li className="text-sm text-ink-2">None stored yet. Nothing is inferred from sharing a lesson.</li>}
              </ul>
              {node.lessons.length > 0 && (
                <>
                  <h3 className="mt-5 text-sm font-semibold">In your lessons</h3>
                  <ul className="mt-1 grid gap-1 text-sm">{node.lessons.map((l) => <li key={l}><Link className="link" href={lessonHref(l, p.lessons[l]?.pathId ?? "")}>{lessonTitle(l)} →</Link></li>)}</ul>
                </>
              )}
              {lessonMates.length > 0 && (
                <details className="mt-4" data-testid="lesson-mates">
                  <summary className="cursor-pointer text-sm font-semibold">Met in the same lessons ({lessonMates.length})</summary>
                  <p className="mt-1 text-xs text-ink-2">Sharing a lesson is not a historical link, so these are not drawn in the graph.</p>
                  <ul className="mt-1.5 flex flex-wrap gap-1.5">{lessonMates.slice(0, 12).map((n) => <li key={n.id}><button type="button" onClick={() => go(n.id)} className="chip !min-h-7 !text-xs"><Icon name={TYPE_ICON[n.type]} size={13} className="text-bronze" />{n.label}</button></li>)}</ul>
                </details>
              )}
            </>
          ) : <p className="text-ink-2">Choose an entity.</p>}
        </aside>
      </div>

      {/* Bottom: a compact time filter */}
      <div className="flex flex-wrap items-center gap-2 border-t border-line bg-paper-2 px-4 py-2 text-sm" data-testid="atlas-time">
        <Icon name="timeline" size={16} className="text-bronze" />
        <span className="text-ink-2">Years</span>
        <label className="sr-only" htmlFor="at-from">From</label><input id="at-from" inputMode="numeric" value={from} onChange={(e) => setFrom(e.target.value.replace(/[^\d-]/g, ""))} placeholder="From" className="field !w-20 !py-1 text-sm" />
        <span aria-hidden>–</span>
        <label className="sr-only" htmlFor="at-to">To</label><input id="at-to" inputMode="numeric" value={to} onChange={(e) => setTo(e.target.value.replace(/[^\d-]/g, ""))} placeholder="To" className="field !w-20 !py-1 text-sm" />
        {[["1800s", 1800, 1899], ["1900s", 1900, 1999]].map(([l, a, b]) => <button key={l as string} type="button" className="chip !min-h-7 !text-xs" onClick={() => { setFrom(String(a)); setTo(String(b)); }}>{l}</button>)}
        {(from || to) && <button type="button" className="link text-xs" onClick={() => { setFrom(""); setTo(""); }}>Clear</button>}
        <span className="ml-auto text-xs text-ink-2">Undated entities always show. Today&rsquo;s borders only sort places.</span>
      </div>
    </div>
  );
}
