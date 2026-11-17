import type { Metadata } from "next";
import { Suspense } from "react";
import { LifeView } from "@/components/modes/LifeView";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = { title: "Follow a life · TIMEWISE", description: "A documented person's years, works, places and the people around them." };

export default function Page() {
  return (
    <>
      <SiteHeader />
      <main><Suspense fallback={<p className="p-6 text-ink-2">Loading…</p>}><LifeView /></Suspense></main>
      <SiteFooter />
    </>
  );
}
