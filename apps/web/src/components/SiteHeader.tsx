import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";

export function Wordmark() {
  return (
    <Link href="/" className="shrink-0 font-serif text-lg tracking-[0.12em] text-ink sm:text-xl sm:tracking-[0.18em]" aria-label="TIMEWISE home">
      TIME<span className="text-bronze">WISE</span>
    </Link>
  );
}

export function SiteHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="z-20 flex h-14 shrink-0 items-center gap-2 sm:gap-4 border-b border-line bg-paper-2/90 px-4 backdrop-blur sm:px-6">
      <Wordmark />
      <div className="min-w-0 flex-1">{children}</div>
      <nav className="flex min-w-0 items-center gap-2.5 text-[0.9rem] sm:gap-5 sm:text-sm">
        <Link href="/history" className="text-ink-2 transition-colors hover:text-bronze">History</Link>
        <Link href="/atlas" className="text-ink-2 transition-colors hover:text-bronze">Atlas</Link>
        <Link href="/journeys/austria-1848-1921" className="text-ink-2 transition-colors hover:text-bronze">Journey</Link>
        <Link href="/explore" className="text-ink-2 transition-colors hover:text-bronze">Explore</Link>
        <ThemeToggle />
      </nav>
    </header>
  );
}
