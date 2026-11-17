"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BASE_PATH } from "@/lib/paths";
import { dueReviews, useProgress } from "@/lib/progress";
import { SearchBox } from "./SearchBox";
import { ThemeToggle } from "./ThemeToggle";
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

const MODE_PATHS = ["/explore/begin", "/explore/thing", "/explore/year", "/explore/life", "/explore/interests"];

/** What sits inside a section, shown as tabs under the header. */
export const SUBNAV: Partial<Record<(typeof SECTIONS)[number]["id"], { label: string; href: string; match: (p: string) => boolean }[]>> = {
  explore: [
    { label: "Where to begin", href: "/explore/begin", match: (p) => MODE_PATHS.some((x) => p.startsWith(x)) },
    { label: "World Map", href: "/atlas", match: (p) => ["/atlas", "/history", "/explore"].some((x) => p.startsWith(x)) && !MODE_PATHS.some((x) => p.startsWith(x)) },
    { label: "Stories", href: "/stories", match: (p) => p.startsWith("/stories") || p.startsWith("/journey") },
    { label: "Connections", href: "/connections", match: (p) => p.startsWith("/connections") },
  ],
  "my-atlas": [
    { label: "Atlas", href: "/my-atlas", match: (p) => p.startsWith("/my-atlas") },
    { label: "Saved", href: "/collection", match: (p) => p.startsWith("/collection") },
    { label: "Profile", href: "/profile", match: (p) => p.startsWith("/profile") },
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
        <div className="ml-auto md:ml-0 lg:ml-auto"><ThemeToggle /></div>
      </div>
      {active && SUBNAV[active] && (
        <nav aria-label="In this section" className="flex gap-1 overflow-x-auto border-t border-line px-4 sm:px-6 [&>*]:shrink-0" data-testid="subnav">
          {SUBNAV[active]!.map((t) => {
            const on = t.match(strip(pathname));
            return (
              <Link key={t.href} href={t.href} aria-current={on ? "page" : undefined} className={`border-b-2 px-3 py-2 text-sm font-medium ${on ? "border-bronze text-ink" : "border-transparent text-ink-2 hover:text-ink"}`}>
                {t.label}{t.label === "Saved" && saved > 0 && <span className="ml-1 rounded-full bg-paper-3 px-1.5 text-[11px] tabular-nums">{saved}</span>}
              </Link>
            );
          })}
        </nav>
      )}
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
