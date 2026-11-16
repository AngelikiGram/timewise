import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { StoryCard } from "@/components/StoryCard";
import { ReviewBadge } from "@/components/ui";
import { STORIES } from "@/lib/stories";
import { JourneyCatalog } from "@/components/lessons/JourneyCatalog";

export const metadata: Metadata = { title: "Stories · TIMEWISE", description: "Guided journeys and detective cases, built on sourced claims." };

export default function StoriesPage() {
  const [flagship, ...rest] = STORIES;
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6">
        <p className="eyebrow">Stories</p>
        <h1 className="mt-2 font-serif text-4xl leading-tight sm:text-5xl">Guided journeys and investigations</h1>
        <p className="mt-3 max-w-2xl text-lg text-ink-2">
          Each story follows one question across the map and the timeline. Every statement in it was checked by hand against a linked source.
        </p>
        <div className="mt-3"><ReviewBadge level="source_checked" /></div>

        <div className="mt-8"><StoryCard story={flagship} large /></div>
        <ul className="mt-6 grid gap-6 md:grid-cols-2">
          {rest.map((s) => <li key={s.id}><StoryCard story={s} /></li>)}
          <li className="flex flex-col justify-center rounded-lg border border-dashed border-line p-6">
            <h2 className="font-serif text-2xl">Explore without a guide</h2>
            <p className="mt-2 text-ink-2">The world map has 60,000 imported events, and each continent has an overview with charts and eras.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/atlas" className="btn btn-secondary">Open the world map</Link>
              <Link href="/history" className="btn btn-ghost">History overviews</Link>
            </div>
          </li>
        </ul>
        <section className="mt-14" aria-labelledby="journeys">
          <h2 id="journeys" className="font-serif text-3xl">Short journeys</h2>
          <p className="mt-1 max-w-2xl text-ink-2">Three-minute lessons with a map, a timeline and a few questions. Most are assembled automatically from imported records and labelled that way.</p>
          <div className="mt-4"><JourneyCatalog /></div>
        </section>
        <p className="mt-10 text-sm text-ink-2">
          Authored stories need sourced claims before they can be published, so that library grows slowly. <Link href="/about" className="link">How stories are made</Link>.
        </p>
      </main>
    </>
  );
}
