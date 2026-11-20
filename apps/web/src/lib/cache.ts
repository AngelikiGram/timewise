// One shared cache for everything fetched live (Wikidata, Wikipedia, Europeana, Open Library, Our World in Data).
// The same question is never asked twice in a visit, and answers are kept in the browser's Cache Storage for a
// week, so going back to a person, a place or a thing is instant. A caller that gives up (its page was left)
// only stops waiting: the request itself runs on, so the next caller gets the answer.

const STORE = "tw-live-v1";
const WEEK = 7 * 24 * 3600 * 1000;
const memory = new Map<string, Promise<unknown>>();

/** A short, stable key for a long request (SPARQL queries run to several kilobytes). */
function hash(s: string) {
  let h1 = 0xdeadbeef ^ s.length, h2 = 0x41c6ce57 ^ s.length;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
const keyUrl = (key: string) => `https://cache.timewise.local/${hash(key)}`;
const hasCaches = () => typeof window !== "undefined" && "caches" in window;

async function stored<T>(key: string, ttl: number): Promise<T | undefined> {
  if (!hasCaches()) return undefined;
  try {
    const hit = await (await caches.open(STORE)).match(keyUrl(key));
    if (hit && Date.now() - Number(hit.headers.get("x-at") ?? 0) < ttl) return (await hit.json()) as T;
  } catch { /* storage blocked: fetch again */ }
  return undefined;
}
async function keep(key: string, value: unknown) {
  if (!hasCaches()) return;
  try { await (await caches.open(STORE)).put(keyUrl(key), new Response(JSON.stringify(value), { headers: { "content-type": "application/json", "x-at": String(Date.now()) } })); } catch { /* full or blocked */ }
}

/** Stop waiting when `signal` aborts, without cancelling the shared work. */
export function until<T>(p: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return p;
  if (signal.aborted) return Promise.reject(new DOMException("aborted", "AbortError"));
  return new Promise<T>((resolve, reject) => {
    const stop = () => reject(new DOMException("aborted", "AbortError"));
    signal.addEventListener("abort", stop, { once: true });
    p.then((v) => { signal.removeEventListener("abort", stop); resolve(v); }, (e) => { signal.removeEventListener("abort", stop); reject(e); });
  });
}

/** `load()` once per key: from memory, then from Cache Storage, then for real. Failures are not kept. */
export function cached<T>(key: string, load: () => Promise<T>, ttl = WEEK): Promise<T> {
  const hit = memory.get(key);
  if (hit) return hit as Promise<T>;
  const p = (async () => {
    const old = await stored<T>(key, ttl);
    if (old !== undefined) return old;
    const v = await load();
    void keep(key, v);
    return v;
  })();
  memory.set(key, p);
  p.catch(() => memory.delete(key));
  return p;
}

/** GET JSON through the cache. */
export function cachedJson<T>(url: string, signal?: AbortSignal, init?: RequestInit, ttl = WEEK): Promise<T> {
  return until(cached(url, async () => {
    const r = await fetch(url, init);
    if (r.status === 429) throw new Error("The service is busy right now. Try again in a minute.");
    if (!r.ok) throw new Error(`${new URL(url).host} answered ${r.status}.`);
    return (await r.json()) as T;
  }, ttl), signal);
}

/** GET text (CSV) through the cache. */
export function cachedText(url: string, signal?: AbortSignal, ttl = WEEK * 4): Promise<string> {
  return until(cached(url, async () => { const r = await fetch(url); if (!r.ok) throw new Error(`${new URL(url).host} answered ${r.status}.`); return r.text(); }, ttl), signal);
}

/** Warm the cache for something the reader is likely to open next (a hovered result). Errors are ignored. */
export function prefetch(p: () => Promise<unknown>) { try { void p().catch(() => {}); } catch { /* ignore */ } }
