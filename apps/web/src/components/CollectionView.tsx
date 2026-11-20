"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CHALLENGES } from "@/lib/challenges";
import { formatImportedDate } from "@/lib/dates";
import {
  createCollection, deleteCollection, exportProgress, importProgress, renameCollection, resetProgress, setInCollection, toggleBookmark, totalXp, useProgress, type SavedItem,
} from "@/lib/progress";
import { STORIES } from "@/lib/stories";

type Shared = { name: string; items: { id: string; title: string; href: string; start?: string }[] };

/** A collection travels in the link itself: its name and items, encoded. Nothing is uploaded. */
function encodeShare(s: Shared) {
  const bytes = new TextEncoder().encode(JSON.stringify(s));
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function decodeShare(code: string): Shared | null {
  try {
    const bin = atob(code.replace(/-/g, "+").replace(/_/g, "/"));
    const data = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))) as Shared;
    if (typeof data.name !== "string" || !Array.isArray(data.items)) return null;
    // Only links inside this site, so a shared collection can't point elsewhere.
    data.items = data.items.filter((i) => typeof i.href === "string" && i.href.startsWith("/") && !i.href.startsWith("//")).slice(0, 200);
    return data;
  } catch {
    return null;
  }
}

const sortByDate = (a: SavedItem, b: SavedItem) => (a.start ?? "").localeCompare(b.start ?? "");

export function CollectionView() {
  const p = useProgress();
  const [shared, setShared] = useState<Shared | null>(null);
  const [newName, setNewName] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("shared");
    if (code) setShared(decodeShare(code));
  }, []);

  const bookmarks = useMemo(() => Object.values(p.bookmarks).sort((a, b) => b.savedAt.localeCompare(a.savedAt)), [p.bookmarks]);
  const notes = Object.entries(p.notes).sort(([, a], [, b]) => b.updatedAt.localeCompare(a.updatedAt));
  const explored = Object.values(p.explored);
  const completedChallenges = CHALLENGES.filter((c) => p.results.some((r) => r.id === c.id && r.mode === "challenge")).length;
  const stories = STORIES.map((s) => ({ s, saved: p.stories[s.id] })).filter((x) => x.saved);

  const share = async (name: string, items: SavedItem[]) => {
    const url = `${window.location.origin}${window.location.pathname}?shared=${encodeShare({ name, items: items.map(({ id, title, href, start }) => ({ id, title, href, start })) })}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(name);
      setTimeout(() => setCopied(null), 2500);
    } catch {
      window.prompt("Copy this link", url);
    }
  };

  const empty = !bookmarks.length && !notes.length && !p.collections.length && !stories.length && !p.results.length;

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6">
      <p className="eyebrow">My Collection</p>
      <h1 className="mt-2 font-serif text-4xl leading-tight sm:text-5xl">Your saved history</h1>
      <p className="mt-2 max-w-2xl text-ink-2">
        Bookmarks, notes, collections and progress. <strong className="text-ink">Everything here is stored in this browser only</strong>: there are no accounts yet, so it won&rsquo;t follow you to another device, and clearing your browser data removes it. You can download a copy below.
      </p>

      {shared && (
        <section className="mt-8 rounded-lg border-2 border-bronze/60 bg-paper-2 p-5" aria-labelledby="shared" data-testid="shared-collection">
          <p className="eyebrow">Shared with you</p>
          <h2 id="shared" className="mt-1 font-serif text-2xl">{shared.name}</h2>
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {shared.items.map((i) => (
              <li key={i.id} className="flex items-baseline gap-3 py-2">
                {i.start && <span className="w-24 shrink-0 text-xs text-ink-2">{formatImportedDate(i.start, undefined, "year")}</span>}
                <Link href={i.href} className="min-w-0 flex-1 font-serif text-lg hover:text-bronze">{i.title}</Link>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="btn btn-primary mt-4"
            onClick={() => {
              shared.items.forEach((i) => { if (!p.bookmarks[i.id]) toggleBookmark({ ...i }); });
              createCollection(shared.name, shared.items.map((i) => i.id));
              setShared(null);
              setMessage(`“${shared.name}” was added to your collections.`);
              window.history.replaceState(null, "", window.location.pathname);
            }}
          >
            Save to my collections
          </button>
        </section>
      )}
      {message && <p role="status" className="mt-4 text-sm text-navy">{message}</p>}

      <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Saved", bookmarks.length],
          ["Places explored", explored.length],
          ["Challenges done", `${completedChallenges}/${CHALLENGES.length}`],
          ["XP", totalXp(p)],
        ].map(([k, v]) => (
          <div key={k} className="card p-4"><dt className="text-xs text-ink-2">{k}</dt><dd className="mt-1 font-serif text-3xl tabular-nums">{v}</dd></div>
        ))}
      </dl>

      {empty && (
        <section className="mt-10 rounded-lg border border-dashed border-line p-8 text-center">
          <h2 className="font-serif text-2xl">Nothing saved yet</h2>
          <p className="mx-auto mt-2 max-w-md text-ink-2">Press <strong>Save</strong> on any event to keep it here, add notes as you read, and group events into your own timelines.</p>
          <div className="mt-4 flex justify-center gap-2"><Link href="/atlas" className="btn btn-primary">Explore the map</Link><Link href="/stories" className="btn btn-secondary">Follow a story</Link></div>
        </section>
      )}

      {stories.length > 0 && (
        <section className="mt-10" aria-labelledby="stories-progress">
          <h2 id="stories-progress" className="font-serif text-2xl">Stories</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {stories.map(({ s, saved }) => (
              <li key={s.id}>
                <Link href={saved!.finished || s.kind === "case" ? s.href : `${s.href}?chapter=${saved!.chapterId}&step=${saved!.step}`} className="card block p-4">
                  <span className={`badge ${saved!.finished ? "text-navy" : "text-bronze"}`}>{saved!.finished ? "✓ Finished" : "In progress"}</span>
                  <span className="mt-2 block font-serif text-xl">{s.title}</span>
                  <span className="text-sm text-ink-2">{saved!.visited.length} of {s.chapters.length} chapters visited</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {bookmarks.length > 0 && (
        <section className="mt-10" aria-labelledby="saved">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="saved" className="font-serif text-2xl">Saved events</h2>
            <button type="button" onClick={() => share("My saved events", bookmarks)} className="btn btn-sm btn-ghost">{copied === "My saved events" ? "Link copied" : "Share as a link"}</button>
          </div>
          <ul className="mt-3 divide-y divide-line border-y border-line" data-testid="bookmarks">
            {bookmarks.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="w-24 shrink-0 text-xs text-ink-2">{b.start ? formatImportedDate(b.start, undefined, "year") : ""}</span>
                <Link href={b.href} className="min-w-0 flex-1 font-serif text-lg hover:text-bronze">{b.title}</Link>
                {p.collections.length > 0 && (
                  <label className="text-sm">
                    <span className="sr-only">Add {b.title} to a collection</span>
                    <select value="" onChange={(e) => e.target.value && setInCollection(e.target.value, b.id, true)} className="rounded border border-line bg-paper-2 px-2 py-1 text-sm">
                      <option value="">Add to…</option>
                      {p.collections.map((c) => <option key={c.id} value={c.id} disabled={c.itemIds.includes(b.id)}>{c.name}</option>)}
                    </select>
                  </label>
                )}
                <button type="button" onClick={() => toggleBookmark(b)} className="btn btn-sm btn-ghost">Remove</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10" aria-labelledby="collections">
        <h2 id="collections" className="font-serif text-2xl">Collections and personal timelines</h2>
        <p className="mt-1 text-sm text-ink-2">Group saved events under a name. Each collection is shown as a timeline, in date order, and can be shared as a link that carries its contents.</p>
        <form className="mt-3 flex max-w-md gap-2" onSubmit={(e) => { e.preventDefault(); if (newName.trim()) { createCollection(newName); setNewName(""); } }}>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Revolutions I want to compare" aria-label="New collection name" className="field" />
          <button type="submit" className="btn btn-secondary" disabled={!newName.trim()}>Create</button>
        </form>
        <ul className="mt-4 grid gap-4 md:grid-cols-2">
          {p.collections.map((c) => {
            const items = c.itemIds.map((id) => p.bookmarks[id]).filter(Boolean).sort(sortByDate);
            return (
              <li key={c.id} className="card p-4" data-testid="collection">
                <div className="flex items-start justify-between gap-2">
                  <input defaultValue={c.name} onBlur={(e) => renameCollection(c.id, e.target.value)} aria-label="Collection name" className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 font-serif text-xl hover:border-line focus:border-bronze focus:outline-none" />
                  <button type="button" onClick={() => share(c.name, items)} disabled={!items.length} className="btn btn-sm btn-ghost">{copied === c.name ? "Copied" : "Share"}</button>
                  <button type="button" onClick={() => { if (window.confirm(`Delete “${c.name}”? The saved events stay saved.`)) deleteCollection(c.id); }} className="btn btn-sm btn-ghost">Delete</button>
                </div>
                {items.length ? (
                  <ol className="relative mt-3 space-y-2 border-l-2 border-bronze/50 pl-4">
                    {items.map((i) => (
                      <li key={i.id} className="relative">
                        <span aria-hidden className="absolute -left-[1.4rem] top-1.5 h-2.5 w-2.5 rounded-full bg-bronze" />
                        <span className="block text-xs text-ink-2">{i.start ? formatImportedDate(i.start, undefined, "year") : "Undated"}</span>
                        <span className="flex items-baseline gap-2">
                          <Link href={i.href} className="min-w-0 flex-1 hover:text-bronze">{i.title}</Link>
                          <button type="button" onClick={() => setInCollection(c.id, i.id, false)} className="text-xs text-ink-2 hover:text-oxblood" aria-label={`Remove ${i.title} from ${c.name}`}>✕</button>
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-3 text-sm text-ink-2">Empty. Use “Save ▾” on an event to add it here.</p>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {notes.length > 0 && (
        <section className="mt-10" aria-labelledby="notes">
          <h2 id="notes" className="font-serif text-2xl">Your notes</h2>
          <ul className="mt-3 grid gap-3 md:grid-cols-2">
            {notes.map(([id, n]) => (
              <li key={id} className="card p-4">
                <Link href={n.href} className="font-serif text-lg hover:text-bronze">{n.title}</Link>
                <p className="mt-1 whitespace-pre-wrap text-sm text-ink-2">{n.text}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(explored.length > 0 || p.mistakes.length > 0) && (
        <section className="mt-10 grid gap-6 md:grid-cols-2">
          {explored.length > 0 && (
            <div>
              <h2 className="font-serif text-2xl">Places explored</h2>
              <ul className="mt-3 flex flex-wrap gap-2">{explored.map((e) => <li key={e.href}><Link href={e.href} className="chip">{e.label}</Link></li>)}</ul>
            </div>
          )}
          {p.mistakes.length > 0 && (
            <div>
              <h2 className="font-serif text-2xl">Topics to revisit</h2>
              <ul className="mt-3 space-y-1 text-sm">{p.mistakes.slice(-5).reverse().map((m) => <li key={m.prompt}>{m.prompt}</li>)}</ul>
              <Link href="/challenges#review" className="link mt-2 inline-block text-sm">Review them</Link>
            </div>
          )}
        </section>
      )}

      <section className="mt-12 rounded-lg border border-line p-5" aria-labelledby="backup">
        <h2 id="backup" className="font-serif text-xl">Keep a copy</h2>
        <p className="mt-1 text-sm text-ink-2">Download everything as a file, and load it in another browser to carry on there.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => {
              const url = URL.createObjectURL(new Blob([exportProgress()], { type: "application/json" }));
              const a = Object.assign(document.createElement("a"), { href: url, download: "timewise-progress.json" });
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Download my data
          </button>
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => file.current?.click()}>Load from a file</button>
          <input
            ref={file}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                importProgress(await f.text());
                setMessage("Your data was loaded.");
              } catch {
                setMessage("That file isn't a TIMEWISE progress file.");
              }
            }}
          />
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => { if (window.confirm("Remove all saved events, notes, collections and progress from this browser?")) resetProgress(); }}>Clear everything</button>
        </div>
      </section>
    </main>
  );
}
