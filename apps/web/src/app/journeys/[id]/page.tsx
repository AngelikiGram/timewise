import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JourneyPlayer } from "@/components/JourneyPlayer";
import { journeyById, journeys } from "@/lib/collection";

type Props = { params: Promise<{ id: string }> };

export const generateStaticParams = () => journeys.map((j) => ({ id: j.id }));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const journey = journeyById.get((await params).id);
  return { title: journey ? `${journey.title.en} · TIMEWISE` : "TIMEWISE", description: journey?.subtitle.en };
}

export default async function JourneyPage({ params }: Props) {
  const journey = journeyById.get((await params).id);
  if (!journey) notFound();
  return <JourneyPlayer id={journey.id} />;
}
