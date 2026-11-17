import type { Metadata } from "next";
import { Suspense } from "react";
import { YearView } from "@/components/modes/YearView";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = { title: "Explore a year · TIMEWISE", description: "The same year in different places, from documented records." };

export default function Page() {
  return (
    <>
      <SiteHeader />
      <main><Suspense fallback={<p className="p-6 text-ink-2">Loading…</p>}><YearView /></Suspense></main>
      <SiteFooter />
    </>
  );
}
