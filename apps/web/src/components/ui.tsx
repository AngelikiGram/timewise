"use client";

// Small shared pieces: review status, image credits, saving, notes and issue reports.
import { useEffect, useId, useState } from "react";
import { saveNote, toggleBookmark, useProgress, createCollection, setInCollection } from "@/lib/progress";

export type ReviewLevel = "imported" | "source_checked" | "expert_reviewed";

const REVIEW: Record<ReviewLevel, { label: string; style: string; help: string }> = {
  imported: {
    label: "Imported",
    style: "text-ink-2",
    help: "Taken automatically from Wikidata, a volunteer-built database. Nobody at TIMEWISE has checked this record, so its date, place or wording may be wrong. Follow the source link to judge it yourself.",
  },
  source_checked: {
    label: "Source-checked",
    style: "text-navy",
    help: "Each statement was compared by hand with the source it cites, and the source is linked. That isn't a review by a historian: a source can itself be mistaken, and other sources may disagree.",
  },
  expert_reviewed: {
    label: "Expert-reviewed",
    style: "text-bronze",
    help: "Reviewed by a named historian. No content carries this status yet.",
  },
};

/** A compact status badge whose explanation opens on demand, instead of repeating a long warning. */
export function ReviewBadge({ level }: { level: ReviewLevel }) {
  const r = REVIEW[level];
  return (
    <details className="group inline-block align-middle">
      <summary className={`badge cursor-pointer list-none ${r.style} [&::-webkit-details-marker]:hidden`} data-testid="review-badge">
        {level === "source_checked" ? "✓ " : ""}
        {r.label}
        <span aria-hidden className="text-[0.65rem] opacity-70 group-open:rotate-180">▾</span>
      </summary>
      <p className="mt-2 max-w-sm rounded-md border border-line bg-paper-2 p-3 text-sm font-normal leading-relaxed text-ink-2 normal-case tracking-normal">{r.help}</p>
    </details>
  );
}

export type Credit = { title: string; creator?: string; created?: string; license?: string; page?: string; caveat?: string };

/** A figure whose credit stays one short line until opened. */
export function CreditedImage({ src, alt, credit, className = "", imgClassName = "aspect-[16/9] w-full object-cover", eager = false }: { src: string; alt: string; credit: Credit; className?: string; imgClassName?: string; eager?: boolean }) {
  const [broken, setBroken] = useState(false);
  return (
    <figure className={className}>
      {broken ? (
        <div className={`${imgClassName} grid place-items-center bg-paper-3 p-4 text-center text-sm text-ink-2`}>The image couldn&rsquo;t be loaded from Wikimedia Commons.</div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} loading={eager ? "eager" : "lazy"} decoding="async" onError={() => setBroken(true)} className={`${imgClassName} rounded-md bg-paper-3`} />
      )}
      <details className="mt-1 text-xs text-ink-2">
        <summary className="cursor-pointer list-none hover:text-ink [&::-webkit-details-marker]:hidden">
          Image: {credit.creator ?? credit.title}{credit.license ? ` · ${credit.license}` : ""} <span aria-hidden>ⓘ</span>
        </summary>
        <p className="mt-1 leading-relaxed">
          {credit.page ? <a href={credit.page} target="_blank" rel="noopener noreferrer" className="link">{credit.title} ↗</a> : credit.title}
          {credit.creator && `, ${credit.creator}`}
          {credit.created && `, ${credit.created}`}.{credit.license && ` ${credit.license}.`}
          {credit.caveat && <span className="mt-0.5 block italic">{credit.caveat}</span>}
        </p>
      </details>
    </figure>
  );
}

/** Save an event or story step to My Collection, and optionally to a named collection. */
export function SaveButton({ id, title, href, start, context, compact = false }: { id: string; title: string; href: string; start?: string; context?: string; compact?: boolean }) {
  const p = useProgress();
  const saved = !!p.bookmarks[id];
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const menuId = useId();
  return (
    <div className="relative inline-flex">
      <button
        type="button"
        aria-pressed={saved}
        onClick={() => toggleBookmark({ id, title, href, start, context })}
        className={`btn btn-sm ${saved ? "btn-primary" : "btn-secondary"} ${compact ? "" : "rounded-r-none"}`}
        data-testid="save-button"
      >
        <svg aria-hidden viewBox="0 0 16 16" className="h-4 w-4"><path d="M4 2h8v12l-4-3-4 3z" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
        {saved ? "Saved" : "Save"}
      </button>
      {!compact && (
        <button type="button" aria-expanded={open} aria-controls={menuId} aria-label="Add to a collection" onClick={() => setOpen(!open)} className="btn btn-sm btn-secondary rounded-l-none border-l-0 px-2">
          <span aria-hidden>▾</span>
        </button>
      )}
      {open && (
        <div id={menuId} className="absolute left-0 top-full z-40 mt-1 w-64 rounded-lg border border-line bg-paper-2 p-3 shadow-xl">
          <p className="text-xs font-semibold text-ink-2">Add to a collection</p>
          <ul className="mt-2 max-h-48 space-y-1 overflow-auto">
            {p.collections.map((c) => (
              <li key={c.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-paper-3">
                  <input
                    type="checkbox"
                    checked={c.itemIds.includes(id)}
                    onChange={(e) => {
                      if (!saved) toggleBookmark({ id, title, href, start, context });
                      setInCollection(c.id, id, e.target.checked);
                    }}
                  />
                  {c.name}
                </label>
              </li>
            ))}
            {p.collections.length === 0 && <li className="text-sm text-ink-2">No collections yet.</li>}
          </ul>
          <form
            className="mt-2 flex gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              if (!saved) toggleBookmark({ id, title, href, start, context });
              createCollection(name, [id]);
              setName("");
            }}
          >
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New collection" aria-label="New collection name" className="field !min-h-9 !py-1 text-sm" />
            <button type="submit" className="btn btn-sm btn-secondary">Add</button>
          </form>
          <p className="mt-2 text-xs text-ink-2">Saved in this browser only.</p>
        </div>
      )}
    </div>
  );
}

/** A private note, kept in this browser. Collapsed until wanted, so it doesn't interrupt reading. */
export function NoteField({ id, title, href }: { id: string; title: string; href: string }) {
  const p = useProgress();
  const existing = p.notes[id]?.text ?? "";
  const [text, setText] = useState(existing);
  const [open, setOpen] = useState(false);
  useEffect(() => setText(existing), [existing, id]);
  const dirty = text !== existing;
  return (
    <details open={open || !!existing} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)} className="rounded-md border border-line bg-paper-2">
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-ink-2 hover:text-ink">{existing ? "Your note" : "Add a private note"}</summary>
      <div className="px-3 pb-3">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} aria-label={`Note on ${title}`} className="field resize-y text-sm" placeholder="What stood out? What would you check next?" />
        <div className="mt-2 flex items-center gap-2">
          <button type="button" disabled={!dirty} onClick={() => saveNote(id, title, href, text)} className="btn btn-sm btn-primary">Save note</button>
          <span className="text-xs text-ink-2">{dirty ? "Not saved yet" : existing ? "Saved in this browser" : ""}</span>
        </div>
      </div>
    </details>
  );
}

const REPO = "https://github.com/AngelikiGram/timewise";

/**
 * Opens a pre-filled GitHub issue. It needs a free GitHub account, and the report is public. Nothing is
 * sent until the reader submits it on GitHub.
 */
export function ReportIssue({ subject, id, className = "" }: { subject: string; id: string; className?: string }) {
  const [href, setHref] = useState(`${REPO}/issues/new`);
  useEffect(() => {
    const body = `**What looks wrong?**\n\n\n**Where did you see it?**\n${window.location.href}\n\nRecord: ${id}\n\n**A source that shows the correct information (if you have one):**\n`;
    setHref(`${REPO}/issues/new?${new URLSearchParams({ title: `Content issue: ${subject}`, body, labels: "content" })}`);
  }, [subject, id]);
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1.5 text-sm text-ink-2 underline-offset-2 hover:text-bronze hover:underline ${className}`} title="Opens a pre-filled report on GitHub. You need a free GitHub account, and reports are public.">
      <svg aria-hidden viewBox="0 0 16 16" className="h-4 w-4"><path d="M3 14V2m0 1h8l-1.5 3L11 9H3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>
      Report an issue
    </a>
  );
}
