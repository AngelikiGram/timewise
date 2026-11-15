import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { ChallengeHub } from "@/components/challenges/ChallengeHub";

export const metadata: Metadata = { title: "Challenges · TIMEWISE", description: "Daily history puzzles and a detective case, built from sourced evidence." };

export default function ChallengesPage() {
  return (
    <>
      <SiteHeader />
      <ChallengeHub />
    </>
  );
}
