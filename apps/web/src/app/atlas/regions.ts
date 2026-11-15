import regionsFile from "@data/generated/regions.json";
import continentsFile from "@data/generated/continents.json";
import type { Region } from "@/components/HistoryAtlas";

// Countries, plus each continent as a merged map of its countries' events.
export const atlasRegions = [...continentsFile.continents, ...regionsFile.regions] as Region[];

export const world: Region = {
  id: "world",
  label: { en: "The world" },
  kind: "world",
  imported: 0,
  bbox: null,
  note: "The best-documented events from every country. Events tied to many countries are listed under multiple regions.",
};
