import type { Metadata } from "next";
import { Suspense } from "react";
import { PlaceView } from "@/components/modes/PlaceView";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = { title: "Explain this place · TIMEWISE", description: "Any city or town through the centuries: landmarks, events, people and population, plus a short guide for a visit." };

export default function Page() {
  return (
    <>
      <SiteHeader />
      <main>
        <Suspense fallback={<p className="p-6 text-ink-2">Loading…</p>}>
          <PlaceView />
        </Suspense>
      </main>
    </>
  );
}
