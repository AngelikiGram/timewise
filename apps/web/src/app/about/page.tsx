import type { Metadata } from "next";
import Link from "next/link";
import { ClaimCard } from "@/components/EvidencePanel";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { ReviewBadge } from "@/components/ui";
import { collection, COVERAGE_LABELS } from "@/lib/collection";

export const metadata: Metadata = { title: "About and methods · TIMEWISE", description: "Where TIMEWISE's content comes from, and how far each kind can be trusted." };

const PLANNED = [
  "How did the Habsburg Monarchy change during the nineteenth century?",
  "How did industrialization and railway expansion change Austrian regions?",
  "How did Graz and Salzburg evolve during selected documented periods?",
];

export default function AboutPage() {
  const showcase = collection.claims.find((c) => c.id === "c-sop-1")!;
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 pb-16 pt-8 sm:px-6">
        <p className="eyebrow">About and methods</p>
        <h1 className="mt-2 font-serif text-4xl leading-tight sm:text-5xl">Where the content comes from</h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-2">
          TIMEWISE combines two kinds of content and always says which one you&rsquo;re looking at. A reference-work statement, a scholar&rsquo;s interpretation and a disputed claim aren&rsquo;t the same thing, so they aren&rsquo;t presented as if they were.
        </p>

        <section className="mt-10 space-y-4" aria-labelledby="statuses">
          <h2 id="statuses" className="font-serif text-2xl">Review statuses</h2>
          <div className="card p-4"><ReviewBadge level="imported" /><p className="mt-2 text-ink-2">About 60,000 events from Wikidata, imported automatically for 197 countries. Dates, places and names come from Wikidata&rsquo;s volunteers and haven&rsquo;t been checked here. Summaries are loaded live from Wikipedia and credited.</p></div>
          <div className="card p-4"><ReviewBadge level="source_checked" /><p className="mt-2 text-ink-2">The {collection.claims.length} claims behind the Austria story and the challenges. Each was compared by hand with the source it cites, which is linked. Most of these sources are reference works, not original documents.</p></div>
          <div className="card p-4"><ReviewBadge level="expert_reviewed" /><p className="mt-2 text-ink-2">Reserved for content a named historian has reviewed. Nothing has this status yet.</p></div>
        </section>

        <section className="mt-10" aria-labelledby="checks">
          <h2 id="checks" className="font-serif text-2xl">Checks on the imported records</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed text-ink-2">
            <li><strong className="text-ink">Several countries.</strong> Wikidata ties some events to many countries: the Second World War to 69. From five countries up, an event is listed under <em>multiple regions</em>, never under the first country alphabetically, and from fifteen up it isn&rsquo;t pinned to a single point.</li>
            <li><strong className="text-ink">Dates that disagree.</strong> When a record&rsquo;s name gives one year (&ldquo;1988 &hellip; election&rdquo;) and its recorded date another, both are shown with a warning.</li>
            <li><strong className="text-ink">Precision.</strong> A date is never shown more precisely than its source gives it. Exact dates, approximate dates, ranges and longer processes are labelled.</li>
            <li><strong className="text-ink">Wording.</strong> Constitutions read &ldquo;&hellip; adopted&rdquo;; a building&rsquo;s date is labelled as when it came into being, not as a founding.</li>
            <li><strong className="text-ink">Maps.</strong> The base map shows today&rsquo;s borders. Historical outlines appear only where a dated, attributed shape exists, and are labelled as coarse.</li>
          </ul>
        </section>

        <section className="mt-10 grid gap-6 md:grid-cols-[1fr_1.2fr]" aria-labelledby="example">
          <div>
            <h2 id="example" className="font-serif text-2xl">A checked claim, in full</h2>
            <p className="mt-2 leading-relaxed text-ink-2">This is a real record, including the limits of its evidence.</p>
            <Link href={`/explore?event=${showcase.eventId}`} className="link mt-3 inline-block text-sm">See it on the map →</Link>
          </div>
          <ClaimCard claim={showcase} />
        </section>

        <section className="mt-10" aria-labelledby="coverage">
          <h2 id="coverage" className="font-serif text-2xl">Coverage, stated plainly</h2>
          <p className="mt-2 leading-relaxed text-ink-2"><strong className="text-ink">{collection.region.label.en}: {COVERAGE_LABELS[collection.region.coverage]}.</strong> {collection.region.coverageNote}</p>
          <p className="mt-3 text-ink-2">Planned questions for the checked collection, not yet available:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-2">{PLANNED.map((q) => <li key={q}>{q}</li>)}</ul>
        </section>

        <section className="mt-10" aria-labelledby="privacy">
          <h2 id="privacy" className="font-serif text-2xl">Your data</h2>
          <p className="mt-2 leading-relaxed text-ink-2">There are no accounts. Bookmarks, notes and progress are stored in your browser only, and nothing is sent to a server. Issue reports go to GitHub, where they are public.</p>
        </section>

        <section className="mt-10" aria-labelledby="tools">
          <h2 id="tools" className="font-serif text-2xl">Tools for checking</h2>
          <p className="mt-2 text-ink-2">The <Link href="/explore" className="link">evidence workspace</Link> shows the checked Austria collection with its timeline, claims and sources side by side.</p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
