"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { JourneyPlayer } from "@/components/JourneyPlayer";
import { eventById, journeyById } from "@/lib/collection";
import { generateJourneyFromEvents, type GeneratedJourney } from "@/lib/auto-journey";
import Link from "next/link";

export default function AutoJourneyPlayPage({ searchParams }: { searchParams: Promise<{ events?: string; title?: string }> }) {
  const [journeyId, setJourneyId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    searchParams.then(params => {
      const eventIdsParam = params.events;
      const title = params.title || "Auto-Generated Journey";

      if (!eventIdsParam) {
        setError("No events specified for journey");
        setIsLoading(false);
        return;
      }

      const eventIds = eventIdsParam.split(",").filter(Boolean);

      try {
        const generated = generateJourneyFromEvents({
          eventIds,
          title,
          description: `Auto-generated journey through ${eventIds.length} events`,
        });

        // Save the journey to localStorage so JourneyPlayer can find it
        const journeyKey = `auto-journey-${Date.now()}`;
        localStorage.setItem(journeyKey, JSON.stringify({
          ...generated.journey,
          id: journeyKey,
        }));

        // Also store in journeyById for immediate access
        // Note: journeyById is a Map, so we'd need to add it there too
        // For now, just use localStorage and navigate
        setJourneyId(journeyKey);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to generate journey");
      } finally {
        setIsLoading(false);
      }
    });
  }, [searchParams]);

  if (isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-paper">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-navy border-t-transparent mx-auto mb-4" />
          <p className="text-xl text-ink-2">Loading journey...</p>
        </div>
      </div>
    );
  }

  if (error || !journeyId) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-paper">
        <div className="text-center p-8">
          <Link href="/journey/auto" className="text-bronze hover:underline">
            ← Back to Journey Generator
          </Link>
          <h1 className="font-serif text-2xl text-oxblood mt-4">Unable to Load Journey</h1>
          <p className="text-ink-2 mt-2">{error || "Unknown error"}</p>
        </div>
      </div>
    );
  }

  return <JourneyPlayer id={journeyId} />;
}