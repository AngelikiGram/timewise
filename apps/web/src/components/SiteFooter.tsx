import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-line px-4 py-8 text-sm text-ink-2 sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-wrap items-start justify-between gap-6">
        <p className="max-w-xl leading-relaxed">
          TIMEWISE is an early build. Map data © OpenStreetMap contributors, served by OpenFreeMap. Event records from Wikidata (CC0). Summaries from Wikipedia (CC BY-SA). Images from Wikimedia Commons, credited beside each one.
        </p>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/about" className="hover:text-bronze">About and methods</Link>
          <Link href="/plans" className="hover:text-bronze">Membership plans</Link>
          <Link href="/atlas/countries" className="hover:text-bronze">All countries</Link>
          <a href="https://github.com/AngelikiGram/timewise/issues" target="_blank" rel="noopener noreferrer" className="hover:text-bronze">Report an issue</a>
        </nav>
      </div>
    </footer>
  );
}
