import type { Metadata } from "next";
import { BeginCards } from "@/components/modes/BeginCards";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = { title: "Where to begin · TIMEWISE", description: "Four ways into history: follow a thing, explore a year, follow a life, or follow your interests." };

export default function Page() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6"><BeginCards /></main>
      <SiteFooter />
    </>
  );
}
