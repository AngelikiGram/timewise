import type { Metadata } from "next";
import { Suspense } from "react";
import { WhyView } from "@/components/modes/WhyView";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = { title: "Why did this happen? · TIMEWISE", description: "An event's documented causes and consequences as a network you can grow." };

export default function Page() {
  return (
    <>
      <SiteHeader />
      <main>
        <Suspense fallback={<p className="p-6 text-ink-2">Loading…</p>}>
          <WhyView />
        </Suspense>
      </main>
    </>
  );
}
