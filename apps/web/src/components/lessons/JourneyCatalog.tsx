"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { fold } from "@/lib/dedupe";
import { PATHS, type PathDef } from "@/lib/lessons";
import { useProgress } from "@/lib/progress";
import { Icon } from "../icons";

const KINDS: { id: PathDef["kind"] | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "question", label: "By question" },
  { id: "topic", label: "By topic" },
  { id: "period", label: "By period" },
  { id: "region", label: "By region" },
  { id: "place", label: "By place" },
];

/** Every journey, filterable by how it is organised. Checked and generated journeys are labelled apart. */
export function JourneyCatalog({ current, onPick }: { current?: string; onPick?: (id: string) => void }) {
  const p = useProgress();
  const [kind, setKind] = useState<(typeof KINDS)[number]["id"]>("all");
  const [q, setQ] = useState("");
  const list = useMemo(() => PATHS.filter((x) => (kind === "all" || x.kind === kind) && (!q.trim() || fold(x.title).includes(fold(q)))), [kind, q]);
  const lessons = PATHS.reduce((n, x) => n + x.lessons.length, 0);

  return (
    <div data-testid="journey-catalog">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div role="radiogroup" aria-label="Organised by" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [&>*]:shrink-0">
          {KINDS.map((k) => (
            <button key={k.id} type="button" role="radio" aria-checked={kind === k.id} className="chip" data-on={kind === k.id} onClick={() => setKind(k.id)}>
              {k.label} <span className="tabular-nums opacity-70">{k.id === "all" ? PATHS.length : PATHS.filter((x) => x.kind === k.id).length}</span>
            </button>
          ))}
        </div>
        <label className="sm:ml-auto">
          <span className="sr-only">Filter journeys by name</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by name, e.g. Japan" className="field !py-1.5 text-sm sm:w-56" />
        </label>
      </div>
      <p className="mt-2 text-xs text-ink-2">
        {PATHS.length} journeys, {lessons} lessons. One is written from the hand-checked collection; the rest are assembled automatically from imported Wikidata records by fixed rules, and say how.
      </p>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((x) => {
          const done = x.lessons.filter((l) => p.lessons[l.id]?.finished).length;
          const pct = Math.round((done / x.lessons.length) * 100);
          const minutes = x.lessons.reduce((n, l) => n + l.minutes, 0);
          const body = (
            <>
              <span className="flex items-start gap-3">
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${x.review === "source_checked" ? "bg-navy text-on-accent [[data-theme=dark]_&]:bg-bronze [[data-theme=dark]_&]:text-paper" : "border border-line bg-paper-3 text-ink"}`}>
                  <Icon name={x.icon} size={22} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-serif text-lg leading-tight [overflow-wrap:anywhere]">{x.title}</span>
                  <span className="mt-0.5 block text-xs text-ink-2">{x.lessons.length} lessons · about {minutes} min · {x.difficulty}</span>
                </span>
              </span>
              <span className="mt-3 flex items-center gap-2">
                <span className={`badge ${x.review === "source_checked" ? "" : "border-dashed"}`}>{x.review === "source_checked" ? "Checked by hand" : "Generated, unreviewed"}</span>
                <span className="ml-auto text-xs tabular-nums text-ink-2">{done ? `${done}/${x.lessons.length} done` : "Not started"}</span>
              </span>
              <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-line" aria-hidden><span className="block h-full rounded-full bg-bronze" style={{ width: `${pct}%` }} /></span>
            </>
          );
          const cls = `card card-link block h-full w-full p-4 text-left ${x.id === current ? "!border-bronze" : ""}`;
          return (
            <li key={x.id}>
              {onPick ? (
                <button type="button" className={cls} aria-current={x.id === current ? "true" : undefined} onClick={() => onPick(x.id)} data-testid="path-card">{body}</button>
              ) : (
                <Link href={`/learn?path=${x.id}`} className={cls} data-testid="path-card">{body}</Link>
              )}
            </li>
          );
        })}
        {!list.length && <li className="text-sm text-ink-2">No journey matches. Coverage depends on the imported records; try another name or filter.</li>}
      </ul>
    </div>
  );
}
