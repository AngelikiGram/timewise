import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { LiveStoryView } from "@/components/stories/LiveStory";

export const metadata: Metadata = { title: "A story from Wikidata · TIMEWISE", description: "Any event, told on the spot from its documented causes, parts and consequences on Wikidata." };

export default function LiveStoryPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <Suspense fallback={<p className="p-6 text-ink-2">Loading…</p>}>
          <LiveStoryView />
        </Suspense>
      </main>
    </>
  );
}
