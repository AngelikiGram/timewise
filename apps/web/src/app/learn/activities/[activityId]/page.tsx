import { activityById } from "@/lib/learning-activities";
import ActivityPlayer from "./ActivityPlayer";
import { Metadata } from "next";

// Static export: pre-render all activity IDs
export async function generateStaticParams() {
  const ids = Array.from(activityById.keys());
  return ids.map(id => ({ activityId: id }));
}

export async function generateMetadata({ params }: { params: Promise<{ activityId: string }> }): Promise<Metadata> {
  const { activityId } = await params;
  const activity = activityById.get(activityId);
  return {
    title: activity?.prompt.en ? `${activity.prompt.en.split(".")[0]} | Timewise Learning` : "Learning Activity | Timewise",
    description: activity?.prompt.en,
  };
}

export default async function ActivityPage({ params }: { params: Promise<{ activityId: string }> }) {
  const { activityId } = await params;

  return <ActivityPlayer activityId={activityId} journeyId="" chapterId={undefined} />;
}