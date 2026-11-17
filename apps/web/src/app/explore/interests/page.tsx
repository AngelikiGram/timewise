import type { Metadata } from "next";
import { Suspense } from "react";
import { InterestsView } from "@/components/modes/InterestsView";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = { title: "Your interests · TIMEWISE", description: "Journeys that combine a thing, a life and a year, from what you choose." };

export default function Page() {
  return (
    <>
      <SiteHeader />
      <main><Suspense fallback={<p className="p-6 text-ink-2">Loading…</p>}><InterestsView /></Suspense></main>
      <SiteFooter />
    </>
  );
}
