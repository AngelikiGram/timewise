/**
 * Service Worker for TIMEWISE - caches map tiles, region data, and static assets
 * for faster subsequent loads and offline support.
 */
const CACHE_NAME = "timewise-v1";
const TILE_CACHE_NAME = "timewise-tiles-v1";
const DATA_CACHE_NAME = "timewise-data-v1";

// Assets to cache immediately on install
const PRECACHE_ASSETS = [
  "/",
  "/atlas",
  "/explore",
  "/history",
  "/data/regions.json",
  // Font files will be cached by the browser automatically
];

// Cache strategies
const CACHE_FIRST = "cache-first";
const NETWORK_FIRST = "network-first";
const STALE_WHILE_REVALIDATE = "stale-while-revalidate";

const ROUTE_STRATEGIES = [
  // Map tiles - cache first, very long TTL
  { pattern: /^https:\/\/tiles\.openfreemap\.org\/.*\.pbf$/, strategy: CACHE_FIRST, cacheName: TILE_CACHE_NAME, maxAge: 60 * 60 * 24 * 30 }, // 30 days
  { pattern: /^https:\/\/tiles\.openfreemap\.org\/styles\/positron/, strategy: CACHE_FIRST, cacheName: TILE_CACHE_NAME, maxAge: 60 * 60 * 24 * 7 }, // 7 days
  // MapLibre CSS - cache first
  { pattern: /^https:\/\/cdn\.jsdelivr\.net\/npm\/maplibre-gl@.*\/dist\/maplibre-gl\.css$/, strategy: CACHE_FIRST, cacheName: CACHE_NAME, maxAge: 60 * 60 * 24 * 30 },
  // Region data - stale while revalidate
  { pattern: /^\/data\/regions\/.*\.json$/, strategy: STALE_WHILE_REVALIDATE, cacheName: DATA_CACHE_NAME, maxAge: 60 * 60 * 24 }, // 1 day
  // Static assets - cache first
  { pattern: /\.(?:js|css|woff2|png|svg|ico)$/, strategy: CACHE_FIRST, cacheName: CACHE_NAME, maxAge: 60 * 60 * 24 * 30 },
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => ![CACHE_NAME, TILE_CACHE_NAME, DATA_CACHE_NAME].includes(name))
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

async function cacheFirst(request, cacheName, maxAge) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) {
    // Check age
    const cachedDate = new Date(cached.headers.get("sw-cached-at") || 0);
    if (Date.now() - cachedDate.getTime() < maxAge * 1000) {
      return cached;
    }
  }
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cloned = response.clone();
      const headers = new Headers(cloned.headers);
      headers.set("sw-cached-at", new Date().toISOString());
      const cachedResponse = new Response(cloned.body, { status: cloned.status, statusText: cloned.statusText, headers });
      await cache.put(request, cachedResponse);
    }
    return response;
  } catch {
    return cached || new Response("Offline", { status: 503 });
  }
}

async function networkFirst(request, cacheName, maxAge) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cloned = response.clone();
      const headers = new Headers(cloned.headers);
      headers.set("sw-cached-at", new Date().toISOString());
      const cachedResponse = new Response(cloned.body, { status: cloned.status, statusText: cloned.statusText, headers });
      await cache.put(request, cachedResponse);
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) {
      const cachedDate = new Date(cached.headers.get("sw-cached-at") || 0);
      if (Date.now() - cachedDate.getTime() < maxAge * 1000) {
        return cached;
      }
    }
    return new Response("Offline", { status: 503 });
  }
}

async function staleWhileRevalidate(request, cacheName, maxAge) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      const cloned = response.clone();
      const headers = new Headers(cloned.headers);
      headers.set("sw-cached-at", new Date().toISOString());
      const cachedResponse = new Response(cloned.body, { status: cloned.status, statusText: cloned.statusText, headers });
      cache.put(request, cachedResponse);
    }
    return response;
  }).catch(() => cached);
  return cached || fetchPromise;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") return;

  // Skip chrome-extension and other non-http schemes
  if (!url.protocol.startsWith("http")) return;

  // Find matching strategy
  for (const route of ROUTE_STRATEGIES) {
    if (route.pattern.test(request.url)) {
      let promise;
      switch (route.strategy) {
        case CACHE_FIRST:
          promise = cacheFirst(request, route.cacheName, route.maxAge);
          break;
        case NETWORK_FIRST:
          promise = networkFirst(request, route.cacheName, route.maxAge);
          break;
        case STALE_WHILE_REVALIDATE:
          promise = staleWhileRevalidate(request, route.cacheName, route.maxAge);
          break;
      }
      event.respondWith(promise);
      return;
    }
  }

  // Default: network first for HTML, cache first for others
  if (request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(networkFirst(request, CACHE_NAME, 60 * 60)); // 1 hour
  } else {
    event.respondWith(cacheFirst(request, CACHE_NAME, 60 * 60 * 24 * 7)); // 7 days
  }
});

// Message handler for cache management
self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") {
    self.skipWaiting();
  }
  if (event.data === "clearCache") {
    caches.keys().then((names) => Promise.all(names.map((name) => caches.delete(name))));
  }
});