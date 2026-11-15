import type { Metadata } from "next";
import { CollectionView } from "@/components/CollectionView";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = { title: "My Collection · TIMEWISE", description: "Your bookmarks, notes, collections and progress, saved in this browser." };

export default function CollectionPage() {
  return (
    <>
      <SiteHeader />
      <CollectionView />
    </>
  );
}
