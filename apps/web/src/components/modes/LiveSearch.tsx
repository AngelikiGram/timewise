"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { fold } from "@/lib/search";
import { recordLookup } from "@/lib/explorer";
import type { Hit } from "@/lib/live";
import { Icon } from "../icons";

type Local = { id: string; label: string; sub?: string; href: string };

/**
 * Search the prebuilt collection first, then Wikidata live. Prebuilt matches open at once; a Wikidata match
 * opens a page made from Wikidata now, which says so.
 */
export function LiveSearch({ placeholder, local, live, hrefFor, label, testId, prefetch }: {
  placeholder: string; local: Local[]; live: (text: string, signal: AbortSignal) => Promise<Hit[]>; hrefFor: (h: Hit) => string; label: string; testId?: string;
  /** Start loading a result while the pointer is on it, so it opens faster. */ prefetch?: (h: Hit) => void;
}) {
  const router = useRouter();
  const id = useId();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const liveRef = useRef(live);
  liveRef.current = live;
  const mine = useMemo(() => { const f = fold(q.trim()); return f.length < 2 ? [] : local.filter((x) => fold(`${x.label} ${x.sub ?? ""}`).includes(f)).slice(0, 5); }, [q, local]);
  useEffect(() => {
    if (q.trim().length < 2) { setHits(null); setErr(null); return; }
    const ac = new AbortController();
    const t = setTimeout(() => {
      setBusy(true);
      liveRef.current(q, ac.signal).then((h) => { setHits(h); setErr(null); }, (e: Error) => { if (e.name !== "AbortError") setErr(e.message); }).finally(() => setBusy(false));
    }, 350);
    return () => { clearTimeout(t); ac.abort(); };
  }, [q]);
  const localIds = new Set(local.map((x) => x.id));
  const fresh = (hits ?? []).filter((h) => !localIds.has(h.id));
  const open = (h: Hit) => { recordLookup(); router.push(hrefFor(h)); };

  return (
    <div className="relative" data-testid={testId}>
      <label htmlFor={id} className="sr-only">{label}</label>
      <div className="flex items-center gap-2 rounded-xl border-2 border-line bg-paper px-3 focus-within:border-bronze">
        <Icon name="search" size={18} className="text-ink-2" />
        <input id={id} value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} autoComplete="off" className="min-w-0 flex-1 bg-transparent py-2.5 outline-none"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (mine[0]) router.push(mine[0].href); else if (fresh[0]) open(fresh[0]); } if (e.key === "Escape") setQ(""); }} />
        {busy && <span className="text-xs text-ink-2" role="status">Asking Wikidata…</span>}
      </div>
      {q.trim().length >= 2 && (
        <div className="absolute inset-x-0 top-full z-30 mt-1 max-h-[26rem] overflow-y-auto rounded-xl border border-line bg-paper p-1 shadow-lg" data-testid="live-results">
          {mine.length > 0 && <p className="px-3 pt-2 text-[11px] font-semibold text-ink-2">Ready in TIMEWISE</p>}
          {mine.map((x) => <Link key={x.id} href={x.href} className="block rounded-lg px-3 py-2 hover:bg-paper-2"><span className="font-medium">{x.label}</span>{x.sub && <span className="block text-xs text-ink-2">{x.sub}</span>}</Link>)}
          {fresh.length > 0 && <p className="px-3 pt-2 text-[11px] font-semibold text-ink-2">Look up on Wikidata now</p>}
          {fresh.map((h) => (
            <button key={h.id} type="button" onClick={() => open(h)} onMouseEnter={() => prefetch?.(h)} onFocus={() => prefetch?.(h)} className="flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left hover:bg-paper-2">
              <span className="min-w-0 flex-1"><span className="font-medium">{h.label}</span>{h.description && <span className="block text-xs text-ink-2">{h.description}</span>}</span>
              <span className="shrink-0 text-[10px] text-ink-2">{h.id}</span>
            </button>
          ))}
          {err && <p className="px-3 py-2 text-sm text-oxblood">{err}</p>}
          {!busy && !err && hits && !mine.length && !fresh.length && <p className="px-3 py-2 text-sm text-ink-2">Nothing on Wikidata by that name.</p>}
        </div>
      )}
    </div>
  );
}
