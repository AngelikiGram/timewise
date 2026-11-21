import type { Metadata } from "next";
import { MemoryReview } from "@/components/lessons/MemoryReview";
import { ReviewHub } from "@/components/lessons/ReviewHub";
import { BadgeToast } from "@/components/modes/Gamify";
import { ReviewSession } from "@/components/lessons/ReviewSession";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = { title: "Review | TIMEWISE", description: "Questions you missed, asked again with their explanations." };

export default function ReviewPage() {
  return (
    <>
      <SiteHeader />
      <main><BadgeToast /><ReviewHub /><ReviewSession /><MemoryReview /></main>
    </>
  );
}
