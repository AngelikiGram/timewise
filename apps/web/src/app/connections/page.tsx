import type { Metadata } from "next";
import { Suspense } from "react";
import { NetworkExplorer } from "@/components/network/NetworkExplorer";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Explore connections · TIMEWISE",
  description: "Search any event, person, place, invention or idea and follow its documented links from record to record.",
};

export default function ConnectionsPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <Suspense fallback={<p className="p-6 text-ink-2">Loading the explorer…</p>}>
          <NetworkExplorer />
        </Suspense>
      </main>
    </>
  );
}
