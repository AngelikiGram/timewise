"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatImportedDate } from "@/lib/dates";
import { recent, type Recent } from "@/lib/recent";

/** Recently opened events. Stored in this browser only, so it's empty on a new device. */
export function ContinueLearning() {
  const [items, setItems] = useState<Recent[]>([]);
  useEffect(() => setItems(recent()), []);
  if (!items.length) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 pb-4 pt-10 sm:px-6" aria-labelledby="continue">
      <h2 id="continue" className="font-serif text-3xl">Continue where you left off</h2>
      <p className="mt-1 text-sm text-ink-2">Saved in this browser only.</p>
      <ul className="mt-4 flex gap-3 overflow-x-auto pb-2">
        {items.map((r) => (
          <li key={r.id} className="w-64 shrink-0">
            <Link href={r.href} className="block h-full rounded-sm border border-line bg-paper-2 p-4 hover:border-bronze">
              <span className="text-sm text-ink-2">{formatImportedDate(r.start, undefined, "year")} · {r.context}</span>
              <span className="mt-1 block font-serif text-lg leading-snug">{r.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
