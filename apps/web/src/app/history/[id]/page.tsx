import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Overview } from "@/components/Overview";
import { atlasFor, continentIds, continentView, tabs } from "../data";

type Props = { params: Promise<{ id: string }> };

export const generateStaticParams = () => continentIds.map((id) => ({ id }));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const view = continentView((await params).id);
  return { title: view ? `History of ${view.data.label} · TIMEWISE` : "History · TIMEWISE" };
}

export default async function ContinentHistoryPage({ params }: Props) {
  const { id } = await params;
  const view = continentView(id);
  if (!view) notFound();
  return <Overview data={view.data} countries={view.countries} tabs={tabs} mapHref={`/atlas/${id}`} atlasFor={atlasFor} />;
}
