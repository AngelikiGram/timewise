import type { Metadata } from "next";
import { Suspense } from "react";
import { ThingView } from "@/components/modes/ThingView";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = { title: "Follow a thing · TIMEWISE", description: "Follow a thing across places and centuries, from the Wikidata records that name it." };

export default function Page() {
  return (
    <>
      <SiteHeader />
      <main><Suspense fallback={<p className="p-6 text-ink-2">Loading…</p>}><ThingView /></Suspense></main>
      <SiteFooter />
    </>
  );
}
