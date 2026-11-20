import Link from "next/link";
import { CATEGORY_LABELS, CATEGORY_ORDER, categoryVar } from "@/lib/categories";
import { formatImportedDate, formatYear, yearOf, type Precision } from "@/lib/dates";
import { CenturyChart } from "./CenturyChart";
import { SiteHeader } from "./SiteHeader";

export type OverviewEvent = {
  id: string; title: { en?: string; de?: string }; description?: string; category: string; start: string; end?: string;
  precision: Precision; url: string; links?: number; country?: string; nc?: number;
};
export type OverviewData = {
  id: string; label: string; countries: number; events: number; located: number; earliest: number | null;
  categories: Record<string, number>;
  byCentury: { century: number; counts: Record<string, number> }[];
  eras: { label: string; from: number | null; to: number | null; count: number; categories: Record<string, number>; top: OverviewEvent[] }[];
  states: OverviewEvent[];
};

type Country = { id: string; label: string; count: number; continent?: string };
type Tab = { id: string; label: string; href: string };

const titleOf = (e: OverviewEvent) => e.title.en ?? e.title.de ?? "";

function CategoryBar({ counts }: { counts: Record<string, number> }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-paper-3" role="img" aria-label={CATEGORY_ORDER.filter((c) => counts[c]).map((c) => `${CATEGORY_LABELS[c]} ${Math.round((counts[c] / total) * 100)}%`).join(", ")}>
      {CATEGORY_ORDER.filter((c) => counts[c]).map((c) => <span key={c} style={{ width: `${(counts[c] / total) * 100}%`, background: categoryVar(c) }} />)}
    </div>
  );
}

/** States with a founding and an end date, drawn as bars on one time axis. */
function StatesChart({ states, atlasFor }: { states: OverviewEvent[]; atlasFor: (e: OverviewEvent) => string }) {
  if (!states.length) return null;
  const start = Math.min(...states.map((s) => yearOf(s.start)));
  const end = Math.max(...states.map((s) => yearOf(s.end ?? s.start)));
  const span = Math.max(1, end - start);
  const pos = (y: number) => `${((y - start) / span) * 100}%`;
  const ticks = Array.from({ length: 5 }, (_, i) => Math.round(start + (span * i) / 4));
  return (
    <div>
      <div className="relative ml-[38%] h-6 border-b border-line text-sm text-ink-2 sm:ml-[30%]">
        {ticks.map((t) => <span key={t} className="absolute -translate-x-1/2" style={{ left: pos(t) }}>{formatYear(t)}</span>)}
      </div>
      <ul className="mt-1">
        {states.map((s) => (
          <li key={s.id} className="group grid grid-cols-[38%_1fr] items-center gap-0 py-1 sm:grid-cols-[30%_1fr]">
            <Link href={atlasFor(s)} className="truncate pr-3 text-[0.95rem] hover:text-bronze" title={titleOf(s)}>{titleOf(s)}</Link>
            <div className="relative h-5">
              <span
                className="absolute top-0.5 h-4 rounded-sm opacity-85 group-hover:opacity-100"
                style={{ left: pos(yearOf(s.start)), width: `max(3px, ${((yearOf(s.end!) - yearOf(s.start)) / span) * 100}%)`, background: categoryVar("state") }}
                title={`${titleOf(s)}: ${formatYear(yearOf(s.start))} – ${formatYear(yearOf(s.end!))}`}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Overview({ data, countries, tabs, mapHref, atlasFor }: {
  data: OverviewData;
  countries: Country[];
  tabs: Tab[];
  mapHref: string;
  atlasFor: (e: OverviewEvent) => string;
}) {
  const countryName = new Map(countries.map((c) => [c.id, c.label]));
  const topCountries = countries.slice(0, 15);
  const maxCountry = Math.max(1, ...topCountries.map((c) => c.count));
  const categoryTotal = Object.values(data.categories).reduce((a, b) => a + b, 0) || 1;
  const pctLocated = data.events ? Math.round((data.located / data.events) * 100) : 0;

  return (
    <>
      <SiteHeader />
      <main className="bg-paper">
        <nav aria-label="Continents" className="border-b border-line bg-paper-2">
          <ul className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 py-2 sm:px-6">
            {tabs.map((t) => (
              <li key={t.id}>
                <Link href={t.href} aria-current={t.id === data.id ? "page" : undefined} className={`block whitespace-nowrap rounded-full px-4 py-1.5 ${t.id === data.id ? "bg-ink text-paper" : "text-ink-2 hover:text-ink"}`}>{t.label}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <header className="mx-auto max-w-6xl px-4 pb-6 pt-10 sm:px-6">
          <p className="eyebrow">A history overview</p>
          <h1 className="mt-3 font-serif text-5xl leading-[1.02] sm:text-6xl">{data.id === "world" ? "The history of the world" : `The history of ${data.label}`}</h1>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-ink-2">
            {data.events.toLocaleString("en")} events{data.earliest !== null ? ` from ${formatYear(data.earliest)} to today` : ""}, across {data.countries} present-day countries. They are imported from Wikidata and haven&rsquo;t been reviewed, so read them as a map of what is documented, and open any one to see its source.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={mapHref} className="rounded-sm bg-navy px-5 py-3 font-medium text-on-accent dark:bg-bronze">Explore it on the map</Link>
            <a href="#eras" className="rounded-sm border border-line px-5 py-3 font-medium hover:border-bronze">Jump to the eras</a>
          </div>
          <dl className="mt-10 grid grid-cols-2 gap-6 border-y border-line py-6 sm:grid-cols-4">
            {[
              ["Events", data.events.toLocaleString("en")],
              ["Countries", String(data.countries)],
              ["On the map", `${pctLocated}%`],
              ["Earliest record", data.earliest !== null ? formatYear(data.earliest) : "–"],
            ].map(([k, v]) => (
              <div key={k}><dt className="text-ink-2">{k}</dt><dd className="mt-1 font-serif text-4xl">{v}</dd></div>
            ))}
          </dl>
        </header>

        <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6" aria-labelledby="when">
          <h2 id="when" className="font-serif text-3xl">When the records are</h2>
          <div className="mt-5"><CenturyChart rows={data.byCentury} /></div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-10 px-4 py-8 sm:px-6 lg:grid-cols-2">
          <div>
            <h2 className="font-serif text-3xl">What kinds of events</h2>
            <ul className="mt-5 space-y-3">
              {CATEGORY_ORDER.filter((c) => data.categories[c]).map((c) => (
                <li key={c}>
                  <div className="flex justify-between"><span>{CATEGORY_LABELS[c]}</span><span className="text-ink-2">{data.categories[c].toLocaleString("en")}</span></div>
                  <div className="mt-1 h-3 rounded-full bg-paper-3"><div className="h-3 rounded-full" style={{ width: `${(data.categories[c] / categoryTotal) * 100}%`, background: categoryVar(c) }} /></div>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-ink-2">Only these kinds were imported. Daily life, the economy and most of social history aren&rsquo;t in the collection yet.</p>
          </div>
          <div>
            <h2 className="font-serif text-3xl">Where the records are</h2>
            <ul className="mt-5 space-y-2">
              {topCountries.map((c) => (
                <li key={c.id}>
                  <Link href={`/atlas/${c.id}`} className="group grid grid-cols-[9rem_1fr_auto] items-center gap-3 hover:text-bronze">
                    <span className="truncate">{c.label}</span>
                    <span className="h-3 rounded-full bg-bronze-soft group-hover:bg-bronze" style={{ width: `${Math.max(2, (c.count / maxCountry) * 100)}%` }} />
                    <span className="text-sm text-ink-2">{c.count.toLocaleString("en")}</span>
                  </Link>
                </li>
              ))}
            </ul>
            {countries.length > topCountries.length && <p className="mt-3 text-sm text-ink-2">And {countries.length - topCountries.length} more countries, all in the <Link href="/atlas/countries" className="text-bronze underline underline-offset-2">country list</Link>.</p>}
          </div>
        </section>

        <section id="eras" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-8 sm:px-6" aria-labelledby="eras-title">
          <h2 id="eras-title" className="font-serif text-3xl">Era by era</h2>
          <p className="mt-2 max-w-2xl text-ink-2">The best-documented events of each era: those with Wikipedia articles in the most languages. That favours famous events, so treat it as a starting point, not a verdict on what mattered.</p>
          <ol className="mt-8 space-y-12">
            {data.eras.filter((era) => era.count > 0).map((era) => (
              <li key={era.label} className="grid gap-6 lg:grid-cols-[16rem_1fr]">
                <div>
                  <h3 className="font-serif text-2xl">{era.label}</h3>
                  <p className="mt-1 text-ink-2">{era.from === null ? `Before ${era.to}` : era.to === null ? `${era.from} to today` : `${formatYear(era.from)}–${era.to}`} · {era.count.toLocaleString("en")} events</p>
                  <div className="mt-3"><CategoryBar counts={era.categories} /></div>
                </div>
                <ul className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
                  {era.top.map((e) => (
                    <li key={e.id} className="border-l-[3px] pl-4" style={{ borderColor: categoryVar(e.category) }}>
                      <Link href={atlasFor(e)} className="group block">
                        <span className="text-sm text-ink-2">{formatImportedDate(e.start, e.end, e.precision)}{e.country ? ` · ${countryName.get(e.country) ?? ""}` : e.nc && e.nc > 1 ? ` · Multiple regions (${e.nc} countries)` : ""}</span>
                        <span className="mt-0.5 block font-serif text-xl leading-snug group-hover:text-bronze">{titleOf(e)}</span>
                        {e.description && <span className="mt-1 block text-[0.95rem] leading-snug text-ink-2 first-letter:uppercase">{e.description}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </section>

        {data.states.length > 0 && (
          <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6" aria-labelledby="states-title">
            <h2 id="states-title" className="font-serif text-3xl">The rise and fall of states</h2>
            <p className="mt-2 max-w-2xl text-ink-2">Historical states Wikidata gives a founding and an end date for, best documented first, drawn from founding to end. Bars show those dates only, not territory or power.</p>
            <div className="mt-6"><StatesChart states={data.states} atlasFor={atlasFor} /></div>
          </section>
        )}

        <footer className="mx-auto max-w-6xl px-4 pb-16 pt-8 text-sm leading-relaxed text-ink-2 sm:px-6">
          Source: Wikidata (CC0), queried through QLever. Events are grouped by present-day countries and continents, which didn&rsquo;t exist in their current form for most of this history. An event filed under several countries is counted once here.
        </footer>
      </main>
    </>
  );
}
