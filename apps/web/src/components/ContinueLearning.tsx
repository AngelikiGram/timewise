"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatImportedDate } from "@/lib/dates";
import { useProgress } from "@/lib/progress";
import { recent, type Recent } from "@/lib/recent";
import { STORIES } from "@/lib/stories";

/** "Continue your journey": an unfinished story first, then recently opened events. Shown only when there's something to continue. */
export function ContinueLearning() {
  const [items, setItems] = useState<Recent[]>([]);
  const p = useProgress();
  useEffect(() => setItems(recent()), []);
  const unfinished = STORIES.map((s) => ({ s, saved: p.stories[s.id] })).filter((x) => x.saved && !x.saved.finished).sort((a, b) => b.saved!.updatedAt.localeCompare(a.saved!.updatedAt));
  if (!items.length && !unfinished.length) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 pb-2 pt-8 sm:px-6" aria-labelledby="continue" data-testid="continue">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="continue" className="font-serif text-2xl sm:text-3xl">Continue your journey</h2>
        <Link href="/collection" className="link text-sm">My Collection →</Link>
      </div>
      <ul className="mt-4 flex gap-3 overflow-x-auto pb-2">
        {unfinished.map(({ s, saved }) => {
          const chapter = s.chapters.find((c) => c.id === saved!.chapterId);
          return (
            <li key={s.id} className="w-72 shrink-0">
              <Link href={s.kind === "journey" ? `${s.href}?chapter=${saved!.chapterId}&step=${saved!.step}` : s.href} className="card block h-full border-bronze/60 p-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-bronze">Unfinished story</span>
                <span className="mt-1 block font-serif text-lg leading-snug">{s.title}</span>
                {chapter && <span className="mt-1 block text-sm text-ink-2">Next: {chapter.title}</span>}
              </Link>
            </li>
          );
        })}
        {items.map((r) => (
          <li key={r.id} className="w-64 shrink-0">
            <Link href={r.href} className="card block h-full p-4">
              <span className="text-xs text-ink-2">{formatImportedDate(r.start, undefined, "year")} · {r.context}</span>
              <span className="mt-1 block font-serif text-lg leading-snug">{r.title}</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="text-xs text-ink-2">Saved in this browser only.</p>
    </section>
  );
}
