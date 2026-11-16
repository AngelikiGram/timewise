"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatYear } from "@/lib/dates";
import { GROUPS, KIND_LABEL, propertyUrl, statementUrl, type Link as RecordLink, type NodeFacts, type RecordData } from "@/lib/record";
import { CreditedImage, SaveButton } from "../ui";
import { GROUP_ORDER } from "./NetworkGraph";

const explorerHref = (id: string) => `/connections?id=${id}`;

function Why({ link, record }: { link: RecordLink; record: RecordData }) {
  if (!link.documented) {
    return (
      <div className="rounded-md border border-dashed border-bronze/60 bg-bronze-soft/30 p-3 text-sm">
        <p><span className="badge mr-1.5 border-bronze/60 text-bronze">Contextual</span><strong>{link.relation}</strong></p>
        <p className="mt-1.5 text-ink-2">{link.note}</p>
      </div>
    );
  }
  if (link.group === "checked") {
    return (
      <div className="rounded-md border border-line bg-paper-3/50 p-3 text-sm">
        <p><span className="badge mr-1.5">Checked</span><strong>{link.relation}</strong></p>
        <p className="mt-1.5 text-ink-2">{link.note}</p>
      </div>
    );
  }
  const url = statementUrl(link);
  const onOther = link.statementOn !== record.id;
  return (
    <div className="rounded-md border border-line bg-paper-3/50 p-3 text-sm">
      <p><span className="badge mr-1.5">Documented</span><strong>{link.relation}</strong></p>
      <p className="mt-1.5 text-ink-2">
        A Wikidata statement on {onOther ? <>the page of <em>{link.label}</em></> : <>this record&rsquo;s page</>} links the two
        {link.prop && <> through the property <a className="link" href={propertyUrl(link.prop)} target="_blank" rel="noopener noreferrer">{link.prop}</a></>}.{" "}
        {link.references === undefined ? "Open the statement to see its references." : link.references > 0 ? `Wikidata gives ${link.references} reference${link.references > 1 ? "s" : ""} for it.` : "Wikidata gives no reference for it, so treat it with care."}
      </p>
      {url && <a className="link mt-1.5 inline-block" href={url} target="_blank" rel="noopener noreferrer">See the statement on Wikidata ↗</a>}
    </div>
  );
}

/** A question answered by Wikidata's own statements, with the statement as the explanation. */
function ConnectionChallenge({ record, links }: { record: RecordData; links: RecordLink[] }) {
  const documented = links.filter((l) => l.documented && l.prop);
  const relations = [...new Set(documented.map((l) => l.relation))].filter((r) => documented.some((l) => l.relation !== r));
  const [round, setRound] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const q = useMemo(() => {
    if (!relations.length) return null;
    const relation = relations[round % relations.length];
    const answer = documented.find((l) => l.relation === relation)!;
    const decoys = documented.filter((l) => l.relation !== relation && !documented.some((d) => d.target === l.target && d.relation === relation)).slice(round % 3, (round % 3) + 3);
    const options = [answer, ...decoys];
    // A fixed shuffle per round, so the answer isn't always first.
    const k = (record.id.length + round) % options.length;
    return { relation, answer, options: [...options.slice(k), ...options.slice(0, k)] };
  }, [relations, documented, round, record.id]);

  if (!q || q.options.length < 2) {
    return <p className="text-sm text-ink-2">Not enough documented links of different kinds to ask a fair question about this record.</p>;
  }
  const right = picked === q.answer.target;
  return (
    <div data-testid="connection-challenge">
      <p className="font-medium">Which of these does Wikidata link to <em>{record.label}</em> as &ldquo;{q.relation}&rdquo;?</p>
      <ul className="mt-2 grid gap-1.5">
        {q.options.map((o) => (
          <li key={o.target}>
            <button
              type="button"
              disabled={!!picked}
              onClick={() => setPicked(o.target)}
              className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${picked && o.target === q.answer.target ? "border-navy bg-navy/10" : picked === o.target ? "border-oxblood bg-oxblood/10" : "border-line hover:border-bronze"}`}
            >
              {o.label}
            </button>
          </li>
        ))}
      </ul>
      {picked && (
        <div className="mt-2 text-sm" role="status">
          <p className={right ? "font-semibold text-navy" : "font-semibold text-oxblood"}>{right ? "Right." : `Not quite: it's ${q.answer.label}.`}</p>
          <p className="mt-1 text-ink-2">
            The others are linked in other ways: {q.options.filter((o) => o !== q.answer).map((o) => `${o.label} (${o.relation})`).join("; ")}.{" "}
            {statementUrl(q.answer) && <a className="link" href={statementUrl(q.answer)} target="_blank" rel="noopener noreferrer">The statement ↗</a>}
          </p>
          <button type="button" className="btn btn-ghost btn-sm mt-2" onClick={() => { setPicked(null); setRound((r) => r + 1); }}>Another question</button>
        </div>
      )}
      <p className="mt-2 text-xs text-ink-2">Practice only: no XP, because the questions come from crowd-edited data that can change.</p>
    </div>
  );
}

export function LinkDetail({ link, record, facts, onBack, onOpen }: { link: RecordLink; record: RecordData; facts?: NodeFacts; onBack: () => void; onOpen: (l: RecordLink) => void }) {
  const isRecord = /^Q\d+$/.test(link.target);
  return (
    <div data-testid="link-detail">
      <button type="button" onClick={onBack} className="btn btn-ghost btn-sm -ml-2">← {record.label}</button>
      <h2 className="mt-2 font-serif text-2xl leading-tight">{link.label}</h2>
      {link.description && <p className="mt-1 text-ink-2">{link.description}</p>}
      {facts && (facts.year !== undefined || facts.country) && (
        <p className="mt-1 text-sm text-ink-2">{[facts.year !== undefined ? formatYear(facts.year) : null, facts.country].filter(Boolean).join(" · ")}</p>
      )}
      <h3 className="eyebrow mt-4">Why they&rsquo;re connected</h3>
      <div className="mt-2"><Why link={link} record={record} /></div>
      <div className="mt-4 flex flex-wrap gap-2">
        {isRecord ? (
          <button type="button" className="btn btn-primary" onClick={() => onOpen(link)} data-testid="open-link">Explore from here →</button>
        ) : link.href ? (
          <Link href={link.href} className="btn btn-primary">Open the checked event →</Link>
        ) : null}
        {isRecord && <SaveButton id={link.target} title={link.label} href={explorerHref(link.target)} context={link.description} />}
      </div>
    </div>
  );
}

function Chips({ links, onPick }: { links: RecordLink[]; onPick: (l: RecordLink) => void }) {
  return (
    <ul className="mt-1.5 flex flex-wrap gap-1.5">
      {links.map((l) => (
        <li key={l.target}><button type="button" className="chip" onClick={() => onPick(l)}>{l.label}</button></li>
      ))}
    </ul>
  );
}

export function RecordCard({ record, links, onPick }: { record: RecordData; links: RecordLink[]; onPick: (l: RecordLink) => void }) {
  const context = record.links.filter((l) => ["part of", "caused by", "immediate cause", "follows", "replaces", "a kind of", "movement"].includes(l.relation)).slice(0, 6);
  const significance = record.links.filter((l) => ["led to", "followed by", "replaced by", "notable work", "discovered or invented", "influenced", "wrote"].includes(l.relation)).slice(0, 6);
  const where = record.links.find((l) => l.prop === "P276" || l.prop === "P131" || l.prop === "P19")?.label;
  const country = record.links.find((l) => l.prop === "P17")?.label;
  const pct = record.statements ? Math.round((record.referenced / record.statements) * 100) : 0;
  const counts = GROUP_ORDER.map((g) => [g, links.filter((l) => l.group === g).length] as const).filter(([, n]) => n);

  return (
    <article data-testid="record-card">
      <p className="text-xs font-semibold uppercase tracking-wider text-bronze">{KIND_LABEL[record.kind]}{record.types.length > 0 && <span className="font-normal normal-case tracking-normal text-ink-2"> · {record.types.join(", ")}</span>}</p>
      <h2 className="mt-1 font-serif text-3xl leading-tight">{record.label}</h2>
      {record.description && <p className="mt-1 text-ink-2">{record.description}</p>}
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-ink-2">When</dt>
        <dd>{record.when.text ?? <span className="text-ink-2">No date in Wikidata</span>}</dd>
        <dt className="text-ink-2">Where</dt>
        <dd>{[where, country].filter((v, i, a) => v && a.indexOf(v) === i).join(", ") || (record.coord ? `${record.coord[1].toFixed(2)}°, ${record.coord[0].toFixed(2)}°` : <span className="text-ink-2">No place in Wikidata</span>)}</dd>
      </dl>

      {record.image ? (
        <CreditedImage className="mt-3" src={record.image.url} alt={record.label} credit={{ title: record.label, creator: record.image.artist, license: record.image.license, page: record.image.page }} imgClassName="max-h-56 w-full rounded-md object-cover" />
      ) : null}

      <section className="mt-4">
        <h3 className="eyebrow">Summary</h3>
        {record.summary ? (
          <>
            <p className="mt-1.5 line-clamp-5 leading-relaxed">{record.summary.text}</p>
            <p className="mt-1 text-xs text-ink-2">From Wikipedia, <a className="link" href={record.summary.url} target="_blank" rel="noopener noreferrer">{record.summary.title} ↗</a>, CC BY-SA 4.0. Not checked by TIMEWISE.</p>
          </>
        ) : (
          <p className="mt-1.5 text-sm text-ink-2">No English Wikipedia summary is linked to this record. Only Wikidata&rsquo;s statements are shown.</p>
        )}
      </section>

      {context.length > 0 && (
        <section className="mt-4">
          <h3 className="eyebrow">Context</h3>
          <p className="mt-1 text-xs text-ink-2">What Wikidata says it was part of, came from, or followed.</p>
          <Chips links={context} onPick={onPick} />
        </section>
      )}
      <section className="mt-4">
        <h3 className="eyebrow">Significance</h3>
        {significance.length > 0 ? (
          <>
            <p className="mt-1 text-xs text-ink-2">Only what Wikidata records as its effects, successors or works; TIMEWISE doesn&rsquo;t rank importance.</p>
            <Chips links={significance} onPick={onPick} />
          </>
        ) : (
          <p className="mt-1 text-sm text-ink-2">Wikidata records no effects or successors for it. That doesn&rsquo;t mean it had none.</p>
        )}
      </section>

      <section className="mt-4">
        <h3 className="eyebrow">Connections</h3>
        <ul className="mt-1.5 grid gap-0.5 text-sm">
          {counts.map(([g, n]) => (
            <li key={g} className="flex justify-between"><span>{GROUPS[g].label}{!GROUPS[g].documented && <span className="text-ink-2"> (contextual)</span>}</span><span className="tabular-nums text-ink-2">{n}</span></li>
          ))}
          {!counts.length && <li className="text-ink-2">None found.</li>}
        </ul>
      </section>

      <details className="mt-4 rounded-md border border-line p-3" data-testid="record-sources">
        <summary className="cursor-pointer font-semibold">Sources and coverage</summary>
        <ul className="mt-2 grid gap-1.5 text-sm">
          <li>
            <a className="link" href={record.url} target="_blank" rel="noopener noreferrer">Wikidata {record.id} ↗</a>: {record.statements} statements, {pct}% with a reference. Crowd-edited, CC0.
          </li>
          {record.summary && <li><a className="link" href={record.summary.url} target="_blank" rel="noopener noreferrer">Wikipedia: {record.summary.title} ↗</a>, CC BY-SA 4.0.</li>}
          {record.image && <li><a className="link" href={record.image.page} target="_blank" rel="noopener noreferrer">Image on Wikimedia Commons ↗</a>{record.image.license && `, ${record.image.license}`}.</li>}
        </ul>
        {record.missing.length > 0 && (
          <>
            <p className="mt-3 text-sm font-semibold">Gaps</p>
            <ul className="mt-1 list-disc pl-5 text-sm text-ink-2">{record.missing.map((m) => <li key={m}>{m}</li>)}</ul>
          </>
        )}
        <p className="mt-3 text-xs text-ink-2">Links are capped at six per kind of statement. Spotted a mistake? It can be corrected <a className="link" href={record.url} target="_blank" rel="noopener noreferrer">on Wikidata itself ↗</a>.</p>
      </details>

      <details className="mt-3 rounded-md border border-line p-3">
        <summary className="cursor-pointer font-semibold">Connection challenge</summary>
        <div className="mt-2"><ConnectionChallenge record={record} links={record.links} /></div>
      </details>
    </article>
  );
}
