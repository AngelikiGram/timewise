import type { Metadata } from "next";
import { notFound } from "next/navigation";
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

export default async function LearnPage({ searchParams }: { searchParams: Promise<{ journey?: string; chapter?: string; activity?: string }> }) {
  const { journey, chapter, activity } = await searchParams;
  const journeyId = journey || "austria-1848-1921";

  const activities = activitiesByJourney(journeyId);
  if (activities.length === 0) notFound();

  return (
    <LearningHub
      initialJourneyId={journeyId}
      initialChapterId={chapter || ""}
      initialActivityId={activity || ""}
    />
  );
}