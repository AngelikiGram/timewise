import type { Metadata } from "next";
import { Suspense } from "react";
import { ProfileView } from "@/components/profile/ProfileView";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = { title: "Profile · TIMEWISE", description: "Your learning progress, interests and learning map, kept in this browser." };

export default function ProfilePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <Suspense fallback={<p className="p-6 text-ink-2">Loading your profile…</p>}>
          <ProfileView />
        </Suspense>
      </main>
    </>
  );
}
