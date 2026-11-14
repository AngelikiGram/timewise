"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { WorldCoverageMap } from "./WorldCoverageMap";

interface Region {
  id: string;
  label: { en: string; [key: string]: string };
  iso?: string | null;
  note: string;
  imported: number;
  curated?: boolean;
}

interface RegionsData {
  regions: Region[];
}

interface RegionSelectorProps {
  currentRegion?: string;
}

/** A flag emoji from a two-letter ISO code. Kosovo's XK has no Unicode flag, so it shows a globe. */
function flag(iso?: string | null): string {
  if (!iso || !/^[A-Z]{2}$/.test(iso) || iso === "XK") return "🌍";
  return String.fromCodePoint(...[...iso].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

// Track which regions have been prefetched to avoid duplicate requests
const prefetchedRegions = new Set<string>();

function prefetchRegionData(regionId: string) {
  if (prefetchedRegions.has(regionId)) return;
  prefetchedRegions.add(regionId);
  // Prefetch both events and boundary data
  fetch(`/data/regions/${regionId}.json`, { priority: "low" }).catch(() => {});
  fetch(`/data/regions/${regionId}.boundary.json`, { priority: "low" }).catch(() => {});
}

export function RegionSelector({ currentRegion }: RegionSelectorProps) {
  const pathname = usePathname();
  const activeRegion = currentRegion ?? (pathname?.startsWith("/explore/") ? pathname.split("/")[2] : "");
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const shown = regions.filter((r) => r.label.en.toLowerCase().includes(query.trim().toLowerCase()));

  useEffect(() => {
    async function loadRegions() {
      try {
        const res = await fetch("/data/regions.json");
        const data: RegionsData = await res.json();
        setRegions(data.regions);
      } catch (e) {
        console.error("Failed to load regions:", e);
      } finally {
        setLoading(false);
      }
    }
    loadRegions();
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center bg-paper-2">
        <p className="text-ink-2">Loading regions…</p>
      </div>
    );
  }

  return (
    <section aria-label="Select region" className="p-5 sm:p-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 text-center">
          <h1 className="font-serif text-3xl sm:text-4xl leading-tight">{currentRegion ? "Explore History" : "History by country"}</h1>
          <p className="mt-2 text-ink-2">{currentRegion ? "Choose a country or region to investigate its timeline, maps, and primary sources." : "Choose a country to open its atlas: a map, a timeline by century, and every event imported for it."}</p>
        </header>

        {!currentRegion && (
          <div className="mb-8">
            <WorldCoverageMap regions={regions} />
          </div>
        )}

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <label className="flex-1 min-w-[12rem]">
            <span className="sr-only">Find a country</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a country"
              className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm"
            />
          </label>
          <p className="text-sm text-ink-2" aria-live="polite">
            {shown.length} of {regions.length} countries with imported events
          </p>
        </div>

        {!currentRegion ? (
          <table className="w-full text-sm" data-testid="coverage-table">
            <caption className="sr-only">Countries with imported events</caption>
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-2">
                <th scope="col" className="py-2 font-normal">Country</th>
                <th scope="col" className="py-2 text-right font-normal">Imported events</th>
                <th scope="col" className="hidden py-2 pl-6 font-normal sm:table-cell">Status</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((region) => (
                <tr key={region.id} className="border-b border-line hover:bg-paper-2">
                  <th scope="row" className="py-2 text-left font-normal">
                    <Link
                      href={`/atlas/${region.id}`}
                      onMouseEnter={() => prefetchRegionData(region.id)}
                      className="flex items-center gap-2 font-serif text-base hover:text-bronze"
                    >
                      <span aria-hidden="true" className="w-7 shrink-0 text-xs text-ink-2">{flag(region.iso)}</span>
                      {region.label.en}
                    </Link>
                  </th>
                  <td className="py-2 text-right tabular-nums">{region.imported.toLocaleString("en")}</td>
                  <td className="hidden py-2 pl-6 text-ink-2 sm:table-cell">{region.curated ? "Hand-checked records and imports" : "Imported, not reviewed"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" role="list">
            {shown.map((region) => {
              const isActive = region.id === activeRegion;
              return (
                <li key={region.id}>
                  <Link
                    href={`/atlas/${region.id}`}
                    onMouseEnter={() => prefetchRegionData(region.id)}
                    className={`group relative block rounded-lg border bg-paper p-5 transition-all ${isActive ? "border-bronze ring-2 ring-bronze/30 shadow-xl" : "border-line hover:border-bronze hover:shadow-xl"}`}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <div className="flex items-start gap-3">
                      <span className="shrink-0 text-3xl" aria-hidden="true">
                        {flag(region.iso)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h2 className={`font-serif text-lg font-medium transition-colors ${isActive ? "text-bronze" : "group-hover:text-bronze"}`}>
                          {region.label.en}
                        </h2>
                        <p className="mt-1 text-sm text-ink-2 line-clamp-2">{region.note}</p>
                        <div className="mt-2 flex items-center gap-2 text-xs text-ink-2">
                          <span className="inline-flex items-center gap-1 rounded-full border bg-paper-2 px-2 py-0.5">
                            {region.imported > 0 ? (
                              <>
                                <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-bronze" : "bg-ink-2"}`} aria-hidden="true" />
                                {region.imported.toLocaleString()} imported events
                              </>
                            ) : (
                              <span className="text-ink-3">No data imported yet</span>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                    {isActive && (
                      <div className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-bronze/10 text-bronze text-xs font-medium">
                        ✓
                      </div>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <p className="mt-8 text-center text-sm text-ink-2">
          Imported events come from Wikidata and nobody here has reviewed them, so treat them as leads.
          Countries with hand-checked records, so far only Austria, also have verified events, claims and evidence.
        </p>
      </div>
    </section>
  );
}