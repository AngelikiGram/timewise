import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { DetectiveCase } from "@/components/challenges/DetectiveCase";

export const metadata: Metadata = { title: "The case of the missing opening day · TIMEWISE", description: "A detective case: when did Vienna's Ringstrasse open?" };

export default function RingstrasseCasePage() {
  return (
    <>
      <SiteHeader />
      <main className="px-4 pb-16 pt-6 sm:px-6"><DetectiveCase /></main>
    </>
  );
}
