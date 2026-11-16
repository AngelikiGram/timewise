import type { Metadata } from "next";
import { Suspense } from "react";
import { LearnHome } from "@/components/lessons/LearnHome";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Learn · TIMEWISE",
  description: "Short history lessons built from sourced records, with questions, explanations and a path to follow.",
};

export default function LearnPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <Suspense fallback={<p className="p-6 text-ink-2">Loading your lessons…</p>}>
          <LearnHome />
        </Suspense>
      </main>
    </>
  );
}
