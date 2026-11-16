import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { StoryReader } from "@/components/stories/StoryReader";

export const metadata: Metadata = { title: "Story · TIMEWISE", description: "A place and an era through its best-documented records, on a map and a timeline." };

export default function ReadStoryPage() {
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <SiteHeader />
      <main className="relative flex min-h-0 flex-1 flex-col">
        <Suspense fallback={<p className="p-6 text-ink-2">Loading the story…</p>}>
          <StoryReader />
        </Suspense>
      </main>
    </div>
  );
}
