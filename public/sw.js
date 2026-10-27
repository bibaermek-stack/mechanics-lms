/* Service worker: lets the platform open without a connection.
 *
 * What it does and, as importantly, what it leaves alone:
 *
 *   • /_next/static/*  cache-first. The files are content-hashed, so a cached
 *                      copy is never stale — and they are the app's code, which
 *                      is what makes a page open at all with no network.
 *   • page navigations network-first, with the last good copy as the fallback
 *                      (and /offline.html if the page was never visited). Every
 *                      page here is a client-rendered shell: the HTML carries
 *                      no student data, which is why it is safe to keep. The
 *                      data itself comes from Supabase, cross-origin, and is
 *                      never touched here.
 *   • /models, posters, icons  stale-while-revalidate.
 *
 * Deliberately NOT cached: /api/* (AI answers, Google), anything cross-origin
 * (Supabase), Next's RSC payloads (same URL as the page, different body —
 * the classic way to serve a user raw flight data instead of a page), and
 * video. A lesson film is megabytes served with Range requests, which the
 * Cache API does not answer correctly; it goes straight to the network.
 *
 * Bump VERSION to drop the page and shell caches on the next deploy.
 */

const VERSION = "v1";
const SHELL_CACHE = `shell-${VERSION}`;
const PAGES_CACHE = `pages-${VERSION}`;
// Unversioned on purpose: hashed filenames never go stale, and an old tab
// still needs the chunks of the build it was loaded from.
const STATIC_CACHE = "static";
const ASSET_CACHE = "assets-v1";
const KEEP = [SHELL_CACHE, PAGES_CACHE, STATIC_CACHE, ASSET_CACHE];

const PRECACHE = ["/offline.html", "/manifest.json", "/icon-192.png", "/icon-512.png"];

const MAX_STATIC = 400;
const MAX_PAGES = 60;
// How long to wait for the network before showing a page we already have.
const NETWORK_WAIT_MS = 4000;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => !KEEP.includes(n)).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  // Seeking in a video or audio file. See the note above.
  if (req.headers.has("range")) return;
  // Next's client-side navigation fetches the page's RSC payload from the page URL.
  if (req.headers.get("RSC") || url.searchParams.has("_rsc")) return;

  const path = url.pathname;

  if (path.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(req, STATIC_CACHE, MAX_STATIC));
    return;
  }
  if (path.startsWith("/_next/")) return; // image optimiser, HMR, data routes

  if (path.startsWith("/videos/")) {
    // Posters and captions are small and worth keeping; the films are not.
    if (/\.(jpg|jpeg|png|webp|vtt)$/i.test(path)) event.respondWith(staleWhileRevalidate(req, ASSET_CACHE));
    return;
  }
  if (path.startsWith("/models/") || /^\/(icon|apple-icon)[^/]*\.png$/.test(path)) {
    event.respondWith(staleWhileRevalidate(req, ASSET_CACHE));
    return;
  }

  if (req.mode === "navigate") {
    // The sign-in return carries a one-time code in the query string.
    if (path.startsWith("/auth/")) return;
    event.respondWith(networkFirstPage(req));
  }
});

async function cacheFirst(req, cacheName, max) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) {
    await cache.put(req, res.clone());
    await trim(cache, max);
  }
  return res;
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  const refresh = fetch(req)
    .then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => undefined);
  if (hit) return hit;
  return (await refresh) || Response.error();
}

async function networkFirstPage(req) {
  const cache = await caches.open(PAGES_CACHE);
  // The query string (?next=…, ?source=pwa) does not change the page shell.
  const key = new URL(req.url).pathname;
  const cached = await cache.match(key);

  const network = fetch(req).then(async (res) => {
    // A redirected response cannot be replayed to a navigation, and an error
    // page is not worth keeping.
    if (res.ok && !res.redirected && res.type === "basic") {
      await cache.put(key, res.clone());
      await trim(cache, MAX_PAGES);
    }
    return res;
  });

  if (!cached) {
    try {
      return await network;
    } catch {
      return (await caches.match("/offline.html")) || Response.error();
    }
  }

  // There is a copy to fall back on: prefer fresh, but not at any price.
  const timeout = new Promise((resolve) => setTimeout(() => resolve(cached), NETWORK_WAIT_MS));
  try {
    const res = await Promise.race([network, timeout]);
    return res.status >= 500 ? cached : res;
  } catch {
    return cached;
  }
}

/** Drops the oldest entries once a cache grows past `max`. */
async function trim(cache, max) {
  const keys = await cache.keys();
  if (keys.length <= max) return;
  await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)));
}
