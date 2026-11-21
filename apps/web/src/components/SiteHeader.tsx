"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BASE_PATH } from "@/lib/paths";
import { dueReviews, useProgress } from "@/lib/progress";
import { SearchBox } from "./SearchBox";
import { ThemeToggle } from "./ThemeToggle";
import { Avatar } from "./profile/Avatar";
import { activeProfile, explorerXp, level, questProgress, useExplorer, useProfiles } from "@/lib/explorer";
import { Icon, type IconName } from "./icons";

export function Wordmark() {
  return (
    <Link href="/" className="shrink-0 font-serif text-lg tracking-[0.12em] text-ink sm:text-xl sm:tracking-[0.18em]" aria-label="TIMEWISE home">
      TIME<span className="text-bronze">WISE</span>
    </Link>
  );
}

/** Four sections, and the older addresses that belong to each. */
export const SECTIONS = [
  { id: "learn", primary: true, icon: "book" as IconName, label: "Learn", href: "/learn", match: (p: string) => (p.startsWith("/learn") && !p.startsWith("/learn/review")) || p.startsWith("/challenges") },
  { id: "explore", primary: true, icon: "compass" as IconName, label: "Explore", href: "/atlas", match: (p: string) => ["/atlas", "/history", "/explore", "/stories", "/journey", "/connections"].some((x) => p.startsWith(x)) },
  { id: "review", primary: true, icon: "checked" as IconName, label: "Review", href: "/learn/review", match: (p: string) => p.startsWith("/learn/review") },
  { id: "my-atlas", primary: true, icon: "idea" as IconName, label: "My Atlas", href: "/my-atlas", match: (p: string) => ["/my-atlas", "/collection", "/profile"].some((x) => p.startsWith(x)) },
] as const;

const MODE_PATHS = ["/explore/begin", "/explore/thing", "/explore/year", "/explore/life", "/explore/interests", "/explore/place", "/explore/why"];

/** What sits inside a section, shown as tabs under the header. */
export const SUBNAV: Partial<Record<(typeof SECTIONS)[number]["id"], { label: string; href: string; hint: string; match: (p: string) => boolean }[]>> = {
  explore: [
    { label: "Start here", hint: "Pick a person, a year, a thing or your interests to begin with", href: "/explore/begin", match: (p) => MODE_PATHS.some((x) => p.startsWith(x)) && !p.startsWith("/explore/place") && !p.startsWith("/explore/why") },
    { label: "Map of events", hint: "Every well-recorded event on one map: zoom, filter by period, click a dot", href: "/atlas", match: (p) => ["/atlas", "/history", "/explore"].some((x) => p.startsWith(x)) && !MODE_PATHS.some((x) => p.startsWith(x)) },
    { label: "A place in time", hint: "Any town or city: what was built, what happened and who was born there, century by century", href: "/explore/place", match: (p) => p.startsWith("/explore/place") },
    { label: "Causes and effects", hint: "Why did it happen, and what did it lead to? Click boxes to grow the chain", href: "/explore/why", match: (p) => p.startsWith("/explore/why") },
    { label: "Stories", hint: "Short illustrated stories, read step by step on a map", href: "/stories", match: (p) => p.startsWith("/stories") || p.startsWith("/journey") },
    { label: "Who is linked", hint: "Everyone and everything a record is linked to: people, places, events", href: "/connections", match: (p) => p.startsWith("/connections") },
  ],
  "my-atlas": [
    { label: "My atlas", hint: "Everything you have learned, as a map of links you can explore", href: "/my-atlas", match: (p) => p.startsWith("/my-atlas") },
    { label: "Saved", hint: "Records and stories you bookmarked", href: "/collection", match: (p) => p.startsWith("/collection") },
    { label: "Profile", hint: "Your explorer, level and badges", href: "/profile", match: (p) => p.startsWith("/profile") },
  ],
};

const strip = (pathname: string) => {
  const p = BASE_PATH && pathname.startsWith(BASE_PATH) ? pathname.slice(BASE_PATH.length) || "/" : pathname;
  return p.length > 1 ? p.replace(/\/$/, "") : p;
};

export function currentSection(pathname: string) {
  const p = BASE_PATH && pathname.startsWith(BASE_PATH) ? pathname.slice(BASE_PATH.length) || "/" : pathname;
  const path = p.length > 1 ? p.replace(/\/$/, "") : p;
  return SECTIONS.find((s) => s.match(path))?.id;
}

export function SiteHeader({ children, search = true }: { children?: React.ReactNode; search?: boolean }) {
  const pathname = usePathname() ?? "/";
  const active = currentSection(pathname);
  const [searching, setSearching] = useState(false);
  const progress = useProgress();
  const saved = Object.keys(progress.bookmarks).length;
  const due = dueReviews(progress).length;

  return (
    <>
      {/* On wide screens the sections sit in a quiet rail on the left, icon above label. */}
        <nav aria-label="Main" className="fixed bottom-0 left-0 top-0 z-40 hidden w-[88px] flex-col gap-1 border-r border-line bg-paper-2 px-2 lg:flex">
          <Link href="/" aria-label="TIMEWISE home" className="mb-3 flex h-14 shrink-0 flex-col items-center justify-center border-b border-line font-serif text-[13px] leading-none tracking-[0.18em] text-ink">TIME<span className="text-bronze">WISE</span></Link>
          {SECTIONS.map((s, i) => (
            <div key={s.id} className="contents">
              {i > 0 && s.primary !== SECTIONS[i - 1].primary && <span aria-hidden className="mx-3 my-2 border-t border-line" />}
              <Link
                href={s.href}
                aria-current={active === s.id ? "page" : undefined}
                className={`relative flex flex-col items-center rounded-xl px-1 text-center font-medium leading-tight transition-colors ${s.primary ? "gap-1 py-2.5 text-xs" : "gap-0.5 py-1.5 text-[11px]"} ${active === s.id ? "bg-bronze text-paper shadow-sm" : "text-ink-2 hover:bg-paper-3 hover:text-ink"}`}
              >
                <Icon name={s.icon} size={s.primary ? 22 : 18} />
                {s.label}
                {s.id === "review" && due > 0 && <span className={`absolute right-1.5 top-1.5 rounded-full px-1.5 text-[10px] font-semibold tabular-nums ${active === s.id ? "bg-paper/30" : "bg-oxblood text-white"}`} aria-label={`${due} due`}>{due}</span>}
              </Link>
            </div>
          ))}
        </nav>
    <header className="sticky top-0 z-30 shrink-0 border-b border-line bg-paper-2/95 backdrop-blur">
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
        <span className="lg:hidden"><Wordmark /></span>
        <BackButton pathname={pathname} />
        <div className="min-w-0 flex-1 lg:flex-none">{children}</div>
        {!children && search && (
          <div className="hidden w-full max-w-xl md:block lg:mx-auto">
            <SearchBox size="compact" placeholder="Search history…" />
          </div>
        )}
        <button
          type="button"
          onClick={() => setSearching(!searching)}
          aria-expanded={searching}
          aria-label="Search"
          className={`btn btn-ghost btn-icon ml-auto md:hidden ${children || !search ? "hidden" : ""}`}
        >
          <svg aria-hidden viewBox="0 0 20 20" className="h-5 w-5"><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="m13 13 4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
        </button>
        <div className="ml-auto flex items-center gap-2 md:ml-0 lg:ml-auto"><HeaderExplorer /><ThemeToggle /></div>
      </div>
      {active && SUBNAV[active] && (
        <nav aria-label="In this section" className="flex gap-1 overflow-x-auto border-t border-line px-4 sm:px-6 [&>*]:shrink-0" data-testid="subnav">
          {SUBNAV[active]!.map((t) => {
            const on = t.match(strip(pathname));
            return (
              <Link key={t.href} href={t.href} title={t.hint} aria-current={on ? "page" : undefined} className={`border-b-2 px-3 py-2 text-sm font-medium ${on ? "border-bronze text-ink" : "border-transparent text-ink-2 hover:text-ink"}`}>
                {t.label}{t.label === "Saved" && saved > 0 && <span className="ml-1 rounded-full bg-paper-3 px-1.5 text-[11px] tabular-nums">{saved}</span>}
              </Link>
            );
          })}
        </nav>
      )}
      {active && SUBNAV[active] && (() => { const t = SUBNAV[active]!.find((x) => x.match(strip(pathname))); return t ? <p className="border-t border-line/60 px-4 py-1.5 text-xs text-ink-2 sm:px-6" data-testid="subnav-hint">{t.hint}</p> : null; })()}
      {searching && (
        <div className="border-t border-line px-4 py-2 md:hidden">
          <SearchBox size="compact" placeholder="Search history…" />
        </div>
      )}
      <nav aria-label="Main" className="flex gap-1 overflow-x-auto border-t border-line px-2 lg:hidden [&>*]:shrink-0">
        {SECTIONS.map((s) => (
          <Link
            key={s.id}
            href={s.href}
            aria-current={active === s.id ? "page" : undefined}
            className={`border-b-2 px-3 py-2.5 text-sm font-medium ${active === s.id ? "border-bronze text-ink" : "border-transparent text-ink-2"}`}
          >
            {s.label}
          </Link>
        ))}
      </nav>
    </header>
    </>
  );
}

/**
 * A plain Back button whenever you got here from another TIMEWISE page, so nobody is stranded after a click.
 * It counts pages seen in this tab; the browser's own history does the rest.
 */
function BackButton({ pathname }: { pathname: string }) {
  const router = useRouter();
  const [depth, setDepth] = useState(0);
  useEffect(() => {
    try {
      const key = "tw-trail";
      const here = pathname + window.location.search;
      const trail: string[] = JSON.parse(sessionStorage.getItem(key) ?? "[]");
      if (trail[trail.length - 2] === here) trail.pop();
      else if (trail[trail.length - 1] !== here) trail.push(here);
      sessionStorage.setItem(key, JSON.stringify(trail.slice(-50)));
      setDepth(trail.length);
    } catch { setDepth(0); }
  }, [pathname]);
  if (depth < 2) return null;
  return (
    <button type="button" onClick={() => router.back()} className="btn btn-secondary btn-sm shrink-0" data-testid="back">
      <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4"><path d="M12.5 4.5 7 10l5.5 5.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      Back
    </button>
  );
}

/** Your explorer in the corner: avatar, level and quests left today. Opens the profile. */
function HeaderExplorer() {
  const ps = useProfiles();
  const e = useExplorer();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) return null;
  const me = activeProfile(ps), l = level(explorerXp(e));
  const left = questProgress(e).filter((q) => !q.done).length;
  return (
    <Link href="/profile" className="relative flex items-center gap-2 rounded-full py-0.5 pl-0.5 pr-2.5 hover:bg-paper-3" title={`${me.name || "Your explorer"}: level ${l.n}, ${left} quest${left === 1 ? "" : "s"} left today`} data-testid="header-explorer">
      <Avatar archetype={me.archetype} color={me.color} level={l.n} size={34} />
      <span className="hidden text-sm font-semibold tabular-nums sm:inline">Lv {l.n}</span>
      {left > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-oxblood px-1 text-[10px] font-bold text-white" aria-hidden>{left}</span>}
    </Link>
  );
}
