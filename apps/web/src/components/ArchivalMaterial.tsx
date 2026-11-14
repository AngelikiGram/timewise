"use client";

import { useEffect, useState } from "react";
import { API_URL, RELATION_LABELS, type Relation } from "@/lib/api";

type Item = {
  id: number; title: string; creator: string | null; date_text: string | null; institution: string | null; url: string | null;
  media_rights: string | null; preview_url: string | null; claim_id: string; relation: Relation; note: string;
};

/** Records a reviewer linked to this event. Stays silent if the API is down: the rest of the panel doesn't depend on it. */
export function ArchivalMaterial({ eventId }: { eventId: string }) {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    let current = true;
    setItems([]);
    fetch(`${API_URL}/events/${encodeURIComponent(eventId)}/archive`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => current && setItems(rows))
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [eventId]);

  if (!items.length) return null;
  return (
    <div data-testid="archival-material">
      <h3 className="eyebrow mb-2">Archival material</h3>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={`${item.id}-${item.claim_id}`} className="border border-line bg-paper-2 p-3 text-sm">
            {item.preview_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.preview_url} alt={item.title} loading="lazy" className="mb-2 max-h-56 w-full border border-line object-cover" />
            )}
            <p className="text-xs font-semibold uppercase tracking-wider text-bronze" title={RELATION_LABELS[item.relation].help}>{RELATION_LABELS[item.relation].label}</p>
            <p title={item.title} className="mt-1 line-clamp-3 font-serif text-base leading-snug">{item.title}</p>
            <p className="mt-1 text-ink-2">{item.note}</p>
            <p className="mt-2 text-xs text-ink-2">
              {/* Some providers give an authority-file URL or "unknown" (Swedish: okänd) as the creator. */}
              {[item.creator && !/^https?:|^okänd$/i.test(item.creator) ? item.creator : null, item.date_text, item.institution].filter(Boolean).join(" · ")}
            </p>
            {item.url && <a href={item.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs font-medium text-bronze underline-offset-2 hover:underline">View at Europeana ↗</a>}
            {!item.preview_url && <p className="mt-1 text-xs italic text-ink-2">The image isn&rsquo;t shown here because of its rights. Follow the link to see it.</p>}
            {item.media_rights && <p className="mt-1 break-words text-xs text-ink-2">Rights, as stated by the provider: {item.media_rights}</p>}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-ink-2">Linked by a site reviewer, not yet checked by a historian. A link doesn&rsquo;t change how well supported a claim is.</p>
    </div>
  );
}
