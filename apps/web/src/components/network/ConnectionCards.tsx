"use client";

import { useState } from "react";
import { formatYear } from "@/lib/dates";
import { GROUPS, KIND_LABEL, type Group, type Link, type NodeFacts, type RecordData } from "@/lib/record";
import { Icon, type IconName } from "../icons";

export const GROUP_ORDER: Group[] = ["cause", "sequence", "people", "places", "parts", "ideas", "checked", "period", "country"];
const GROUP_ICON: Record<Group, IconName> = { cause: "cause", sequence: "sequence", parts: "parts", people: "people", places: "place", ideas: "idea", checked: "checked", period: "period", country: "country" };
const KIND_ICON: Record<RecordData["kind"], IconName> = { event: "event", person: "person", place: "place", invention: "invention", idea: "idea" };
const PER_GROUP = 4;

function Card({ link, facts, selected, onStep, onDetails }: { link: Link; facts?: NodeFacts; selected: boolean; onStep: () => void; onDetails: () => void }) {
  const sub = [facts?.year !== undefined ? formatYear(facts.year) : null, facts?.country].filter(Boolean).join(" · ");
  return (
    <li
      className={`group relative flex min-h-28 flex-col rounded-xl border-2 bg-paper-2 p-3 transition-colors focus-within:ring-2 focus-within:ring-bronze/60 hover:border-bronze ${link.documented ? "border-line" : "border-dashed border-bronze/50"} ${selected ? "!border-bronze bg-bronze-soft/30" : ""}`}
      data-card={link.target}
      data-documented={link.documented}
    >
      <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-2">
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${link.documented ? "bg-navy text-on-accent [[data-theme=dark]_&]:bg-bronze [[data-theme=dark]_&]:text-paper" : "border border-dashed border-bronze text-bronze"}`}>
          <Icon name={GROUP_ICON[link.group]} size={16} />
        </span>
        <span className="truncate">{link.relation}</span>
      </span>
      <button
        type="button"
        onClick={onStep}
        className="mt-2 text-left font-serif text-[1.05rem] leading-snug text-ink outline-none after:absolute after:inset-0 after:rounded-xl after:content-[''] [overflow-wrap:anywhere]"
        aria-label={`${link.label}: ${link.relation}, ${link.documented ? "documented" : "a coincidence of time or place, not a documented relationship"}. ${/^Q\d+$/.test(link.target) ? "Explore from here" : "Open the checked event"}`}
      >
        <span className="line-clamp-3">{link.label}</span>
      </button>
      <span className="mt-auto flex items-end justify-between gap-2 pt-2 text-xs text-ink-2">
        <span className="truncate">{sub || (link.documented ? "Documented" : "Contextual")}</span>
        <button type="button" onClick={onDetails} className="relative z-10 inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 hover:bg-paper-3 hover:text-ink focus-visible:ring-2 focus-visible:ring-bronze" aria-label={`Why is ${link.label} connected?`}>
          <Icon name="info" size={14} /> Why
        </button>
      </span>
    </li>
  );
}

/**
 * "Choose your next connection": the record in focus, and its links as cards grouped by why they're
 * connected. Choosing a card moves the focus there, one step at a time.
 */
export function ConnectionCards({ record, links, facts, selected, onStep, onDetails }: {
  record: RecordData;
  links: Link[];
  facts: Record<string, NodeFacts>;
  selected?: string;
  onStep: (link: Link) => void;
  onDetails: (target: string) => void;
}) {
  const [open, setOpen] = useState<Set<Group>>(new Set());
  const groups = GROUP_ORDER.filter((g) => links.some((l) => l.group === g));
  const documented = groups.filter((g) => GROUPS[g].documented);
  const contextual = groups.filter((g) => !GROUPS[g].documented);

  const section = (g: Group) => {
    const members = links.filter((l) => l.group === g);
    const shown = open.has(g) ? members : members.slice(0, PER_GROUP);
    return (
      <section key={g} aria-labelledby={`grp-${g}`} className="mt-5" data-group={g}>
        <h3 id={`grp-${g}`} className="flex items-center gap-2 text-sm font-semibold">
          <Icon name={GROUP_ICON[g]} size={18} className="text-bronze" />
          {GROUPS[g].label}
          <span className="font-normal text-ink-2">{members.length}</span>
        </h3>
        <ul className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
          {shown.map((l) => <Card key={l.target} link={l} facts={facts[l.target]} selected={selected === l.target} onStep={() => onStep(l)} onDetails={() => onDetails(l.target)} />)}
        </ul>
        {members.length > PER_GROUP && (
          <button type="button" className="btn btn-ghost btn-sm mt-1" aria-expanded={open.has(g)} onClick={() => setOpen((s) => { const t = new Set(s); if (t.has(g)) t.delete(g); else t.add(g); return t; })}>
            {open.has(g) ? "Show fewer" : `Show ${members.length - PER_GROUP} more`}
          </button>
        )}
      </section>
    );
  };

  return (
    <div data-testid="connection-cards">
      <div className="flex items-start gap-4 rounded-2xl border-2 border-bronze/60 bg-paper-2 p-4 sm:p-5" data-testid="focus-card">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-bronze text-paper"><Icon name={KIND_ICON[record.kind]} size={30} /></span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-bronze">{KIND_LABEL[record.kind]}{record.when.text ? ` · ${record.when.text}` : ""}</p>
          <h2 className="font-serif text-2xl leading-tight sm:text-3xl [overflow-wrap:anywhere]">{record.label}</h2>
          {record.description && <p className="mt-0.5 text-ink-2 [overflow-wrap:anywhere]">{record.description}</p>}
        </div>
      </div>

      {!links.length && <p className="mt-6 text-ink-2">No connections match these filters. Reset them, or try another record.</p>}
      {documented.map(section)}
      {contextual.length > 0 && (
        <div className="mt-8 rounded-xl border border-dashed border-bronze/50 p-3 sm:p-4">
          <p className="text-sm font-semibold">Shared time or place</p>
          <p className="text-xs text-ink-2">Coincidences from the TIMEWISE index. A shared date or country doesn&rsquo;t mean one affected the other.</p>
          {contextual.map(section)}
        </div>
      )}
    </div>
  );
}
