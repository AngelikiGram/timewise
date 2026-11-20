import type { Metadata } from "next";
import { Suspense } from "react";
import { TimelineGame } from "@/components/play/TimelineGame";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = { title: "Build your own timeline · TIMEWISE", description: "Put real events in order, then see where they really fall on the timeline and the map." };

export default function Page() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6">
        <Suspense fallback={<p className="p-6 text-ink-2">Loading…</p>}>
          <TimelineGame />
        </Suspense>
      </main>
    </>
  );
}
