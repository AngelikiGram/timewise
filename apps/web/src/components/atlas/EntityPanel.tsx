"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { isWikidata, TYPE_LABEL, wikidataUrl, type Edge, type Entity, type EntityType } from "@/lib/entities";
import { exploreEntity, toggleSaveEntity, useProgress } from "@/lib/progress";
import { fetchRecord, statementUrl, type RecordData } from "@/lib/record";
import { Icon, type IconName } from "../icons";

export const TYPE_ICON: Record<EntityType, IconName> = { event: "event", person: "person", place: "place", country: "country", organization: "politics", object: "source" };

/**
 * A compact panel for one entity, opened from a name in a lesson. It stays inside the lesson, so closing it
 * returns to the same place. Relationships are only those with a source: this lesson's edges first, then
 * Wikidata statements.
 */
export function EntityPanel({ entity, edges, labels, lessonTitle, lessonHref, onClose, lessonTitles }: {
  entity: Entity;
  /** This lesson's sourced edges. */
  edges: Edge[];
  /** Names for ids that appear in those edges. */
  labels: Record<string, string>;
  lessonTitle: string;
  lessonHref: string;
  onClose: () => void;
  lessonTitles: Record<string, string>;
}) {
  const p = useProgress();
  const node = p.atlas?.nodes[entity.id];
  const [rec, setRec] = useState<RecordData | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "done" | "failed">("idle");
  const close = useRef<HTMLButtonElement>(null);

  useEffect(() => { exploreEntity(entity); close.current?.focus(); }, [entity]);
  useEffect(() => {
    setRec(null);
    if (!isWikidata(entity.id)) return;
    const ac = new AbortController();
    setState("loading");
    fetchRecord(entity.id, ac.signal).then((r) => { setRec(r); setState("done"); }, (e) => { if (e.name !== "AbortError") setState("failed"); });
    return () => ac.abort();
  }, [entity.id]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);

  const mine = edges.filter((e) => e.from === entity.id || e.to === entity.id);
  const here = mine.map((e) => (e.from === entity.id ? `${e.label} ${labels[e.to] ?? "another record"}` : `${labels[e.from] ?? "Another record"} ${e.label} it`));
  const documented = (rec?.links ?? []).filter((l) => l.documented && l.prop).slice(0, Math.max(0, 3 - mine.length));
  const earlier = (node?.lessons ?? []).filter((l) => lessonTitles[l] && lessonTitles[l] !== lessonTitle);
  const description = entity.description ?? rec?.description;
  const image = entity.image ?? (rec?.image ? { url: rec.image.url, page: rec.image.page, credit: [rec.image.artist, rec.image.license].filter(Boolean).join(", ") } : undefined);
  const atlasHref = `/my-atlas?focus=${encodeURIComponent(entity.id)}&back=${encodeURIComponent(lessonHref)}`;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30 lg:bg-transparent" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`${entity.label}: details`}
        onClick={(e) => e.stopPropagation()}
        className="mt-auto max-h-[85dvh] w-full overflow-y-auto rounded-t-2xl border-t border-line bg-paper p-5 shadow-2xl lg:mt-14 lg:h-[calc(100dvh-3.5rem)] lg:max-h-none lg:w-[420px] lg:rounded-none lg:border-l lg:border-t-0"
        data-testid="entity-panel"
      >
        <div className="flex items-start gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-bronze text-paper"><Icon name={TYPE_ICON[entity.type]} size={26} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-bronze">{TYPE_LABEL[entity.type]}{entity.dates ? `, ${entity.dates}` : rec?.when.text ? `, ${rec.when.text}` : ""}</p>
            <h2 className="font-serif text-2xl leading-tight">{entity.label}</h2>
          </div>
          <button ref={close} type="button" onClick={onClose} className="btn btn-ghost btn-icon" aria-label="Close and return to the lesson">✕</button>
        </div>

        {image ? (
          <figure className="mt-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.url} alt="" className="max-h-52 w-full rounded-lg object-cover" />
            <figcaption className="mt-1 truncate text-[11px] text-ink-2">{image.credit}, <a className="link" href={image.page} target="_blank" rel="noopener noreferrer">source</a></figcaption>
          </figure>
        ) : null}

        {description ? (
          <p className="mt-4 leading-relaxed">{description[0].toUpperCase() + description.slice(1)}</p>
        ) : state === "loading" ? <div className="skeleton mt-4 h-12 rounded" /> : <p className="mt-4 text-sm text-ink-2">No description is recorded.</p>}
        <p className="mt-1 text-xs text-ink-2">Source: {entity.source?.url ? <a className="link" href={entity.source.url} target="_blank" rel="noopener noreferrer">{entity.source.label} ↗</a> : isWikidata(entity.id) ? <a className="link" href={wikidataUrl(entity.id)} target="_blank" rel="noopener noreferrer">Wikidata {entity.id} ↗</a> : "TIMEWISE checked collection"}</p>

        {earlier.length > 0 && (
          <p className="mt-4 flex gap-2 rounded-lg bg-bronze-soft/50 p-3 text-sm" data-testid="met-before"><Icon name="checked" size={18} className="shrink-0 text-bronze" />
            <span>You&rsquo;ve met {entity.type === "person" ? "this person" : "this"} before, in {earlier.map((l) => lessonTitles[l]).join(", ")}.</span>
          </p>
        )}

        <section className="mt-5">
          <h3 className="text-sm font-semibold">How this connects to this lesson</h3>
          {here.length ? <ul className="mt-1 list-disc pl-5 text-sm text-ink-2">{here.map((t) => <li key={t}>{t[0].toUpperCase() + t.slice(1)}.</li>)}</ul> : <p className="mt-1 text-sm text-ink-2">It&rsquo;s one of the records in “{lessonTitle}”.</p>}
        </section>

        <section className="mt-5" data-testid="entity-relations">
          <h3 className="text-sm font-semibold">Documented relationships</h3>
          <ul className="mt-2 grid gap-2">
            {mine.slice(0, 3).map((e) => (
              <li key={`${e.from}${e.label}${e.to}`} className="rounded-md border border-line bg-paper-2 p-2.5 text-sm">
                <span className="font-medium">{labels[e.from] ?? e.from}</span> <span className="text-bronze">{e.label}</span> <span className="font-medium">{labels[e.to] ?? e.to}</span>
                {e.date && <span className="text-ink-2">, {e.date}</span>}
                <span className="block text-xs text-ink-2">Source: {e.source.url ? <a className="link" href={e.source.url} target="_blank" rel="noopener noreferrer">{e.source.label} ↗</a> : e.source.label}</span>
              </li>
            ))}
            {documented.map((l) => (
              <li key={l.target} className="rounded-md border border-line bg-paper-2 p-2.5 text-sm">
                <span className="font-medium">{entity.label}</span> <span className="text-bronze">{l.relation}</span> <span className="font-medium">{l.label}</span>
                <span className="block text-xs text-ink-2">Source: <a className="link" href={statementUrl(l)} target="_blank" rel="noopener noreferrer">Wikidata statement{l.references ? `, ${l.references} reference${l.references > 1 ? "s" : ""}` : ", no reference"} ↗</a></span>
              </li>
            ))}
            {!mine.length && !documented.length && <li className="text-sm text-ink-2">{state === "loading" ? "Reading Wikidata…" : "No documented relationships are recorded for it."}</li>}
          </ul>
        </section>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <Link href={atlasHref} className="btn btn-secondary"><Icon name="network" size={16} />Explore connections</Link>
          <button type="button" className="btn btn-primary" aria-pressed={!!node?.saved} onClick={() => toggleSaveEntity(entity)} data-testid="save-entity">{node?.saved ? "Saved ✓" : "Save to my atlas"}</button>
        </div>
        <p className="mt-2 text-xs text-ink-2">Your place in the lesson is kept: close this panel to go on.</p>
      </aside>
    </div>
  );
}
