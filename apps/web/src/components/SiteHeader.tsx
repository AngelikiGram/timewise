"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BASE_PATH } from "@/lib/paths";
import { useProgress } from "@/lib/progress";
import { SearchBox } from "./SearchBox";
import { ThemeToggle } from "./ThemeToggle";

export function Wordmark() {
  return (
    <Link href="/" className="shrink-0 font-serif text-lg tracking-[0.12em] text-ink sm:text-xl sm:tracking-[0.18em]" aria-label="TIMEWISE home">
      TIME<span className="text-bronze">WISE</span>
    </Link>
  );
}

/** The sections, and the older addresses that belong to each. */
export const SECTIONS = [
  { id: "discover", label: "Discover", href: "/", match: (p: string) => p === "/" },
  { id: "learn", label: "Learn", href: "/learn", match: (p: string) => p.startsWith("/learn") || p.startsWith("/challenges") },
  { id: "explore", label: "Explore", href: "/connections", match: (p: string) => p.startsWith("/connections") },
  { id: "map", label: "World Map", href: "/atlas", match: (p: string) => p.startsWith("/atlas") || p.startsWith("/history") || p.startsWith("/explore") },
  { id: "stories", label: "Stories", href: "/stories", match: (p: string) => p.startsWith("/stories") || p.startsWith("/journey") },
  { id: "collection", label: "My Collection", href: "/collection", match: (p: string) => p.startsWith("/collection") },
] as const;

export function currentSection(pathname: string) {
  const p = BASE_PATH && pathname.startsWith(BASE_PATH) ? pathname.slice(BASE_PATH.length) || "/" : pathname;
  const path = p.length > 1 ? p.replace(/\/$/, "") : p;
  return SECTIONS.find((s) => s.match(path))?.id;
}

export function SiteHeader({ children }: { children?: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const active = currentSection(pathname);
  const [searching, setSearching] = useState(false);
  const progress = useProgress();
  const saved = Object.keys(progress.bookmarks).length;

  return (
    <header className="sticky top-0 z-30 shrink-0 border-b border-line bg-paper-2/95 backdrop-blur">
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
        <Wordmark />
        <nav aria-label="Main" className="ml-2 hidden items-center gap-1 lg:flex">
          {SECTIONS.map((s) => (
            <Link
              key={s.id}
              href={s.href}
              aria-current={active === s.id ? "page" : undefined}
              className={`relative whitespace-nowrap rounded-md px-2.5 py-2 text-[0.95rem] xl:px-3 font-medium transition-colors hover:bg-paper-3 hover:text-ink ${active === s.id ? "text-ink after:absolute after:inset-x-2.5 after:-bottom-[9px] after:h-0.5 after:rounded-full after:bg-bronze" : "text-ink-2"}`}
            >
              {s.label}
              {s.id === "collection" && saved > 0 && <span className="ml-1.5 rounded-full bg-paper-3 px-1.5 text-xs tabular-nums text-ink-2">{saved}</span>}
            </Link>
          ))}
        </nav>
        <div className="min-w-0 flex-1">{children}</div>
        {!children && (
          <div className="hidden w-full max-w-sm md:block">
            <SearchBox size="compact" placeholder="Search history…" />
          </div>
        )}
        <button
          type="button"
          onClick={() => setSearching(!searching)}
          aria-expanded={searching}
          aria-label="Search"
          className={`btn btn-ghost btn-icon md:hidden ${children ? "hidden" : ""}`}
        >
          <svg aria-hidden viewBox="0 0 20 20" className="h-5 w-5"><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="m13 13 4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
        </button>
        <ThemeToggle />
      </div>
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
  );
}
