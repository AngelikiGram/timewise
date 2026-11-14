import Link from "next/link";
import { ClaimCard } from "@/components/EvidencePanel";
import overview from "@data/generated/overview.json";
import { ContinueLearning } from "@/components/ContinueLearning";
import { SearchBox } from "@/components/SearchBox";
import { SiteHeader } from "@/components/SiteHeader";
import { collection, COVERAGE_LABELS, eventsByDate, journeys, placeById } from "@/lib/collection";
import { categoryVar, CATEGORY_ORDER } from "@/lib/categories";
import { formatYear } from "@/lib/dates";

type CenturyRow = { century: number; counts: Record<string, number> };

/** A small stacked silhouette of records per century since 1000 BC, for the continent cards. */
function Sparkline({ rows }: { rows: CenturyRow[] }) {
  const shown = rows.filter((r) => r.century >= -1000);
  const total = (r: CenturyRow) => Object.values(r.counts).reduce((a, b) => a + b, 0);
  const max = Math.max(1, ...shown.map((r) => Math.sqrt(total(r))));
  const w = 100 / Math.max(1, shown.length);
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-14 w-full" aria-hidden>
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

const PLANNED = [
  "How did the Habsburg Monarchy change during the nineteenth century?",
  "How did industrialization and railway expansion change Austrian regions?",
  "How did Graz and Salzburg evolve during selected documented periods?",
];

const investigation = collection.investigations[0];
const journey = journeys[0];
const showcase = collection.claims.find((c) => c.id === "c-sop-1")!;
const regions = [...new Set(collection.places.map((p) => p.region))];
const eventById = new Map(collection.events.map((e) => [e.id, e]));
const featured = eventById.get("vienna-march-1848")!.media!;
const chapterImage = (ids: string[]) => ids.map((id) => eventById.get(id)?.media).find(Boolean);
const areas = [overview.world, ...overview.continents] as { id: string; label: string; events: number; earliest: number | null; byCentury: CenturyRow[] }[];

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:py-14">
          <div>
            <p className="eyebrow">An atlas of history, with its evidence</p>
            <h1 className="mt-4 font-serif text-5xl leading-[1.02] tracking-tight sm:text-7xl">
              See where history <em className="text-bronze">happened.</em>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-2">
              Follow {overview.world.events.toLocaleString("en")} events across maps and time, from {formatYear(overview.world.earliest ?? 0)} to today. Open any one for a summary, its connections and the source behind it.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/history" className="rounded-sm bg-navy px-6 py-3.5 text-lg font-medium text-on-accent dark:bg-bronze">Start exploring</Link>
              <Link href={`/journeys/${journey.id}`} className="rounded-sm border border-line px-6 py-3.5 text-lg font-medium hover:border-bronze">Follow a story</Link>
            </div>
            <div className="mt-6 max-w-xl">
              <SearchBox placeholder="Search the checked Austria collection: “Wien”, “railways”, “1867”" />
            </div>
          </div>
          <figure>
            <Link href={`/journeys/${journey.id}`} className="group relative block overflow-hidden rounded-sm bg-paper-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={featured.url} alt={featured.title} className="aspect-[4/3] w-full object-cover transition-transform duration-700 group-hover:scale-[1.02]" />
              <span className="absolute inset-x-0 bottom-0 block bg-gradient-to-t from-black/85 via-black/55 to-transparent p-6 pt-24 text-white">
                <span className="block text-sm font-semibold uppercase tracking-wider text-amber-200">Featured story · {journey.chapters.length} chapters</span>
                <span className="mt-2 block font-serif text-3xl leading-tight sm:text-4xl">{journey.title.en}</span>
                <span className="mt-2 block max-w-lg text-white/90">{journey.chapters[0].question.en} {journey.subtitle.en}</span>
              </span>
            </Link>
            <figcaption className="mt-1.5 text-xs text-ink-2">
              {featured.title}, {featured.creator}, {featured.created}. {featured.license}. {featured.caveat}
            </figcaption>
          </figure>
        </section>

        <ContinueLearning />

        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6" aria-labelledby="questions">
          <h2 id="questions" className="font-serif text-3xl sm:text-4xl">Questions to explore</h2>
          <p className="mt-2 text-ink-2">Short chapters from the checked Austria collection, each built on sourced claims.</p>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {journey.chapters.map((ch, i) => {
              const img = chapterImage(ch.eventIds);
              return (
                <li key={ch.id}>
                  <Link href={`/journeys/${journey.id}?chapter=${ch.id}`} className="group flex h-full flex-col overflow-hidden rounded-sm border border-line bg-paper-2 hover:border-bronze">
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img.url} alt={img.title} loading="lazy" className="aspect-[16/9] w-full object-cover" />
                    ) : (
                      <span aria-hidden className="flex aspect-[16/9] items-center justify-center bg-paper-3 font-serif text-5xl text-bronze-soft">{i + 1}</span>
                    )}
                    <span className="flex-1 p-4 font-serif text-xl leading-snug group-hover:text-bronze">{ch.question.en}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="border-t border-line bg-paper-2" aria-labelledby="continents">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
            <h2 id="continents" className="font-serif text-3xl sm:text-4xl">History by continent</h2>
            <p className="mt-2 max-w-2xl text-ink-2">Overviews with charts, eras and the rise and fall of states, built from imported Wikidata records. Each shape shows records per century since 1000 BC.</p>
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {areas.map((a) => (
                <li key={a.id}>
                  <Link href={a.id === "world" ? "/history" : `/history/${a.id}`} className="group block h-full rounded-sm border border-line bg-paper p-5 hover:border-bronze">
                    <span className="block font-serif text-2xl group-hover:text-bronze">{a.id === "world" ? "The whole world" : a.label}</span>
                    <span className="mt-1 block text-ink-2">{a.events.toLocaleString("en")} events{a.earliest !== null ? `, from ${formatYear(a.earliest)}` : ""}</span>
                    <span className="mt-3 block"><Sparkline rows={a.byCentury} /></span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-t border-line bg-paper-2">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2">
            <div>
              <p className="eyebrow">Evidence first</p>
              <h2 className="mt-3 font-serif text-4xl leading-tight">Every statement shows what stands behind it.</h2>
              <p className="mt-4 max-w-lg leading-relaxed text-ink-2">
                A reference-work statement, a scholar&rsquo;s interpretation and a disputed claim aren&rsquo;t the same thing, so TIMEWISE doesn&rsquo;t present them as if they were. This is a real record from the collection, including the limits of its evidence.
              </p>
              <Link href={`/explore?event=${showcase.eventId}`} className="mt-5 inline-block text-sm font-medium text-bronze underline underline-offset-2">
                See this claim on the map
              </Link>
            </div>
            <ClaimCard claim={showcase} />
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <p className="eyebrow">Investigations</p>
          <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <Link href={`/explore?investigation=${investigation.id}`} className="group block border border-line bg-paper-2 p-6 transition-colors hover:border-bronze sm:p-8">
              <span className="text-xs font-semibold uppercase tracking-wider text-navy">Available now</span>
              <h3 className="mt-3 font-serif text-3xl leading-tight group-hover:text-bronze">{investigation.question.en}</h3>
              <p className="mt-3 leading-relaxed text-ink-2">{investigation.intro.en}</p>
              <p className="mt-4 text-sm text-ink-2">
                {eventsByDate.filter((e) => e.kind === "event").length} events · {eventsByDate.filter((e) => e.kind === "process").length} processes · {collection.claims.length} claims · {collection.sources.length} sources · {collection.places.length} places
              </p>
            </Link>
            <div className="border border-dashed border-line p-6">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-2">Planned, not yet available</span>
              <ul className="mt-3 space-y-3 font-serif text-lg leading-snug text-ink-2">
                {PLANNED.map((q) => <li key={q}>{q}</li>)}
              </ul>
            </div>
          </div>
        </section>

        <section className="border-t border-line bg-paper-2">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2">
            <div>
              <p className="eyebrow">Coverage, stated plainly</p>
              <h2 className="mt-3 font-serif text-3xl">{collection.region.label.en}: {COVERAGE_LABELS[collection.region.coverage]}</h2>
              <p className="mt-3 max-w-lg leading-relaxed text-ink-2">{collection.region.coverageNote}</p>
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-ink-2">
                Historical regions didn&rsquo;t match today&rsquo;s borders, so this collection also follows events into {collection.places.filter((p) => p.modernCountry !== "AT").map((p) => p.label.en).join(", ")}.
              </p>
            </div>
            <div>
              <h3 className="eyebrow">Regions in this collection</h3>
              <ul className="mt-3 flex flex-wrap gap-2">
                {regions.map((r) => {
                  const place = collection.places.find((p) => p.region === r)!;
                  const first = eventsByDate.find((e) => e.placeId && placeById.get(e.placeId)?.region === place.region);
                  return (
                    <li key={r}>
                      <Link href={`/explore?event=${first?.id}`} className="inline-block rounded-full border border-line px-3 py-1.5 text-sm transition-colors hover:border-bronze hover:text-bronze">{r}</Link>
                    </li>
                  );
                })}
              </ul>
              <h3 className="eyebrow mt-8">Themes</h3>
              <ul className="mt-3 flex flex-wrap gap-2">
                {collection.themes.map((t) => (
                  <li key={t.id}>
                    <Link href={`/explore?theme=${t.id}`} className="inline-block rounded-full border border-line px-3 py-1.5 text-sm transition-colors hover:border-bronze hover:text-bronze">{t.label.en}</Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t border-line px-4 py-8 text-sm text-ink-2 sm:px-6">
        <div className="mx-auto max-w-7xl">
          TIMEWISE is an early build. Map data © OpenStreetMap contributors, served by OpenFreeMap. Images via Wikimedia Commons, credited beside each one.
        </div>
      </footer>
    </>
  );
}
