import type { Metadata } from "next";
import { HistoryAtlas } from "@/components/HistoryAtlas";
import { atlasRegions, world } from "./regions";

export const metadata: Metadata = { title: "World Map · TIMEWISE", description: "Explore where and when history happened, on a map with a timeline." };

export default function WorldMapPage() {
  return <HistoryAtlas region={world} regions={atlasRegions} />;
}
