import type { Metadata } from "next";
import { Suspense } from "react";
import { FactOrMyth } from "@/components/play/FactOrMyth";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = { title: "Fact or myth? · TIMEWISE", description: "Judge claims about famous lives as supported, uncertain or marked wrong, then see what the record says." };

export default function Page() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6">
        <Suspense fallback={<p className="p-6 text-ink-2">Loading…</p>}>
          <FactOrMyth />
        </Suspense>
      </main>
    </>
  );
}
