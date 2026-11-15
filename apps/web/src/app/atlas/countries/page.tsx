import type { Metadata } from "next";
import { RegionSelector } from "@/components/RegionSelector";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = { title: "Countries by coverage · TIMEWISE" };

// Every country at once: how much has been imported where, and a way into each country's atlas.
export default function CountriesPage() {
  return (
    <div className="min-h-dvh bg-paper">
      <SiteHeader />
      <main>
        <RegionSelector />
      </main>
    </div>
  );
}
