"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { fold } from "@/lib/dedupe";
import { isWikidata, TYPE_LABEL, wikidataUrl, type EntityType } from "@/lib/entities";
import { lessonHref, pathById } from "@/lib/lessons";
import { exploreEntity, toggleSaveEntity, useProgress, type AtlasEdge, type AtlasNode } from "@/lib/progress";
import { fetchRecord, statementUrl, type RecordData } from "@/lib/record";
import { Icon, iconPath, type IconName } from "../icons";
import { TYPE_ICON } from "./EntityPanel";

const FIRST = 6, MORE = 12;
// Fixed ring slots, filled in an order that spreads the first six evenly. A node keeps its slot when more are shown.
const SLOT_ORDER = [0, 6, 3, 9, 1, 7, 4, 10, 2, 8, 5, 11];
const TYPES: EntityType[] = ["event", "person", "place", "country", "organization", "object"];
const STATE_LABEL = { encountered: "Encountered", explored: "Explored", saved: "Saved", practised: "Practised" } as const;

type Neighbour = { id: string; node?: AtlasNode; label: string; type: EntityType; edge?: AtlasEdge; lesson?: string; preview?: { relation: string; url: string } };

/** A distinct outline for each kind of entity, so type never depends on colour or icon alone. */
function Shape({ type, r, className }: { type: EntityType; r: number; className?: string }) {
  if (type === "person") return <rect x={-r} y={-r} width={2 * r} height={2 * r} rx={r * 0.45} className={className} />;
  if (type === "place") return <polygon points={`0,${-r * 1.2} ${r * 1.2},0 0,${r * 1.2} ${-r * 1.2},0`} className={className} />;
  if (type === "country") return <polygon points={[0, 1, 2, 3, 4, 5].map((i) => `${Math.cos((Math.PI / 3) * i) * r * 1.1},${Math.sin((Math.PI / 3) * i) * r * 1.1}`).join(" ")} className={className} />;
  if (type === "object") return <rect x={-r} y={-r} width={2 * r} height={2 * r} className={className} />;
  if (type === "organization") return <polygon points={`0,${-r * 1.2} ${r * 1.15},${r * 0.8} ${-r * 1.15},${r * 0.8}`} className={className} />;
  return <circle r={r} className={className} />;
}
const short = (s: string, n = 22) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const ago = (iso?: string) => { if (!iso) return ""; const d = Math.round((Date.now() - Date.parse(iso)) / 86400000); return d <= 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`; };

export function MyAtlas() {
  const p = useProgress();
  const router = useRouter();
  const params = useSearchParams();
  const back = params.get("back");
  const nodes = useMemo(() => p.atlas?.nodes ?? {}, [p.atlas]);
  const edges = useMemo(() => Object.values(p.atlas?.edges ?? {}), [p.atlas]);
  const all = useMemo(() => Object.values(nodes), [nodes]);
  const latest = useMemo(() => [...all].sort((a, b) => (b.explored ?? b.encountered ?? "").localeCompare(a.explored ?? a.encountered ?? ""))[0]?.id, [all]);
  const [focus, setFocus] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [more, setMore] = useState(false);
  const [types, setTypes] = useState<Set<EntityType>>(new Set(TYPES));
  const [path, setPath] = useState("");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [preview, setPreview] = useState<RecordData | null>(null);
  const [previewState, setPreviewState] = useState<"off" | "loading" | "on" | "failed">("off");
  const [detail, setDetail] = useState<RecordData | null>(null);

  useEffect(() => { const f = params.get("focus"); setFocus(f && nodes[f] ? f : (f ?? null)); }, [params, nodes]);
  // Opening an entity by its link counts as exploring it; the automatic first view does not.
  const explicit = params.get("focus");
  useEffect(() => { if (explicit && nodes[explicit] && !nodes[explicit].explored) exploreEntity(nodes[explicit]); }, [explicit]); // eslint-disable-line react-hooks/exhaustive-deps
  const current = focus && nodes[focus] ? focus : latest ?? null;
  const node = current ? nodes[current] : undefined;

  useEffect(() => { setPreview(null); setPreviewState("off"); setMore(false); setDetail(null); if (node && isWikidata(node.id)) fetchRecord(node.id).then(setDetail, () => {}); }, [current]); // eslint-disable-line react-hooks/exhaustive-deps

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
    // Learning connections: shared a lesson, which is not a historical relationship.
    const lessonMates = all.filter((n) => !seen.has(n.id) && visible(n) && n.lessons.some((l) => node.lessons.includes(l))).sort((a, b) => a.id.localeCompare(b.id));
    for (const n of lessonMates) out.push({ id: n.id, node: n, label: n.label, type: n.type, lesson: n.lessons.find((l) => node.lessons.includes(l)) });
    if (previewState === "on" && preview) {
      for (const l of preview.links.filter((l) => l.documented && !nodes[l.target]).slice(0, MORE)) out.push({ id: l.target, label: l.label, type: l.group === "people" ? "person" : l.group === "places" ? "place" : "event", preview: { relation: l.relation, url: statementUrl(l) ?? wikidataUrl(l.target) } });
    }
    return out;
  }, [node, edges, nodes, all, previewState, preview, types, path, from, to]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = neighbours.slice(0, more ? MORE : FIRST);

  const go = (id: string) => {
    if (current) setHistory((h) => [...h, current].slice(-30));
    setFocus(id);
    const n = nodes[id];
    if (n) exploreEntity(n);
    const u = new URLSearchParams(params.toString());
    u.set("focus", id);
    router.replace(`/my-atlas?${u}`, { scroll: false });
  };
  const goPreview = (nb: Neighbour) => { exploreEntity({ id: nb.id, label: nb.label, type: nb.type, qid: nb.id, source: { label: `Wikidata ${nb.id}`, url: wikidataUrl(nb.id) } }); go(nb.id); };
  const loadPreview = () => {
    if (!node || !isWikidata(node.id)) return;
    setPreviewState("loading");
    fetchRecord(node.id).then((r) => { setPreview(r); setPreviewState("on"); setMore(true); }, () => setPreviewState("failed"));
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
  const H = 520, cx = W / 2, cy = H / 2, R = Math.min(W / 2 - 110, H / 2 - 70);
  const pos = (i: number) => { const a = (SLOT_ORDER[i] / 12) * Math.PI * 2 - Math.PI / 2; return [cx + Math.cos(a) * R, cy + Math.sin(a) * R] as const; };

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
            {back && <Link href={back} className="btn btn-secondary btn-sm ml-auto" data-testid="back-to-lesson">← Back to the lesson</Link>}
          </div>
          <div ref={box} className="hidden sm:block">
            <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="group" aria-label={node ? `${node.label} and ${shown.length} connections` : "Atlas"} data-testid="atlas-graph">
              {shown.map((nb, i) => {
                const [x, y] = pos(i);
                const doc = !!nb.edge, prev = !!nb.preview;
                // Labels sit at alternating distances along their line, so neighbouring edges never stack them.
                const t = i % 2 ? 0.62 : 0.4;
                const mx = cx + (x - cx) * t, my = cy + (y - cy) * t;
                const text = nb.edge ? (nb.edge.from === current ? nb.edge.label : `← ${nb.edge.label}`) : nb.preview ? nb.preview.relation : "same lesson";
                return (
                  <g key={`e-${nb.id}`}>
                    <line x1={cx} y1={cy} x2={x} y2={y} stroke={doc ? "var(--bronze)" : "var(--ink-2)"} strokeOpacity={doc ? 0.8 : 0.45} strokeWidth={doc ? 2 : 1.3} strokeDasharray={doc ? undefined : prev ? "2 4" : "6 5"} />
                    <text x={mx} y={my} textAnchor="middle" className={`text-[11px] ${doc ? "fill-ink" : "fill-ink-2"}`} paintOrder="stroke" stroke="var(--paper)" strokeWidth={4} strokeLinejoin="round">{short(text, 26)}</text>
                  </g>
                );
              })}
              {shown.map((nb, i) => {
                const [x, y] = pos(i);
                return (
                  <g key={nb.id} transform={`translate(${x},${y})`} role="button" tabIndex={0} aria-label={`${nb.label}, ${TYPE_LABEL[nb.type]}${nb.preview ? ", not explored yet" : ""}`} onClick={() => (nb.preview ? goPreview(nb) : go(nb.id))} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), nb.preview ? goPreview(nb) : go(nb.id))} className="cursor-pointer outline-none [&:focus-visible_.shape]:stroke-[var(--oxblood)]" data-atlas-node={nb.id} data-preview={!!nb.preview}>
                    <Shape type={nb.type} r={20} className={`shape ${nb.preview ? "fill-paper-2 stroke-ink-2 [stroke-dasharray:3_3]" : "fill-paper-2 stroke-bronze"} stroke-2`} />
                    <g transform="translate(-10,-10)" className={nb.preview ? "text-ink-2" : "text-bronze"}><path d={iconPath(TYPE_ICON[nb.type])} transform="scale(0.83)" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></g>
                    <text y={38} textAnchor="middle" className={`text-[12px] ${nb.preview ? "fill-ink-2" : "fill-ink"}`} paintOrder="stroke" stroke="var(--paper)" strokeWidth={4} strokeLinejoin="round">{short(nb.label)}</text>
                    <title>{nb.label}</title>
                  </g>
                );
              })}
              {node && (
                <g transform={`translate(${cx},${cy})`} data-atlas-focus={node.id}>
                  <Shape type={node.type} r={34} className="fill-bronze stroke-paper stroke-[3]" />
                  <g transform="translate(-14,-14)" className="text-paper"><path d={iconPath(TYPE_ICON[node.type])} transform="scale(1.17)" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></g>
                  <text y={58} textAnchor="middle" className="fill-ink font-serif text-[16px] font-semibold" paintOrder="stroke" stroke="var(--paper)" strokeWidth={5} strokeLinejoin="round">{short(node.label, 30)}</text>
                </g>
              )}
            </svg>
          </div>
          {/* Phones: the entity, then its connections as cards */}
          <ul className="grid gap-2 p-4 sm:hidden">
            {shown.map((nb) => <li key={nb.id}><button type="button" onClick={() => (nb.preview ? goPreview(nb) : go(nb.id))} className={`card flex w-full items-center gap-3 p-3 text-left ${nb.preview ? "border-dashed" : ""}`}><Icon name={TYPE_ICON[nb.type]} size={18} className="text-bronze" /><span className="min-w-0 flex-1"><span className="block truncate font-medium">{nb.label}</span><span className="text-xs text-ink-2">{nb.edge ? nb.edge.label : nb.preview ? `${nb.preview.relation} · not explored yet` : "same lesson (not a historical link)"}</span></span></button></li>)}
          </ul>
          <div className="flex flex-wrap items-center gap-2 px-4 pb-3 text-xs text-ink-2">
            <span className="inline-flex items-center gap-1"><span className="w-5 border-t-2 border-bronze" />sourced relationship</span>
            <span className="inline-flex items-center gap-1"><span className="w-5 border-t-2 border-dashed border-ink-2/60" />appeared in the same lesson (not a historical link)</span>
            <span className="inline-flex items-center gap-1"><span className="w-5 border-t-2 border-dotted border-ink-2/60" />not explored yet</span>
            <span className="ml-auto flex gap-2">
              {neighbours.length > FIRST && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMore(!more)}>{more ? "Show fewer" : `Show ${Math.min(neighbours.length, MORE) - FIRST} more`}</button>}
              {node && isWikidata(node.id) && previewState !== "on" && <button type="button" className="btn btn-secondary btn-sm" onClick={loadPreview} disabled={previewState === "loading"}>{previewState === "loading" ? "Reading Wikidata…" : previewState === "failed" ? "Wikidata unreachable" : "Preview unexplored links"}</button>}
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
