import type { Metadata } from "next";
import Link from "next/link";
import { JourneyCatalog } from "@/components/lessons/JourneyCatalog";
import { SiteHeader } from "@/components/SiteHeader";
import { StoryCard } from "@/components/StoryCard";
import { GeneratedStories } from "@/components/stories/GeneratedStories";
import { STORIES } from "@/lib/stories";

export const metadata: Metadata = { title: "Stories · TIMEWISE", description: "Hundreds of map-led stories by place and era, plus hand-checked guided stories and short journeys." };

export default function StoriesPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[1400px] px-4 pb-16 pt-8 sm:px-6">
        <h1 className="font-serif text-4xl leading-tight">Stories</h1>
        <p className="mt-1 text-ink-2">Pick a place and an era, and follow its records across the map.</p>

        <section className="mt-6" aria-labelledby="generated">
          <h2 id="generated" className="sr-only">Stories by place and era</h2>
          <GeneratedStories />
        </section>

        <section className="mt-14" aria-labelledby="checked">
          <h2 id="checked" className="font-serif text-2xl">Checked by hand</h2>
          <p className="mt-1 text-sm text-ink-2">Written from sourced claims. Slow to make, so there are only a few.</p>
          <ul className="mt-4 grid gap-4 md:grid-cols-2">
            {STORIES.map((s) => <li key={s.id}><StoryCard story={s} /></li>)}
          </ul>
        </section>

        <section className="mt-14" aria-labelledby="journeys-title" id="journeys">
          <h2 id="journeys-title" className="font-serif text-2xl">Short journeys</h2>
          <p className="mt-1 text-sm text-ink-2">Three-minute lessons with questions.</p>
          <div className="mt-4"><JourneyCatalog /></div>
        </section>
        <p className="mt-10 text-xs text-ink-2"><Link href="/about" className="link">How stories are made</Link></p>
      </main>
    </>
  );
}
