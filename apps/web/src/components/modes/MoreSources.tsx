"use client";

import { useEffect, useRef, useState } from "react";
import { commonsNear, europeana, openLibrary, rightsLabel, type ArchiveItem, type Book, type Photo } from "@/lib/opendata";
import { Icon } from "../icons";

type Tab = "archives" | "photos" | "books";

/**
 * Beyond Wikidata: objects from European archives and museums (Europeana), photographs taken nearby (Commons)
 * and books to read (Open Library). Loaded only when scrolled into view, so the page above stays fast.
 */
export function MoreSources({ query, point, label }: { query: string; point?: [number, number] | null; label: string }) {
  const box = useRef<HTMLElement>(null);
  const [seen, setSeen] = useState(false);
  const [tab, setTab] = useState<Tab>("archives");
  const [arch, setArch] = useState<{ total: number; items: ArchiveItem[] } | null | "failed">(null);
  const [photos, setPhotos] = useState<Photo[] | null | "failed">(null);
  const [books, setBooks] = useState<Book[] | null | "failed">(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el || seen) return;
    const io = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) { setSeen(true); io.disconnect(); } }, { rootMargin: "300px" });
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  useEffect(() => {
    if (!seen) return;
    const ac = new AbortController();
    const fail = (set: (x: "failed") => void) => (e: Error) => { if (e.name !== "AbortError") set("failed"); };
    europeana(query, ac.signal).then(setArch, fail(setArch));
    openLibrary(query, ac.signal).then(setBooks, fail(setBooks));
    if (point) commonsNear(point[1], point[0], ac.signal).then(setPhotos, fail(setPhotos));
    return () => ac.abort();
  }, [seen, query, point, attempt]);
  const retry = <button type="button" className="link ml-1" onClick={() => { setArch(null); setBooks(null); setPhotos(null); setAttempt(attempt + 1); }}>Try again</button>;
  const n = (x: unknown[] | null | "failed" | undefined) => (Array.isArray(x) ? x.length : null);
  const tabs: { id: Tab; label: string; count: number | null; show: boolean }[] = [
    { id: "archives", label: "Archives & museums", count: arch && arch !== "failed" ? arch.total : null, show: true },
    { id: "photos", label: "Photos taken here", count: n(photos), show: !!point },
    { id: "books", label: "Books", count: n(books), show: true },
  ];

  return (
    <section ref={box} className="mt-10" aria-labelledby="more-sources" data-testid="more-sources">
      <h2 id="more-sources" className="font-serif text-2xl">Beyond Wikidata</h2>
      <p className="text-sm text-ink-2">More about {label} from other open collections. Each item links to where it is kept.</p>
      <div role="tablist" className="mt-3 flex flex-wrap gap-1 border-b border-line">
        {tabs.filter((t) => t.show).map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === t.id ? "border-bronze font-medium" : "border-transparent text-ink-2 hover:text-ink"}`}>
            {t.label}{t.count != null && <span className="ml-1 text-xs text-ink-2">{t.count.toLocaleString("en")}</span>}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="mt-4">
        {tab === "archives" && (arch === "failed" ? <p className="text-sm text-ink-2">Europeana didn&rsquo;t answer this time.{retry}</p> : !arch ? <Loading /> : !arch.items.length ? <p className="text-sm text-ink-2">Europeana has nothing under “{query}”.</p> : (
          <>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" data-testid="europeana">
              {arch.items.map((x) => (
                <li key={x.id} className="overflow-hidden rounded-xl border border-line bg-paper-2">
                  <a href={x.link} target="_blank" rel="noopener noreferrer" className="block hover:opacity-90">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {x.reusable && x.preview ? <img src={x.preview} alt="" loading="lazy" className="h-32 w-full object-cover" /> : <span className="grid h-32 place-items-center bg-paper-3 p-2 text-center text-[11px] text-ink-2"><Icon name="source" size={22} className="mb-1 text-bronze" />Preview at the source</span>}
                    <span className="block p-2 text-xs"><span className="line-clamp-2 font-medium">{x.title}</span><span className="block truncate text-ink-2">{[x.year, x.provider].filter(Boolean).join(", ")}</span><span className="block truncate text-[10px] text-ink-2">{rightsLabel(x.rights)}</span></span>
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-ink-2">From <a className="link" href={`https://www.europeana.eu/en/search?query=${encodeURIComponent(query)}`} target="_blank" rel="noopener noreferrer">Europeana</a>. Pictures are shown here only when their rights allow reuse; the others open at their archive.</p>
          </>
        ))}
        {tab === "photos" && (photos === "failed" ? <p className="text-sm text-ink-2">Wikimedia Commons didn&rsquo;t answer this time.{retry}</p> : !photos ? <Loading /> : !photos.length ? <p className="text-sm text-ink-2">No photos on Commons near here.</p> : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8" data-testid="commons-near">
            {photos.map((x) => (
              <li key={x.page}><a href={x.page} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg border border-line hover:opacity-90" title={x.title}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={x.thumb} alt={x.title} loading="lazy" className="h-28 w-full object-cover" />
                <span className="block truncate px-1.5 py-1 text-[10px] text-ink-2">{[x.date?.slice(0, 4), x.artist, x.license].filter(Boolean).join(", ")}</span>
              </a></li>
            ))}
          </ul>
        ))}
        {tab === "books" && (books === "failed" ? <p className="text-sm text-ink-2">Neither Open Library nor the Internet Archive answered this time; both are sometimes slow.{retry}</p> : !books ? <Loading /> : !books.length ? <p className="text-sm text-ink-2">No books found.</p> : (
          <>
            <ul className="grid gap-2 sm:grid-cols-2" data-testid="books">
              {books.map((b) => <li key={b.key} className="flex gap-3 rounded-lg border border-line bg-paper-2 p-3 text-sm"><Icon name="book" size={20} className="mt-0.5 shrink-0 text-bronze" /><span><a href={b.link} target="_blank" rel="noopener noreferrer" className="font-medium hover:text-bronze">{b.title}</a><span className="block text-xs text-ink-2">{[b.authors.join(", "), b.year].filter(Boolean).join(", ")}</span></span></li>)}
            </ul>
            <p className="mt-2 text-xs text-ink-2">From {books[0]?.source === "Internet Archive" ? <a className="link" href="https://archive.org/details/texts" target="_blank" rel="noopener noreferrer">the Internet Archive</a> : <a className="link" href="https://openlibrary.org" target="_blank" rel="noopener noreferrer">Open Library</a>}. Many can be read or borrowed there for free.</p>
          </>
        ))}
      </div>
    </section>
  );
}

const Loading = () => <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">{Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton h-40 rounded-xl" />)}</div>;
