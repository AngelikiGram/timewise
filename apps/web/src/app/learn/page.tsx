import type { Metadata } from "next";
import { Suspense } from "react";
import { activityById, activitiesByJourney } from "@/lib/learning-activities";
import { LearningHub } from "@/components/learn/LearningHub";

export const generateStaticParams = () => [
  { journey: "austria-1848-1921" },
];

export async function generateMetadata({ params }: { params: Promise<{ journey?: string }> }): Promise<Metadata> {
  const { journey } = await params;
  return {
    title: "Learning Hub · TIMEWISE",
    description: "Master historical thinking skills through evidence-grounded activities"
  };
}

function Loading() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-paper">
      <p className="text-xl text-ink-2">Loading Learning Hub...</p>
    </div>
  );
}

export default function LearnPage({ searchParams }: { searchParams: Promise<{ journey?: string; chapter?: string; activity?: string }> }) {
  return (
    <Suspense fallback={<Loading />}>
      <LearningHub />
    </Suspense>
  );
}