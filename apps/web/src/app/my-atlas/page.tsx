import type { Metadata } from "next";
import { Suspense } from "react";
import { MyAtlas } from "@/components/atlas/MyAtlas";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = { title: "My history atlas · TIMEWISE", description: "The people, places and events you've learned about, and the sourced links between them." };

export default function MyAtlasPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <Suspense fallback={<p className="p-6 text-ink-2">Loading your atlas…</p>}>
          <MyAtlas />
        </Suspense>
      </main>
    </>
  );
}
