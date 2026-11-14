import type { Metadata } from "next";
import { Workspace } from "@/components/Workspace";

export const metadata: Metadata = { title: "Explore · TIMEWISE" };

// The hand-checked investigation: map, timeline and evidence for one event at a time.
// Links such as /explore?event=… and /explore?investigation=… open here. The country picker is at /atlas.
export default function ExplorePage() {
  return <Workspace />;
}
