"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { accuracy, badges, streaks } from "@/lib/achievements";
import { CATEGORY_LABELS } from "@/lib/categories";
import { lessonHref, PATHS, PLACE_PATHS, SKILLS, type Skill } from "@/lib/lessons";
import { dueReviews, exportProgress, importProgress, resetProgress, setInterests, setProfile, useProgress, type Progress } from "@/lib/progress";
import { TYPE_LABEL, type EntityType } from "@/lib/entities";
import { CONTINENT_LABELS } from "@/lib/world-index";
import { Icon } from "../icons";
import { ExplorerPanel } from "../modes/Gamify";
import { resetExplorer } from "@/lib/explorer";
import { nextStep } from "../lessons/LearnHome";
import { loadCountries, type Feature } from "../network/views";

const THEMES = ["war", "politics", "state", "culture", "health", "disaster"];

/** What a shared link carries: a summary only, readable by anyone with the link. Nothing is uploaded. */
type Shared = { n?: string; l: number; p: number; a: [number, number]; b: string[]; c: string[]; i: string[] };
const encode = (s: Shared) => btoa(unescape(encodeURIComponent(JSON.stringify(s)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const decode = (t: string): Shared | null => { try { return JSON.parse(decodeURIComponent(escape(atob(t.replace(/-/g, "+").replace(/_/g, "/"))))); } catch { return null; } };

function countryState(p: Progress) {
  const state: Record<string, "done" | "started" | "open"> = {};
  for (const id of Object.keys(PLACE_PATHS)) {
    const path = PATHS.find((x) => x.id === `place-${id}`)!;
    const done = path.lessons.filter((l) => p.lessons[l.id]?.finished).length;
    state[id] = done === path.lessons.length ? "done" : done || path.lessons.some((l) => p.lessons[l.id]) ? "started" : "open";
  }
  return state;
}

/** Today's world, coloured by learning: finished paths, started ones, ones waiting, and countries without enough records yet. */
function LearningMap({ state, onPick }: { state: Record<string, "done" | "started" | "open">; onPick?: (id: string) => void }) {
  const [shapes, setShapes] = useState<(Feature & { properties?: { id: string; name: string } })[] | null>(null);
  useEffect(() => { loadCountries().then((f) => setShapes(f as never), () => setShapes([])); }, []);
  const W = 1000, H = 500;
  const ring = (r: number[][]) => r.map((pt, i) => `${i ? "L" : "M"}${(((pt[0] + 180) / 360) * W).toFixed(1)},${(((84 - pt[1]) / 144) * H).toFixed(1)}`).join("") + "Z";
  const fill = (id?: string) => (!id || !(id in state) ? "url(#none)" : state[id] === "done" ? "var(--navy)" : state[id] === "started" ? "var(--bronze)" : "var(--paper-3)");
  return (
    <figure data-testid="learning-map">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full rounded-xl border border-line bg-paper-2" role="group" aria-label="Your learning map: countries with a learning path, coloured by your progress">
        <defs><pattern id="none" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="var(--paper-2)" /><line x1="0" y1="0" x2="0" y2="6" stroke="var(--line)" strokeWidth="2" /></pattern></defs>
        {(shapes ?? []).map((f, i) => {
          const id = (f as { properties?: { id: string; name: string } }).properties?.id;
          const name = (f as { properties?: { id: string; name: string } }).properties?.name ?? "";
          const d = f.geometry.type === "Polygon" ? (f.geometry.coordinates as number[][][]).map(ring).join("") : (f.geometry.coordinates as number[][][][]).flatMap((p) => p.map(ring)).join("");
          const has = id && id in state;
          return (
            <path key={i} d={d} fill={fill(id)} stroke="var(--line)" strokeWidth={0.6} className={has && onPick ? "cursor-pointer hover:opacity-80" : ""} onClick={() => has && onPick?.(id!)}>
              <title>{`${name}: ${!has ? "not enough records for a path yet" : state[id!] === "done" ? "path complete" : state[id!] === "started" ? "in progress" : "path available"}`}</title>
            </path>
          );
        })}
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-navy" />Complete</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-bronze" />In progress</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm border border-line bg-paper-3" />Path available</span>
        <span className="inline-flex items-center gap-1.5"><svg width="12" height="12"><rect width="12" height="12" fill="url(#none)" stroke="var(--line)" /></svg>Not enough records yet</span>
        <span>· Today&rsquo;s borders, used only to sort records</span>
      </figcaption>
    </figure>
  );
}

export function ProfileView() {
  const p = useProgress();
  const router = useRouter();
  const params = useSearchParams();
  const shared = useMemo(() => { const t = params.get("share"); return t ? decode(t) : null; }, [params]);
  const [copied, setCopied] = useState(false);
  const [name, setName] = useState("");
  const [imported, setImported] = useState("");
  useEffect(() => setName(p.profile?.name ?? ""), [p.profile?.name]);

  const state = useMemo(() => countryState(p), [p]);
  const pathsDone = PATHS.filter((x) => x.lessons.every((l) => p.lessons[l.id]?.finished));
  const lessonsDone = Object.values(p.lessons).filter((l) => l.finished).length;
  const acc = accuracy(p);
  const { current, best } = streaks(p.days);
  const earned = badges(p, pathsDone.length).filter((b) => b.earned);
  const step = nextStep(p);
  const interests = p.interests ?? [];
  const suggestions = PATHS.filter((x) => !pathsDone.includes(x) && (interests.some((i) => x.id.includes(`-${i}-`) || x.id.endsWith(`-${i}`) || x.id === `place-${i}`) || interests.some((i) => i in CONTINENT_LABELS && PLACE_PATHS[x.id.replace("place-", "")]?.continent === i))).slice(0, 6);
  const toggle = (i: string) => setInterests(interests.includes(i) ? interests.filter((x) => x !== i) : [...interests, i]);
  const shareable = p.profile?.shareable ?? false;

  if (shared) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10" data-testid="shared-profile">
        <p className="eyebrow">A shared learning profile</p>
        <h1 className="mt-2 font-serif text-4xl">{shared.n || "A TIMEWISE learner"}</h1>
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <li className="card p-4"><p className="font-serif text-3xl">{shared.l}</p><p className="text-sm text-ink-2">lessons</p></li>
          <li className="card p-4"><p className="font-serif text-3xl">{shared.p}</p><p className="text-sm text-ink-2">paths complete</p></li>
          <li className="card p-4"><p className="font-serif text-3xl">{shared.a[1] ? Math.round((shared.a[0] / shared.a[1]) * 100) : 0}%</p><p className="text-sm text-ink-2">answers right</p></li>
          <li className="card p-4"><p className="font-serif text-3xl">{shared.b.length}</p><p className="text-sm text-ink-2">badges</p></li>
        </ul>
        {shared.c.length > 0 && <p className="mt-6 text-ink-2">Countries explored: {shared.c.map((c) => PLACE_PATHS[c]?.label ?? c).join(", ")}.</p>}
        <p className="mt-6 text-xs text-ink-2">This page shows only what was in the link. Nothing is stored on a server.</p>
        <Link href="/learn" className="btn btn-primary mt-6">Start learning yourself</Link>
      </div>
    );
  }

  const shareLink = () => {
    const data: Shared = { n: name.trim() || undefined, l: lessonsDone, p: pathsDone.length, a: [acc.ok, acc.total], b: earned.map((b) => b.id), c: Object.keys(state).filter((k) => state[k] !== "open"), i: interests };
    const url = `${window.location.origin}${window.location.pathname}?share=${encode(data)}`;
    navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); }, () => window.prompt("Copy this link", url));
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6" data-testid="profile">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Your profile</p>
          <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => setProfile({ name: name.trim() || undefined, shareable })} placeholder="Add a name (optional)" aria-label="Your name" className="mt-1 w-full bg-transparent font-serif text-4xl outline-none placeholder:text-ink-2/50" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="radiogroup" aria-label="Who can see this profile" className="flex rounded-full border border-line bg-paper-2 p-0.5 text-sm">
            {[false, true].map((v) => <button key={String(v)} type="button" role="radio" aria-checked={shareable === v} onClick={() => setProfile({ name: name.trim() || undefined, shareable: v })} className={`rounded-full px-3 py-1 ${shareable === v ? "bg-navy text-on-accent [[data-theme=dark]_&]:bg-bronze" : "text-ink-2"}`}>{v ? "Shareable" : "Private"}</button>)}
          </div>
          {shareable && <button type="button" className="btn btn-secondary btn-sm" onClick={shareLink} data-testid="share-profile">{copied ? "Link copied" : "Copy share link"}</button>}
        </div>
      </div>
      <p className="mt-1 text-xs text-ink-2">{shareable ? "A share link carries a summary (lessons, paths, accuracy, badges, countries). Nothing is uploaded; your progress stays in this browser." : "Private: your progress stays in this browser, and no link can show it."}</p>

      <div className="card mt-6 flex flex-col gap-3 border-2 border-bronze/40 p-5 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-wider text-bronze">{step.resume ? "Continue where you stopped" : "Up next"}</p><p className="font-serif text-2xl">{step.title}</p></div>
        <Link href={lessonHref(step.id, step.pathId)} className="btn btn-primary">{step.resume ? "Continue" : "Start"}</Link>
      </div>

      <ul className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5" data-testid="profile-stats">
        <li className="card p-4"><p className="font-serif text-3xl tabular-nums">{lessonsDone}</p><p className="text-sm text-ink-2">lessons finished</p></li>
        <li className="card p-4"><p className="font-serif text-3xl tabular-nums">{pathsDone.length}</p><p className="text-sm text-ink-2">paths complete</p></li>
        <li className="card p-4"><p className="font-serif text-3xl tabular-nums">{acc.total ? `${Math.round((acc.ok / acc.total) * 100)}%` : "–"}</p><p className="text-sm text-ink-2">answers right{acc.total ? ` (${acc.ok}/${acc.total})` : ""}</p></li>
        <li className="card p-4"><p className="font-serif text-3xl tabular-nums">{current}</p><p className="text-sm text-ink-2">days in a row · best {best}</p></li>
        <li className="card p-4"><Link href="/collection" className="block"><p className="font-serif text-3xl tabular-nums">{Object.keys(p.bookmarks).length}</p><p className="text-sm text-ink-2">saved events →</p></Link></li>
      </ul>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <section className="card p-4" aria-labelledby="current-title">
          <h2 id="current-title" className="font-serif text-xl">Current paths</h2>
          <ul className="mt-2 grid gap-2">
            {PATHS.filter((x) => !pathsDone.includes(x) && x.lessons.some((l) => p.lessons[l.id])).slice(0, 5).map((x) => {
              const nextLesson = x.lessons.find((l) => !p.lessons[l.id]?.finished)!;
              return <li key={x.id} className="flex items-center gap-2 text-sm"><span className="min-w-0 flex-1 truncate">{x.title}</span><Link href={lessonHref(nextLesson.id, x.id)} className="btn btn-secondary btn-sm">Resume</Link></li>;
            })}
            {!PATHS.some((x) => !pathsDone.includes(x) && x.lessons.some((l) => p.lessons[l.id])) && <li className="text-sm text-ink-2">None started yet.</li>}
          </ul>
        </section>
        <section className="card p-4" aria-labelledby="atlas-title">
          <h2 id="atlas-title" className="font-serif text-xl">My history atlas</h2>
          {(() => {
            const nodes = Object.values(p.atlas?.nodes ?? {});
            const byType = nodes.reduce<Record<string, number>>((m, n) => ({ ...m, [n.type]: (m[n.type] ?? 0) + 1 }), {});
            return (
              <>
                <p className="mt-1 text-sm text-ink-2">{nodes.length ? Object.entries(byType).map(([t, n]) => `${n} ${TYPE_LABEL[t as EntityType].toLowerCase()}${n === 1 ? "" : "s"}`).join(", ") : "Empty so far: finish a lesson to start it."}</p>
                <p className="text-sm text-ink-2">{Object.keys(p.atlas?.edges ?? {}).length} sourced connections</p>
                <Link href="/my-atlas" className="btn btn-secondary btn-sm mt-3">Open my atlas</Link>
              </>
            );
          })()}
        </section>
        <section className="card p-4" aria-labelledby="review-title">
          <h2 id="review-title" className="font-serif text-xl">Review queue</h2>
          <p className="mt-1 text-sm text-ink-2">{dueReviews(p).length} due now · {p.mistakes.filter((m) => m.activity).length} scheduled in all{p.reviewLog?.total ? ` · ${Math.round((p.reviewLog.ok / p.reviewLog.total) * 100)}% right in review` : ""}</p>
          {dueReviews(p).length > 0 && <Link href="/learn/review" className="btn btn-primary btn-sm mt-3">Review now</Link>}
        </section>
      </div>

      <section className="mt-8" aria-labelledby="saved-title">
        <h2 id="saved-title" className="font-serif text-2xl">Saved</h2>
        {(() => {
          const saved = Object.values(p.atlas?.nodes ?? {}).filter((n) => n.saved);
          const types = [...new Set(saved.map((n) => n.type))];
          return (
            <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {types.map((t) => (
                <div key={t} className="card p-3"><p className="text-xs font-semibold uppercase tracking-wider text-ink-2">{TYPE_LABEL[t]}s</p><ul className="mt-1 grid gap-0.5 text-sm">{saved.filter((n) => n.type === t).map((n) => <li key={n.id}><Link className="link" href={`/my-atlas?focus=${encodeURIComponent(n.id)}`}>{n.label}</Link></li>)}</ul></div>
              ))}
              <div className="card p-3"><p className="text-xs font-semibold uppercase tracking-wider text-ink-2">Saved records and sources</p><p className="mt-1 text-sm"><Link href="/collection" className="link">{Object.keys(p.bookmarks).length} in Saved →</Link></p></div>
            </div>
          );
        })()}
      </section>

      <section className="mt-8" aria-labelledby="lessons-title">
        <h2 id="lessons-title" className="font-serif text-2xl">Completed lessons</h2>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {Object.entries(p.lessons).filter(([, l]) => l.finished).map(([id, l]) => <li key={id}><Link href={lessonHref(id, l.pathId)} className="chip !text-xs">✓ {l.title}{l.max ? ` · ${l.score}/${l.max}` : ""}</Link></li>)}
          {!Object.values(p.lessons).some((l) => l.finished) && <li className="text-sm text-ink-2">None yet.</li>}
        </ul>
      </section>

      <section className="mt-10" aria-labelledby="map-title">
        <h2 id="map-title" className="font-serif text-2xl">Your learning map</h2>
        <p className="mt-1 text-sm text-ink-2">{Object.keys(PLACE_PATHS).length} countries have a path. Choose one to open it.</p>
        <div className="mt-3"><LearningMap state={state} onPick={(id) => router.push(`/learn?path=place-${id}`)} /></div>
      </section>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="skills-title">
          <h2 id="skills-title" className="font-serif text-2xl">Accuracy by skill</h2>
          <ul className="mt-3 grid gap-2.5">
            {(Object.keys(SKILLS) as Skill[]).map((s) => {
              const log = p.skills.filter((x) => x.skill === s);
              const ok = log.filter((x) => x.ok).length;
              const pct = log.length ? Math.round((ok / log.length) * 100) : 0;
              return <li key={s}><div className="flex justify-between text-sm"><span>{SKILLS[s].label}</span><span className="tabular-nums text-ink-2">{log.length ? `${pct}% · ${ok}/${log.length}` : "not started"}</span></div><div className="mt-1 h-2 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-bronze" style={{ width: `${pct}%` }} /></div></li>;
            })}
          </ul>
        </section>
        <section aria-labelledby="interests-title">
          <h2 id="interests-title" className="font-serif text-2xl">Your interests</h2>
          <p className="mt-1 text-sm text-ink-2">Choose themes and continents; paths that match appear below.</p>
          <div className="mt-3 flex flex-wrap gap-1.5" data-testid="interests">
            {[...THEMES.map((t) => [t, CATEGORY_LABELS[t]] as const), ...Object.entries(CONTINENT_LABELS)].map(([id, label]) => (
              <button key={id} type="button" aria-pressed={interests.includes(id)} className="chip" onClick={() => toggle(id)}>{label}</button>
            ))}
          </div>
          {suggestions.length > 0 && (
            <ul className="mt-4 grid gap-2">
              {suggestions.map((x) => <li key={x.id}><Link href={`/learn?path=${x.id}`} className="card card-link flex items-center gap-3 p-3"><Icon name={x.icon} size={20} className="text-bronze" /><span className="flex-1 font-medium">{x.title}</span><span className="text-xs text-ink-2">{x.lessons.length} lessons</span></Link></li>)}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-10 rounded-xl border border-line p-4" aria-labelledby="data-title">
        <h2 id="data-title" className="font-serif text-xl">Your data</h2>
        <p className="mt-1 text-sm text-ink-2">Everything is stored in this browser only; there are no accounts or sync. To keep learning on another device, download your progress here and load the file there.</p>
        <div className="mt-3 flex flex-wrap gap-2" data-testid="progress-file">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => { const blob = new Blob([exportProgress()], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "timewise-progress.json"; a.click(); }}>Download my progress</button>
          <label className="btn btn-secondary btn-sm cursor-pointer">Load a progress file
            <input type="file" accept="application/json,.json" className="sr-only" data-testid="import-progress" onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              if (!window.confirm("Replace the progress in this browser with the file's? This can't be undone, so download the current progress first if you need it.")) return;
              try { importProgress(await f.text()); setImported("Progress loaded."); } catch { setImported("That file isn't a TIMEWISE progress file."); }
            }} />
          </label>
          <button type="button" className="btn btn-ghost btn-sm text-oxblood" onClick={() => { if (window.confirm("Delete all progress, saved items, notes and your atlas from this browser? This can't be undone.")) resetProgress(); resetExplorer(); }}>Delete all my progress</button>
        </div>
        {imported && <p className="mt-2 text-sm" role="status">{imported}</p>}
      </section>

      <section className="mt-10" aria-labelledby="explorer-title">
        <h2 id="explorer-title" className="font-serif text-2xl">Explorer level and badges</h2>
        <p className="mt-1 text-sm text-ink-2">Earned by following lives and things, visiting years and opening stories.</p>
        <div className="mt-3"><ExplorerPanel /></div>
      </section>

      <section className="mt-10" aria-labelledby="done-title">
        <h2 id="done-title" className="font-serif text-2xl">Completed paths and badges</h2>
        {pathsDone.length ? <ul className="mt-2 flex flex-wrap gap-2">{pathsDone.map((x) => <li key={x.id}><Link href={`/learn?path=${x.id}`} className="chip">✓ {x.title}</Link></li>)}</ul> : <p className="mt-2 text-sm text-ink-2">None yet: finish every lesson of a path to complete it.</p>}
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {badges(p, pathsDone.length).map((b) => <li key={b.id} title={b.help} className={`rounded-full px-2.5 py-1 text-xs ${b.earned ? "bg-bronze text-paper" : "border border-dashed border-line text-ink-2"}`}>{b.earned ? "★" : "☆"} {b.label}</li>)}
        </ul>
      </section>
    </div>
  );
}
