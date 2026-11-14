import type { Metadata } from "next";
import { Overview } from "@/components/Overview";
import { atlasFor, tabs, worldView } from "./data";

export const metadata: Metadata = { title: "History of the world · TIMEWISE" };

export default function WorldHistoryPage() {
  const { data, countries } = worldView();
  return <Overview data={data} countries={countries} tabs={tabs} mapHref="/atlas" atlasFor={atlasFor} />;
}
