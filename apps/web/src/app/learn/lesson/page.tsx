import type { Metadata } from "next";
import { Suspense } from "react";
import { LessonPlayer } from "@/components/lessons/LessonPlayer";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = { title: "Lesson · TIMEWISE", description: "A short history lesson from sourced records." };

export default function LessonPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <Suspense fallback={<p className="p-6 text-ink-2">Loading the lesson…</p>}>
          <LessonPlayer />
        </Suspense>
      </main>
    </>
  );
}
