"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { eventsByDate, formatWhen, placeLabel } from "@/lib/collection";
import { AtlasMap } from "./AtlasMap";

// Visits every event in date order, like opening an atlas at each page in turn.
export function HeroAtlas() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % eventsByDate.length), 5200);
    return () => clearInterval(timer);
  }, []);

  const event = eventsByDate[index];
  return (
    <div className="relative h-full min-h-[340px] overflow-hidden border border-line">
      <AtlasMap events={eventsByDate} selectedId={event.id} date={event.when.start} interactive={false} focusZoom={5.6} />
      <Link href={`/explore?event=${event.id}`} key={event.id} className="fade-in absolute inset-x-3 bottom-8 block border border-line bg-paper-2/95 p-4 backdrop-blur transition-colors hover:border-bronze sm:left-auto sm:right-4 sm:w-80">
        <span className="eyebrow">{formatWhen(event.when)}, {placeLabel(event)}</span>
        <span className="mt-1 block font-serif text-xl leading-tight">{event.title.en}</span>
        <span className="mt-2 block text-xs text-bronze">Inspect the evidence</span>
      </Link>
    </div>
  );
}
