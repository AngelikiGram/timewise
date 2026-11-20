"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { API_URL, HAS_API, RELATION_LABELS, type Relation } from "@/lib/api";

type Link = { claim_id: string; relation: Relation; note: string; statement: string };
type ArchiveRecord = {
  id: number; title: string; creator: string | null; date_text: string | null; language: string | null; record_type: string | null; institution: string | null;
  url: string | null; preview_url: string | null; media_rights: string | null; reproduction: string; workflow: string; source_query: string; description: string | null; links: Link[];
};
type Claim = { id: string; statement: string; support: string; event_id: string; event_title: string; event_date: string };
type Workflow = "imported" | "reviewed" | "rejected";

const TABS: { id: Workflow; label: string }[] = [
  { id: "imported", label: "To review" },
  { id: "reviewed", label: "Linked" },
  { id: "rejected", label: "Rejected" },
];
const PAGE = 20;
const KEY_STORE = "timewise-admin-key";

const button = "rounded-sm border border-line px-3 py-1.5 text-sm transition-colors hover:border-bronze hover:text-bronze disabled:opacity-40";
const primary = "rounded-sm bg-navy px-3 py-1.5 text-sm font-medium text-on-accent transition-opacity disabled:opacity-40 dark:bg-bronze";

function LinkForm({ claims, onCancel, onSave }: { claims: Claim[]; onCancel: () => void; onSave: (claimId: string, relation: Relation, note: string) => Promise<void> }) {
  const events = useMemo(() => [...new Map(claims.map((c) => [c.event_id, c])).values()], [claims]);
  const [eventId, setEventId] = useState("");
  const [claimId, setClaimId] = useState("");
  const [relation, setRelation] = useState<Relation>("illustrates");
  const [note, setNote] = useState("");
  const options = claims.filter((c) => c.event_id === eventId);
  const ready = claimId && note.trim().length >= 10;

  return (
    <form
      className="mt-3 space-y-3 border-t border-line pt-3 text-sm"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) void onSave(claimId, relation, note.trim());
      }}
    >
      <label className="block">
        Event
        <select aria-label="Event" value={eventId} onChange={(e) => { setEventId(e.target.value); setClaimId(""); }} className="mt-1 block w-full border border-line bg-paper p-2">
          <option value="">Choose an event…</option>
          {events.map((c) => <option key={c.event_id} value={c.event_id}>{c.event_date.slice(0, 4)}, {c.event_title}</option>)}
        </select>
      </label>
      {eventId && (
        <label className="block">
          Claim
          <select aria-label="Claim" value={claimId} onChange={(e) => setClaimId(e.target.value)} className="mt-1 block w-full border border-line bg-paper p-2">
            <option value="">Choose a claim…</option>
            {options.map((c) => <option key={c.id} value={c.id}>{c.statement}</option>)}
          </select>
        </label>
      )}
      <fieldset>
        <legend>How does this record relate to the claim?</legend>
        <div className="mt-1 space-y-1">
          {(Object.keys(RELATION_LABELS) as Relation[]).map((r) => (
            <label key={r} className="flex cursor-pointer items-baseline gap-2">
              <input type="radio" name="relation" checked={relation === r} onChange={() => setRelation(r)} className="accent-[var(--bronze)]" />
              <span><strong className="font-medium">{RELATION_LABELS[r].label}:</strong> <span className="text-ink-2">{RELATION_LABELS[r].help}</span></span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block">
        Why? This appears on the site, so check it against the record.
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={1000} className="mt-1 block w-full border border-line bg-paper p-2" />
      </label>
      <div className="flex gap-2">
        <button type="submit" disabled={!ready} className={primary}>Save link</button>
        <button type="button" onClick={onCancel} className={button}>Cancel</button>
      </div>
    </form>
  );
}

export default function AdminPage() {
  const [key, setKey] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const [tab, setTab] = useState<Workflow>("imported");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [records, setRecords] = useState<ArchiveRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [linking, setLinking] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const latestRequest = useRef(0);

  const call = useCallback(
    async (path: string, init?: RequestInit) => {
      const r = await fetch(`${API_URL}${path}`, { ...init, headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" } });
      if (r.status === 401) {
        setKey(null);
        throw new Error("Your admin key was refused.");
      }
      if (!r.ok) throw new Error((await r.json().catch(() => null))?.detail ?? `The API returned ${r.status}.`);
      return r.json();
    },
    [key],
  );

  const load = useCallback(async () => {
    if (!key) return;
    // A slow older reply must not overwrite a newer one, such as the list after a decision.
    const request = ++latestRequest.current;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ workflow: tab, limit: String(PAGE), offset: String(offset) });
      if (query.trim()) params.set("q", query.trim());
      const body = await call(`/admin/records?${params}`);
      if (request !== latestRequest.current) return;
      setRecords(body.items);
      setTotal(body.total);
    } catch (e) {
      if (request === latestRequest.current) setError((e as Error).message);
    } finally {
      if (request === latestRequest.current) setLoading(false);
    }
  }, [key, tab, offset, query, call]);

  // Kept for this browser tab only, and gone when it closes.
  useEffect(() => {
    try {
      setKey(sessionStorage.getItem(KEY_STORE));
    } catch {}
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (key) call("/admin/claims").then(setClaims).catch((e) => setError(e.message));
  }, [key, call]);

  const act = async (path: string, init?: RequestInit) => {
    setError("");
    try {
      await call(path, init);
      setLinking(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (!HAS_API) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-md px-4 py-16">
          <h1 className="font-serif text-3xl">Record review</h1>
          <p className="mt-3 leading-relaxed text-ink-2">Reviewing records needs the TIMEWISE API and its database, which aren&rsquo;t part of this public site. It works on a local copy started with <code>npm run api</code>.</p>
        </main>
      </>
    );
  }

  if (!key) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-md px-4 py-16">
          <h1 className="font-serif text-3xl">Record review</h1>
          <p className="mt-2 text-ink-2">Enter the admin key to continue.</p>
          <form
            className="mt-5 space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setLoginError("");
              try {
                const r = await fetch(`${API_URL}/admin/session`, { headers: { Authorization: `Bearer ${keyInput}` } });
                if (r.status === 401) return setLoginError("That key isn't right.");
                if (!r.ok) return setLoginError("The server isn't set up for review yet.");
                try {
                  sessionStorage.setItem(KEY_STORE, keyInput);
                } catch {}
                setKey(keyInput);
                setKeyInput("");
              } catch {
                setLoginError("The API isn't reachable. Is it running? Start it with: npm run api");
              }
            }}
          >
            <label className="block text-sm">
              Admin key
              <input type="password" autoComplete="off" value={keyInput} onChange={(e) => setKeyInput(e.target.value)} className="mt-1 block w-full border border-line bg-paper-2 p-2" />
            </label>
            <button type="submit" disabled={!keyInput} className={primary}>Continue</button>
            {loginError && <p role="alert" className="text-sm text-oxblood">{loginError}</p>}
          </form>
        </main>
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="font-serif text-3xl">Record review</h1>
          <button type="button" className="text-sm text-bronze underline-offset-2 hover:underline" onClick={() => { try { sessionStorage.removeItem(KEY_STORE); } catch {} setKey(null); }}>Sign out</button>
        </div>
        <p className="mt-2 max-w-2xl text-ink-2">
          These records came from an archive search, so a match only means the words matched. Reject what&rsquo;s off-topic. Link what belongs, and it appears on the site straight away.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3 border-b border-line">
          <div role="tablist" aria-label="Review status" className="flex">
            {TABS.map((t) => (
              <button key={t.id} role="tab" type="button" aria-selected={tab === t.id} onClick={() => { setTab(t.id); setOffset(0); setLinking(null); }} className={`border-b-2 px-3 py-2 text-sm ${tab === t.id ? "border-bronze font-medium" : "border-transparent text-ink-2"}`}>
                {t.label}
              </button>
            ))}
          </div>
          <input aria-label="Filter records" value={query} onChange={(e) => { setQuery(e.target.value); setOffset(0); }} placeholder="Filter by title, topic, institution…" className="mb-1 ml-auto min-w-0 flex-1 rounded-full border border-line bg-transparent px-3 py-1 text-sm outline-none focus:border-bronze sm:max-w-xs" />
        </div>

        {error && <p role="alert" className="mt-4 border border-oxblood p-3 text-sm text-oxblood">{error}</p>}
        <p role="status" className="mt-4 text-sm text-ink-2">{loading ? "Loading…" : `${total} record${total === 1 ? "" : "s"}`}</p>

        <ul className="mt-3 space-y-4">
          {records.map((r) => (
            <li key={r.id} data-testid="review-record" className="border border-line bg-paper-2 p-4">
              <div className="flex flex-col gap-4 sm:flex-row">
                {r.preview_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.preview_url} alt="" loading="lazy" className="h-36 w-full shrink-0 border border-line object-cover sm:w-44" />
                )}
                <div className="min-w-0 flex-1">
                  <h2 className="font-serif text-xl leading-snug">{r.title}</h2>
                  <p className="mt-1 text-sm text-ink-2">{[r.creator, r.date_text, r.institution, r.record_type, r.language].filter(Boolean).join(", ")}</p>
                  {r.description && r.description.trim() !== r.title.trim() && <p className="mt-2 line-clamp-3 text-sm text-ink-2">{r.description}</p>}
                  <p className="mt-2 text-xs text-ink-2">Found by searching: {r.source_query}</p>
                  <p className="mt-1 break-words text-xs">
                    <span className={r.reproduction === "permitted_with_attribution" ? "font-medium text-navy" : "font-medium text-oxblood"}>
                      {r.reproduction === "permitted_with_attribution" ? "Image can be shown" : "Link only"}
                    </span>
                    <span className="text-ink-2">, {r.media_rights ?? "No rights statement"}</span>
                  </p>
                  {r.url && <a href={r.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-sm text-bronze underline-offset-2 hover:underline">Open the record ↗</a>}
                  {r.links.length > 0 && (
                    <ul className="mt-3 space-y-2">
                      {r.links.map((l) => (
                        <li key={l.claim_id} className="border-l-2 border-bronze pl-3 text-sm">
                          <strong className="font-medium">{RELATION_LABELS[l.relation].label}:</strong> {l.statement}
                          <span className="mt-0.5 block text-ink-2">{l.note}</span>
                          <button type="button" onClick={() => act(`/admin/records/${r.id}/link/${encodeURIComponent(l.claim_id)}`, { method: "DELETE" })} className="mt-1 text-xs text-oxblood underline-offset-2 hover:underline">Remove link</button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {r.workflow === "rejected" ? (
                      <button type="button" className={button} onClick={() => act(`/admin/records/${r.id}/reopen`, { method: "POST" })}>Reopen</button>
                    ) : (
                      <>
                        <button type="button" className={button} onClick={() => setLinking(linking === r.id ? null : r.id)}>Link to a claim</button>
                        {r.links.length === 0 && <button type="button" className={button} onClick={() => act(`/admin/records/${r.id}/reject`, { method: "POST", body: "{}" })}>Reject</button>}
                      </>
                    )}
                  </div>
                </div>
              </div>
              {linking === r.id && (
                <LinkForm claims={claims} onCancel={() => setLinking(null)} onSave={(claim_id, relation, note) => act(`/admin/records/${r.id}/link`, { method: "POST", body: JSON.stringify({ claim_id, relation, note }) })} />
              )}
            </li>
          ))}
        </ul>

        {total > PAGE && (
          <nav aria-label="Pages" className="mt-6 flex items-center gap-3 text-sm">
            <button type="button" className={button} disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>Previous</button>
            <span className="text-ink-2">{offset + 1}–{Math.min(offset + PAGE, total)} of {total}</span>
            <button type="button" className={button} disabled={offset + PAGE >= total} onClick={() => setOffset(offset + PAGE)}>Next</button>
          </nav>
        )}
      </main>
    </>
  );
}
