import type { Metadata } from "next";
import { notFound } from "next/navigation";
import regionsFile from "@data/generated/regions.json";
import continentsFile from "@data/generated/continents.json";
import { HistoryAtlas } from "@/components/HistoryAtlas";

type Props = { params: Promise<{ region: string }> };

// Countries, plus each continent as a merged map of its countries' events.
const regions = [...continentsFile.continents, ...regionsFile.regions];

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
