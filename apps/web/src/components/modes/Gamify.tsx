"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { explorerBadges, explorerXp, level, recentOf, TIER_STYLE, useExplorer, type ExplorerBadge } from "@/lib/explorer";
import { useProgress } from "@/lib/progress";
import { Icon } from "../icons";

/** A round medal for a badge: tier colour when earned, a dashed outline with progress when not. */
export function Medal({ b, size = 64 }: { b: ExplorerBadge; size?: number }) {
  const t = TIER_STYLE[b.tier];
  const r = size / 2 - 4, C = 2 * Math.PI * r;
  return (
    <span className="relative inline-grid place-items-center" style={{ width: size, height: size }} aria-hidden>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill={b.earned ? t.fill : "transparent"} stroke="var(--line)" strokeWidth={3} strokeDasharray={b.earned ? undefined : "4 3"} />
        {b.have > 0 && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={t.ring} strokeWidth={4} strokeLinecap="round" strokeDasharray={`${(b.have / b.need) * C} ${C}`} />}
      </svg>
      <Icon name={b.icon} size={size * 0.42} className={b.earned ? "" : "opacity-40"} style={{ color: b.earned ? t.ring : undefined }} />
      {b.earned && <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold text-white" style={{ background: t.ring }}>★</span>}
    </span>
  );
}

/** Level, XP bar and title. */
export function LevelBar({ compact = false }: { compact?: boolean }) {
  const e = useExplorer();
  const l = level(explorerXp(e));
  const pct = l.to ? Math.round(((l.xp - l.from) / (l.to - l.from)) * 100) : 100;
  if (compact) {
    return (
      <Link href="/explore/interests?tab=profile" className="inline-flex items-center gap-2 rounded-full border border-line bg-paper-2 px-3 py-1 text-sm hover:border-bronze" title={`${l.xp} XP${l.to ? `, ${l.to - l.xp} to ${l.nextTitle}` : ""}`} data-testid="level-chip">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-bronze text-xs font-bold text-paper">{l.n}</span>
        <span className="hidden sm:inline">{l.title}</span>
        <span className="h-1.5 w-12 overflow-hidden rounded-full bg-line" aria-hidden><span className="block h-full bg-bronze" style={{ width: `${pct}%` }} /></span>
      </Link>
    );
  }
  return (
    <div className="flex items-center gap-4" data-testid="level-bar">
      <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-bronze font-serif text-3xl text-paper shadow-sm">{l.n}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-bronze">Level {l.n}</p>
        <p className="font-serif text-2xl leading-tight">{l.title}</p>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Progress to the next level"><div className="h-full rounded-full bg-gradient-to-r from-bronze to-oxblood transition-[width] duration-700" style={{ width: `${pct}%` }} /></div>
        <p className="mt-1 text-xs text-ink-2">{l.xp} XP{l.to ? ` · ${l.to - l.xp} more to ${l.nextTitle}` : " · the top level"}</p>
      </div>
    </div>
  );
}

/** A pop-up when a badge is earned. Listens for the store's event, so any page with it mounted shows it. */
export function BadgeToast() {
  const [shown, setShown] = useState<ExplorerBadge[]>([]);
  const [cards, setCards] = useState(0);
  useEffect(() => {
    const on = (ev: Event) => { const b = (ev as CustomEvent<ExplorerBadge[]>).detail; setShown(b); setTimeout(() => setShown([]), 4500); };
    const mem = (ev: Event) => { setCards((ev as CustomEvent<number>).detail); setTimeout(() => setCards(0), 4500); };
    window.addEventListener("tw-badge", on);
    window.addEventListener("tw-memory", mem);
    return () => { window.removeEventListener("tw-badge", on); window.removeEventListener("tw-memory", mem); };
  }, []);
  if (!shown.length && cards) {
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4" role="status" aria-live="polite" data-testid="memory-toast">
        <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border-2 border-navy/40 bg-paper p-3 pr-5 shadow-xl">
          <span aria-hidden className="text-3xl">🧠</span>
          <span><span className="block font-serif text-lg leading-tight">{cards} review question{cards === 1 ? "" : "s"} saved</span><span className="block text-xs text-ink-2">They come back in a day, then at growing intervals.</span></span>
          <Link href="/learn/review" className="btn btn-secondary btn-sm ml-2">Review</Link>
        </div>
      </div>
    );
  }
  if (!shown.length) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4" role="status" aria-live="polite" data-testid="badge-toast">
      <div className="pointer-events-auto flex animate-[tw-pop_.5s_ease-out] items-center gap-3 rounded-2xl border-2 bg-paper p-3 pr-5 shadow-xl" style={{ borderColor: TIER_STYLE[shown[0].tier].ring }}>
        <Medal b={shown[0]} size={52} />
        <span><span className="block text-xs font-semibold uppercase tracking-wider text-bronze">Badge earned!</span><span className="block font-serif text-xl leading-tight">{shown[0].label}</span><span className="block text-xs text-ink-2">{shown[0].help}{shown.length > 1 ? ` · and ${shown.length - 1} more` : ""}</span></span>
        <Link href="/explore/interests?tab=profile" className="btn btn-secondary btn-sm ml-2">See all</Link>
      </div>
      <style>{"@keyframes tw-pop{0%{transform:translateY(30px) scale(.8);opacity:0}70%{transform:translateY(-4px) scale(1.04);opacity:1}100%{transform:none}}"}</style>
    </div>
  );
}

/** The explorer profile: level, counts, badges and what you have followed lately. */
export function ExplorerPanel() {
  const e = useExplorer();
  const p = useProgress();
  const list = explorerBadges(e, (p.interests ?? []).length);
  const earned = list.filter((b) => b.earned).length;
  const stats: [number, string, string][] = [
    [Object.keys(e.lives).length, "lives followed", "/explore/life"], [Object.keys(e.things).length, "things tracked", "/explore/thing"],
    [Object.keys(e.years).length, "years visited", "/explore/year"], [Object.keys(e.stories).length, "stories opened", "/stories"],
    [Object.keys(e.places).length, "places explained", "/explore/place"], [Object.keys(e.why).length, "causes opened", "/explore/why"],
    [e.timeline.perfect, `perfect timelines · best streak ${e.timeline.best}`, "/challenges/timeline"], [e.facts.right, `claims judged right of ${e.facts.answered}`, "/challenges/fact-or-myth"],
  ];
  const lives = recentOf(e.lives), things = recentOf(e.things), stories = recentOf(e.stories, 4), places = recentOf(e.places, 4);
  const hrefLife = (id: string) => (/^Q\d+$/.test(id) ? `/explore/life?q=${id}` : `/explore/life?id=${id}`);
  return (
    <div className="grid gap-6" data-testid="explorer-panel">
      <div className="card p-5"><LevelBar /></div>
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(([n, l, href]) => <li key={l}><Link href={href} className="card card-link block p-4"><p className="font-serif text-3xl tabular-nums">{n}</p><p className="text-sm text-ink-2">{l}</p></Link></li>)}
      </ul>
      <section aria-labelledby="badges-title">
        <div className="flex items-baseline justify-between"><h2 id="badges-title" className="font-serif text-2xl">Badges</h2><span className="text-sm text-ink-2">{earned} of {list.length}</span></div>
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8" data-testid="explorer-badges">
          {list.map((b) => (
            <li key={b.id} className={`flex flex-col items-center rounded-xl p-2 text-center ${b.earned ? "" : "opacity-80"}`} title={b.help}>
              <Medal b={b} />
              <span className="mt-1.5 text-sm font-medium leading-tight">{b.label}</span>
              <span className="text-[11px] text-ink-2">{b.earned ? TIER_STYLE[b.tier].label : `${b.have}/${b.need}`}</span>
              <span className="sr-only">{b.help}</span>
            </li>
          ))}
        </ul>
      </section>
      {(lives.length > 0 || things.length > 0 || stories.length > 0 || places.length > 0) && (
        <section aria-labelledby="recent-title">
          <h2 id="recent-title" className="font-serif text-2xl">Your trail</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {lives.map((x) => <Link key={x.id} href={hrefLife(x.id)} className="chip"><Icon name="person" size={14} />{x.label}</Link>)}
            {things.map((x) => <Link key={x.id} href={/^Q\d+$/.test(x.id) ? `/explore/thing?q=${x.id}` : `/explore/thing?id=${x.id}`} className="chip"><Icon name="network" size={14} />{x.label}</Link>)}
            {places.map((x) => <Link key={x.id} href={`/explore/place?q=${x.id}`} className="chip"><Icon name="place" size={14} />{x.label}</Link>)}
            {stories.map((x) => <Link key={x.id} href={x.id.startsWith("live-") ? `/stories/live?q=${x.id.slice(5)}` : `/stories/read?id=${x.id}`} className="chip"><Icon name="book" size={14} />{x.label.length > 40 ? `${x.label.slice(0, 39)}…` : x.label}</Link>)}
          </div>
        </section>
      )}
      <p className="text-xs text-ink-2">XP and badges are for fun and stay in this browser. They count what you opened, not what you know; for that, see lessons and review.</p>
    </div>
  );
}
