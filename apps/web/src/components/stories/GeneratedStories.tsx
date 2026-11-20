"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fold } from "@/lib/dedupe";
import { useProgress } from "@/lib/progress";
import { Icon } from "../icons";
import { loadStoryIndex, type StoryEntry } from "./StoryReader";

const ERAS: { id: string; label: string }[] = [
  { id: "all", label: "All eras" },
  { id: "antiquity", label: "Antiquity" },
  { id: "middle-ages", label: "Middle Ages" },
  { id: "early-modern", label: "1500–1800" },
  { id: "long-19th", label: "1800–1914" },
  { id: "world-wars", label: "1914–1945" },
  { id: "since-1945", label: "Since 1945" },
];
const PAGE = 24;

/** Every generated story, filterable by era, by country or continent, and by name. */
export function GeneratedStories() {
  const p = useProgress();
  const [all, setAll] = useState<StoryEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [era, setEra] = useState("all");
  const [kind, setKind] = useState<"all" | "chain" | "episodes" | "place">("all");
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(PAGE);
  useEffect(() => { loadStoryIndex().then((d) => setAll(d.stories), () => setFailed(true)); }, []);
  useEffect(() => setShown(PAGE), [era, kind, q]);
  const list = useMemo(() => (all ?? []).filter((s) => (era === "all" || s.era === era) && (kind === "all" || s.kind === kind) && (!q.trim() || fold(`${s.title} ${s.places.join(" ")}`).includes(fold(q)))), [all, era, kind, q]);

  return (
    <div data-testid="generated-stories">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div role="radiogroup" aria-label="Era" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [&>*]:shrink-0">
          {ERAS.map((e) => <button key={e.id} type="button" role="radio" aria-checked={era === e.id} data-on={era === e.id} className="chip" onClick={() => setEra(e.id)}>{e.label}</button>)}
        </div>
        <div className="flex gap-2 lg:ml-auto">
          <label><span className="sr-only">Kind of story</span>
            <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="field !py-1.5 text-sm">
              <option value="all">All kinds</option>
              <option value="chain">Chains: how A led to B</option>
              <option value="episodes">Episodes: how an event unfolded</option>
              <option value="place">Places: a country, era by era</option>
            </select>
          </label>
          <label><span className="sr-only">Filter stories by name</span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or country" className="field !py-1.5 text-sm" /></label>
        </div>
      </div>
      {failed && <p className="mt-3 text-sm text-ink-2">The story list couldn&rsquo;t be loaded.</p>}
      {all && <p className="mt-2 text-xs text-ink-2">{list.length} of {all.length} stories. Every step is joined to the last by a documented Wikidata statement.</p>}
      <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {!all && !failed && Array.from({ length: 8 }, (_, i) => <li key={i} className="skeleton h-28 rounded-xl" />)}
        {list.slice(0, shown).map((s) => {
          const saved = p.stories[s.id];
          const pct = saved ? (saved.finished ? 100 : Math.round(((saved.done ?? saved.step) / s.count) * 100)) : 0;
          return (
            <li key={s.id}>
              <Link href={`/stories/read?id=${s.id}`} className="card card-link flex h-full flex-col p-4" data-testid="generated-story">
                <span className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-paper-3 text-bronze"><Icon name={s.kind === "chain" ? "cause" : s.kind === "place" ? "place" : "parts"} size={22} /></span>
                  <span className="min-w-0">
                    <span className="block font-serif text-lg leading-tight">{s.title}</span>
                    <span className="mt-0.5 block text-xs text-ink-2">{s.from < 0 ? `${-s.from} BC` : s.from}–{s.to < 0 ? `${-s.to} BC` : s.to} · {s.count} steps{s.places.length ? ` · ${s.places.slice(0, 2).join(", ")}` : ""}</span>
                  </span>
                </span>
                {saved && (
                  <span className="mt-auto block pt-3">
                    <span className="block text-xs text-ink-2">{saved.finished ? "Finished" : "In progress"}</span>
                    <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-line" aria-hidden><span className="block h-full rounded-full bg-bronze" style={{ width: `${pct}%` }} /></span>
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
      {list.length > shown && <button type="button" className="btn btn-secondary mt-4" onClick={() => setShown(shown + PAGE * 2)}>Show more stories</button>}
    </div>
  );
}
