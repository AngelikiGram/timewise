import Link from "next/link";
import overview from "@data/generated/overview.json";
import { ContinueLearning } from "@/components/ContinueLearning";
import { DailyTeaser, MeanwhileYears } from "@/components/HomeWidgets";
import { SearchBox } from "@/components/SearchBox";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { StoryCard } from "@/components/StoryCard";
import { ReviewBadge } from "@/components/ui";
import { CATEGORY_GLYPH, CATEGORY_LABELS, CATEGORY_ORDER, categoryVar } from "@/lib/categories";
import { formatYear } from "@/lib/dates";
import { STORIES } from "@/lib/stories";

type CenturyRow = { century: number; counts: Record<string, number> };

/** A small stacked silhouette of records per century since 1000 BC, for the continent cards. */
function Sparkline({ rows }: { rows: CenturyRow[] }) {
  const shown = rows.filter((r) => r.century >= -1000);
  const total = (r: CenturyRow) => Object.values(r.counts).reduce((a, b) => a + b, 0);
  const max = Math.max(1, ...shown.map((r) => Math.sqrt(total(r))));
  const w = 100 / Math.max(1, shown.length);
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-12 w-full" aria-hidden>
      {shown.map((r, i) => {
        const h = (Math.sqrt(total(r)) / max) * 40;
        let y = 40;
        return CATEGORY_ORDER.filter((c) => r.counts[c]).map((c) => {
          const part = (r.counts[c] / total(r)) * h;
          y -= part;
          return <rect key={`${r.century}${c}`} x={i * w} y={y} width={w * 0.85} height={part} fill={categoryVar(c)} />;
        });
      })}
    </svg>
  );
}

const PERIODS = [
  { label: "Antiquity", detail: "to 500", from: -3500, to: 499 },
  { label: "Middle Ages", detail: "500–1500", from: 500, to: 1499 },
  { label: "Early modern", detail: "1500–1800", from: 1500, to: 1799 },
  { label: "The long 19th century", detail: "1800–1914", from: 1800, to: 1913 },
  { label: "The world wars", detail: "1914–1945", from: 1914, to: 1945 },
  { label: "Since 1945", detail: "1946 to today", from: 1946, to: 2026 },
];
const THEMES = ["war", "state", "politics", "culture", "health", "disaster"];

const flagship = STORIES[0];
const others = STORIES.slice(1);
const continents = overview.continents as unknown as { id: string; label: string; events: number; earliest: number | null; byCentury: CenturyRow[] }[];

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        {/* Opening screen: one headline, three ways in, and search */}
        <section className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-8 px-4 pb-8 pt-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-center lg:gap-12 lg:pb-12 lg:pt-12">
          <div className="min-w-0">
            <h1 className="font-serif text-[2.75rem] leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
              Discover where and when history <em className="text-bronze">happened.</em>
            </h1>
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink-2">
              Follow guided stories across a living map, compare what was happening around the world, and test yourself with short challenges. Every claim leads back to its source.
            </p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              <Link href={flagship.href} className="btn btn-primary !px-5 !py-3 text-base">Follow a story</Link>
              <Link href="/atlas" className="btn btn-secondary !px-5 !py-3 text-base">Explore the world</Link>
              <Link href="/challenges#today" className="btn btn-secondary !px-5 !py-3 text-base">Play today&rsquo;s challenge</Link>
            </div>
            <div className="mt-6 max-w-xl">
              <SearchBox placeholder="Try “Waterloo”, “Japan” or “Vienna”" />
              <p className="mt-1.5 text-xs text-ink-2">Searches stories, places and the 10,000 best-documented world records. Change the scope on the right.</p>
            </div>
          </div>
          <figure className="relative">
            <Link href={flagship.href} className="group relative block overflow-hidden rounded-lg bg-paper-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={flagship.image!.url} alt={flagship.image!.alt} fetchPriority="high" className="aspect-[4/3] w-full object-cover transition-transform duration-700 group-hover:scale-[1.02]" />
              <span className="absolute inset-x-0 bottom-0 block bg-gradient-to-t from-black/85 via-black/55 to-transparent p-5 pt-20 text-white sm:p-6 sm:pt-24">
                <span className="block text-xs font-semibold uppercase tracking-wider text-amber-200">Featured story · {flagship.place} · {flagship.period} · {flagship.minutes} min</span>
                <span className="mt-2 block font-serif text-2xl leading-tight sm:text-4xl">{flagship.title}</span>
                <span className="mt-2 block max-w-lg text-white/90">{flagship.question}</span>
              </span>
            </Link>
            <details className="mt-1 text-xs text-ink-2">
              <summary className="cursor-pointer list-none hover:text-ink [&::-webkit-details-marker]:hidden">Image: {flagship.image!.creator}, {flagship.image!.created} · {flagship.image!.license} <span aria-hidden>ⓘ</span></summary>
              <p className="mt-1">{flagship.image!.title}. {flagship.image!.caveat} <a href={flagship.image!.page} target="_blank" rel="noopener noreferrer" className="link">Wikimedia Commons ↗</a></p>
            </details>
          </figure>
        </section>

        <ContinueLearning />

        {/* Stories and today's challenge */}
        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6" aria-labelledby="featured">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="featured" className="font-serif text-3xl sm:text-4xl">Start with a question</h2>
            <Link href="/stories" className="link text-sm">All stories →</Link>
          </div>
          <div className="mt-5 grid gap-5 lg:grid-cols-3">
            {others.map((s) => <StoryCard key={s.id} story={s} />)}
            <DailyTeaser />
            <Link href="/history" className="card flex h-full flex-col p-6">
              <span className="eyebrow">Overviews</span>
              <span className="mt-3 font-serif text-2xl leading-snug">The history of the world, continent by continent</span>
              <span className="mt-2 text-ink-2">Charts of what is recorded per century, era by era, and the rise and fall of states.</span>
              <span className="mt-auto pt-4 font-semibold text-bronze">Open the overviews →</span>
            </Link>
          </div>
        </section>

        {/* The signature feature */}
        <section className="border-y border-line bg-paper-2" aria-labelledby="meanwhile">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
            <h2 id="meanwhile" className="font-serif text-3xl italic sm:text-4xl">Meanwhile, elsewhere…</h2>
            <p className="mt-2 max-w-2xl text-ink-2">Pick a year and see what was happening on other continents. Open any event to find its own &ldquo;meanwhile&rdquo; and compare timelines side by side.</p>
            <div className="mt-5"><MeanwhileYears /></div>
          </div>
        </section>

        {/* Browse */}
        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6" aria-labelledby="browse">
          <h2 id="browse" className="font-serif text-3xl sm:text-4xl">Browse the map</h2>
          <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_1.4fr]">
            <div className="space-y-6">
              <div>
                <h3 className="eyebrow">By period</h3>
                <ul className="mt-3 grid grid-cols-2 gap-2">
                  {PERIODS.map((p) => (
                    <li key={p.label}>
                      <Link href={`/atlas?from=${p.from}&to=${p.to}`} className="card block h-full px-3 py-2.5">
                        <span className="block font-medium">{p.label}</span>
                        <span className="text-xs text-ink-2">{p.detail}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="eyebrow">By theme</h3>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {THEMES.map((c) => (
                    <li key={c}>
                      <Link href={`/atlas?cat=${c}`} className="chip">
                        <span aria-hidden className="inline-grid h-4 w-4 place-items-center rounded-full text-[9px] font-bold text-white" style={{ background: categoryVar(c) }}>{CATEGORY_GLYPH[c]}</span>
                        {CATEGORY_LABELS[c]}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div>
              <h3 className="eyebrow">By region</h3>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {continents.map((a) => (
                  <li key={a.id}>
                    <Link href={`/atlas/${a.id}`} className="card block h-full p-4">
                      <span className="block font-serif text-xl">{a.label}</span>
                      <span className="block text-xs text-ink-2">{a.events.toLocaleString("en")} records{a.earliest !== null ? `, from ${formatYear(a.earliest)}` : ""}</span>
                      <span className="mt-2 block"><Sparkline rows={a.byCentury} /></span>
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-ink-2">The shapes count imported records per century since 1000 BC: how much is documented, not how much happened.</p>
            </div>
          </div>
        </section>

        {/* Trust, compactly */}
        <section className="border-t border-line bg-paper-2" aria-labelledby="trust">
          <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_1.5fr] lg:items-center">
            <div>
              <h2 id="trust" className="font-serif text-3xl">How far can you trust it?</h2>
              <p className="mt-2 text-ink-2">Every record carries a status. Open a badge to read what it means.</p>
              <Link href="/about" className="link mt-3 inline-block text-sm">How TIMEWISE checks its content →</Link>
            </div>
            <ul className="grid gap-3 sm:grid-cols-3">
              <li className="card p-4"><ReviewBadge level="imported" /><p className="mt-2 text-sm text-ink-2">Most of the map: 60,000 events from Wikidata, not checked individually.</p></li>
              <li className="card p-4"><ReviewBadge level="source_checked" /><p className="mt-2 text-sm text-ink-2">Stories and challenges: each statement compared by hand with a linked source.</p></li>
              <li className="card p-4"><ReviewBadge level="expert_reviewed" /><p className="mt-2 text-sm text-ink-2">Reviewed by a historian. Nothing has this status yet.</p></li>
            </ul>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
