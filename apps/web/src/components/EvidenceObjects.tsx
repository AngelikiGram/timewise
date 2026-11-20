"use client";

import { useEffect, useState } from "react";
import { Icon } from "./icons";

// Records about an event, from cultural heritage collections: newspapers, photographs, prints, postcards.
// They are evidence about the event, not the event itself, and each keeps its holder and rights.
// Europeana's public API key "api2demo" is meant for exactly this kind of open demo use.
const API = "https://api.europeana.eu/record/v2/search.json";
const ONB = "Austrian National Library";

type Item = { id: string; title: string; year?: string; type?: string; provider?: string; thumb?: string; link: string; rights?: string };
type EuItem = { id: string; title?: string[]; year?: string[]; type?: string; dataProvider?: string[]; edmPreview?: string[]; guid?: string; rights?: string[] };

/** A rights URL as a short, honest label. */
function rightsLabel(url?: string) {
  if (!url) return "Rights not stated";
  if (url.includes("publicdomain/mark") || url.includes("publicdomain/zero")) return "Public domain";
  if (url.includes("/NoC-")) return "No copyright, with conditions";
  if (url.includes("/InC")) return "In copyright";
  const m = url.match(/licenses\/([a-z-]+)\//);
  return m ? `CC ${m[1].toUpperCase()}` : "See the item for rights";
}

async function search(query: string, years: [number, number] | null, provider?: string): Promise<{ items: Item[]; total: number }> {
  const qf = [years ? `YEAR:[${years[0]} TO ${years[1]}]` : null, provider ? `DATA_PROVIDER:"${provider}"` : null].filter(Boolean) as string[];
  const params = new URLSearchParams({ wskey: "api2demo", query, rows: "6", profile: "standard" });
  qf.forEach((q) => params.append("qf", q));
  const r = await fetch(`${API}?${params}`);
  if (!r.ok) throw new Error(String(r.status));
  const d = (await r.json()) as { items?: EuItem[]; totalResults?: number };
  return {
    total: d.totalResults ?? 0,
    items: (d.items ?? []).map((i) => ({
      id: i.id, title: i.title?.[0] ?? "Untitled", year: i.year?.[0], type: i.type, provider: i.dataProvider?.[0],
      thumb: i.edmPreview?.[0], link: i.guid ?? `https://www.europeana.eu/item${i.id}`, rights: i.rights?.[0],
    })),
  };
}

/**
 * Historical records that may relate to an event, searched live by its name and years. Matches are by words
 * and dates, not verified, and say so. Austrian events look in the Austrian National Library's holdings first.
 */
export function EvidenceObjects({ title, start, precision, austrian }: { title: string; start: string; precision?: string; austrian?: boolean }) {
  const [state, setState] = useState<"loading" | "done" | "failed">("loading");
  const [found, setFound] = useState<{ items: Item[]; total: number; from: string } | null>(null);
  const year = start.startsWith("-") ? null : Number(start.slice(0, 4));
  const years: [number, number] | null = year ? [year - 2, year + 3] : null;
  const name = title.replace(/\s*\(.*?\)\s*/g, " ").trim();

  useEffect(() => {
    let live = true;
    setState("loading");
    (async () => {
      // Austrian events: the national library first, then everyone.
      if (austrian) {
        const onb = await search(name, years, ONB).catch(() => null);
        if (onb?.items.length) return { ...onb, from: `the ${ONB}, via Europeana` };
      }
      const all = await search(name, years);
      return { ...all, from: "Europeana's member collections" };
    })().then((r) => { if (live) { setFound(r); setState("done"); } }, () => { if (live) setState("failed"); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, start, austrian]);

  const day = precision === "day" && year && year >= 1700 && year <= 1950 ? start.slice(0, 10).replace(/-/g, "") : null;

  return (
    <div data-testid="evidence-objects">
      <p className="text-sm text-ink-2">Records <em>about</em> this event: newspapers, images and objects from the time. They are evidence, not the event, and matches are by name and date, so check each one.</p>
      {state === "loading" && <div className="mt-3 grid grid-cols-3 gap-2" aria-busy>{[0, 1, 2].map((i) => <div key={i} className="skeleton aspect-square rounded-md" />)}</div>}
      {state === "failed" && <p className="mt-3 text-sm text-ink-2">Europeana couldn&rsquo;t be reached.</p>}
      {state === "done" && found && (found.items.length ? (
        <>
          <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {found.items.map((i) => (
              <li key={i.id}>
                <a href={i.link} target="_blank" rel="noopener noreferrer" className="group block overflow-hidden rounded-md border border-line bg-paper-2 hover:border-bronze">
                  {i.thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={i.thumb} alt="" loading="lazy" className="aspect-square w-full object-cover" />
                  ) : (
                    <span className="grid aspect-square place-items-center text-ink-2"><Icon name="source" size={28} /></span>
                  )}
                  <span className="block p-2 text-xs">
                    <span className="line-clamp-2 font-medium text-ink group-hover:text-bronze">{i.title}</span>
                    <span className="mt-0.5 block text-ink-2">{[i.year, i.type?.toLowerCase()].filter(Boolean).join(", ")}</span>
                    <span className="mt-0.5 block truncate text-ink-2">{i.provider}</span>
                    <span className="mt-0.5 block text-ink-2">{rightsLabel(i.rights)}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink-2">{found.total.toLocaleString("en")} matches in {found.from}{years ? `, ${years[0]}–${years[1]}` : ""}.</p>
        </>
      ) : (
        <p className="mt-3 text-sm text-ink-2">No items in Europeana match this name{years ? ` between ${years[0]} and ${years[1]}` : ""}.</p>
      ))}
      <ul className="mt-3 grid gap-1 text-sm">
        {day && <li><a className="link" href={`https://anno.onb.ac.at/cgi-content/anno?datum=${day}`} target="_blank" rel="noopener noreferrer">Newspapers from this day in ANNO (Austrian National Library) ↗</a></li>}
        <li><a className="link" href={`https://www.europeana.eu/en/search?query=${encodeURIComponent(name)}`} target="_blank" rel="noopener noreferrer">Search Europeana yourself ↗</a></li>
        <li><a className="link" href={`https://www.loc.gov/search/?q=${encodeURIComponent(name)}`} target="_blank" rel="noopener noreferrer">Search the Library of Congress ↗</a></li>
      </ul>
    </div>
  );
}
