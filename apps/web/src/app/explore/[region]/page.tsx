import { notFound, permanentRedirect } from "next/navigation";
import regionsFile from "@data/generated/regions.json";

type Props = { params: Promise<{ region: string }> };

const regions = regionsFile.regions;

export const generateStaticParams = () => regions.map((r) => ({ region: r.id }));

/**
 * Old address for a country's events. It used the curated Austria map, which drew Austria's
 * railways for every country and couldn't place imported events, so it now opens the country atlas.
 */
export default async function ExploreRegionPage({ params }: Props) {
  const { region } = await params;
  if (!regions.some((r) => r.id === region)) notFound();
  permanentRedirect(`/atlas/${region}`);
}
