"use client";

import Link from "next/link";
import { useState } from "react";
import {
  activeProfile, ARCHETYPES, COLORS, createProfile, deleteProfile, explorerXp, level, questProgress, switchProfile, updateProfile,
  useExplorer, useProfiles, type ArchetypeId,
} from "@/lib/explorer";
import { setProfile, useProgress } from "@/lib/progress";
import { Avatar } from "./Avatar";

const IDS = Object.keys(ARCHETYPES) as ArchetypeId[];

/** Your explorer: character, colour, level, today's quests, and other explorers on this browser. */
export function ExplorerCard() {
  const ps = useProfiles();
  const me = activeProfile(ps);
  const e = useExplorer();
  const p = useProgress();
  const l = level(explorerXp(e));
  const pct = l.to ? Math.round(((l.xp - l.from) / (l.to - l.from)) * 100) : 100;
  const [editing, setEditing] = useState(false);
  const [making, setMaking] = useState(false);
  const name = me.name || p.profile?.name || "";
  const rename = (v: string) => { updateProfile(me.id, { name: v }); if (me.id === "main") setProfile({ name: v.trim() || undefined, shareable: p.profile?.shareable ?? false }); };

  return (
    <section aria-labelledby="explorer-name" className="overflow-hidden rounded-xl border border-line bg-paper-2" data-testid="explorer-card">
      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 gap-5">
          <button type="button" onClick={() => setEditing(!editing)} aria-expanded={editing} className="group relative shrink-0 rounded-full" title="Change character">
            <Avatar archetype={me.archetype} color={me.color} level={l.n} size={104} label={`${ARCHETYPES[me.archetype].title} avatar`} />
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-md bg-ink px-2 py-0.5 text-xs font-bold text-paper-2 group-hover:bg-navy">Change</span>
          </button>
          <div className="min-w-0 flex-1">
            <label className="sr-only" htmlFor="explorer-name">Explorer name</label>
            <input id="explorer-name" value={name} onChange={(ev) => rename(ev.target.value)} placeholder="Name your explorer" className="w-full rounded-md bg-transparent font-serif text-4xl leading-tight outline-none placeholder:text-ink-2/50 hover:bg-paper-3/60 focus:bg-paper-3/60" />
            <p className="mt-0.5 text-ink-2"><b className="text-ink">{ARCHETYPES[me.archetype].title}</b>, level {l.n} {l.title}. {ARCHETYPES[me.archetype].perk}.</p>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-paper-3" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Progress to the next level">
              <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${pct}%`, background: me.color }} />
            </div>
            <p className="mt-1 text-sm text-ink-2">{l.xp} XP{l.to ? `, ${l.to - l.xp} more to ${l.nextTitle}` : ", the top level"}</p>
          </div>
        </div>
        <Quests />
      </div>

      {editing && (
        <div className="border-t border-line bg-paper p-5 sm:p-6" data-testid="character-picker">
          <h3 className="font-serif text-xl">Choose your character</h3>
          <p className="text-sm text-ink-2">Each one earns half again for its speciality. More unlock as you level up; you can switch any time.</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {IDS.map((id) => {
              const a = ARCHETYPES[id], locked = l.n < a.unlock, on = me.archetype === id;
              return (
                <li key={id}>
                  <button type="button" disabled={locked} aria-pressed={on} onClick={() => updateProfile(me.id, { archetype: id })}
                    className={`flex w-full items-center gap-3 rounded-lg border-2 p-3 text-left ${on ? "border-ink" : "border-line hover:border-navy"} disabled:cursor-not-allowed disabled:opacity-50`}>
                    <Avatar archetype={id} color={locked ? "#8a8270" : me.color} level={1} size={48} />
                    <span className="min-w-0"><span className="block font-semibold">{a.title}</span><span className="block text-xs text-ink-2">{locked ? `Unlocks at level ${a.unlock}` : a.perk}</span></span>
                  </button>
                </li>
              );
            })}
          </ul>
          <h3 className="mt-5 text-sm font-semibold">Colour</h3>
          <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Colour">
            {COLORS.map((c) => <button key={c} type="button" role="radio" aria-checked={me.color === c} aria-label={c} onClick={() => updateProfile(me.id, { color: c })} className={`h-9 w-9 rounded-full border-4 ${me.color === c ? "border-ink" : "border-paper-2"}`} style={{ background: c }} />)}
          </div>
          <button type="button" className="btn btn-primary btn-sm mt-4" onClick={() => setEditing(false)}>Done</button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-3 sm:px-6">
        <span className="text-sm text-ink-2">Explorers on this browser:</span>
        {ps.list.map((x) => (
          <button key={x.id} type="button" onClick={() => switchProfile(x.id)} aria-pressed={x.id === me.id} className="chip !pl-1">
            <Avatar archetype={x.archetype} color={x.color} size={26} />{x.name || (x.id === "main" ? name || "You" : "Unnamed")}
          </button>
        ))}
        {!making && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMaking(true)} data-testid="new-explorer">+ New explorer</button>}
        {me.id !== "main" && <button type="button" className="btn btn-ghost btn-sm text-oxblood" onClick={() => { if (window.confirm(`Delete ${me.name || "this explorer"} and their XP and badges? Lessons stay.`)) deleteProfile(me.id); }}>Delete this explorer</button>}
        {making && <NewExplorer onDone={() => setMaking(false)} />}
        <p className="w-full text-xs text-ink-2">Each explorer has their own character, XP, badges and quests. Lessons, saved records and review questions are shared on this browser.</p>
      </div>
    </section>
  );
}

function NewExplorer({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [a, setA] = useState<ArchetypeId>("archivist");
  const [c, setC] = useState(COLORS[1]);
  return (
    <form className="flex w-full flex-wrap items-center gap-2 rounded-lg border border-line bg-paper p-3" onSubmit={(ev) => { ev.preventDefault(); createProfile(name.trim(), a, c); onDone(); }}>
      <Avatar archetype={a} color={c} size={40} />
      <label className="min-w-0 flex-1"><span className="sr-only">Name</span><input autoFocus value={name} onChange={(ev) => setName(ev.target.value)} placeholder="Their name" className="field !min-h-9 !py-1 text-sm" /></label>
      <label><span className="sr-only">Character</span><select value={a} onChange={(ev) => setA(ev.target.value as ArchetypeId)} className="field !min-h-9 !w-auto !py-1 text-sm">{IDS.filter((id) => ARCHETYPES[id].unlock === 1).map((id) => <option key={id} value={id}>{ARCHETYPES[id].title}</option>)}</select></label>
      <span className="flex gap-1">{COLORS.map((x) => <button key={x} type="button" aria-label={x} aria-pressed={c === x} onClick={() => setC(x)} className={`h-7 w-7 rounded-full border-2 ${c === x ? "border-ink" : "border-transparent"}`} style={{ background: x }} />)}</span>
      <button type="submit" className="btn btn-primary btn-sm">Create and switch</button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={onDone}>Cancel</button>
    </form>
  );
}

/** Today's three quests, each a link to where it is done. */
export function Quests({ compact = false }: { compact?: boolean }) {
  const e = useExplorer();
  const qs = questProgress(e);
  const done = qs.filter((q) => q.done).length;
  return (
    <div className="min-w-0" data-testid="quests">
      <h3 className="flex items-baseline justify-between gap-2 font-serif text-xl">Today&rsquo;s quests <span className="font-sans text-sm text-ink-2">{done} of 3 done</span></h3>
      <ul className="mt-2 grid gap-2">
        {qs.map((q) => (
          <li key={q.id}>
            <Link href={q.href} className={`flex items-center gap-3 rounded-lg border p-2.5 ${q.done ? "border-transparent bg-paper-3" : "border-line bg-paper hover:border-navy"}`}>
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold ${q.done ? "bg-[#3d7f4e] text-white" : "border-2 border-line text-ink-2"}`} aria-hidden>{q.done ? "✓" : `${q.have}/${q.need}`}</span>
              <span className={`min-w-0 flex-1 text-sm ${q.done ? "text-ink-2 line-through" : "font-medium"}`}>{q.label}</span>
              <span className="shrink-0 text-xs font-bold text-bronze">+{q.xp} XP</span>
            </Link>
          </li>
        ))}
      </ul>
      {!compact && <p className="mt-2 text-xs text-ink-2">New quests every day. Finish all three for the Full day badge.</p>}
    </div>
  );
}
