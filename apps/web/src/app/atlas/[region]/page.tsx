import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HistoryAtlas } from "@/components/HistoryAtlas";
import { atlasRegions as regions } from "../regions";

type Props = { params: Promise<{ region: string }> };

export const generateStaticParams = () => regions.map((r) => ({ region: r.id }));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = (await params).region;
  return { title: `${regions.find((r) => r.id === id)?.label.en ?? "History"} · TIMEWISE` };
}

export default async function AtlasPage({ params }: Props) {
  const id = (await params).region;
  const region = regions.find((r) => r.id === id);
  if (!region) notFound();
  return <HistoryAtlas region={region} regions={regions} />;
}
