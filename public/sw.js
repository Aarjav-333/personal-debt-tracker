/*
 * Service worker for Debt Ledger.
 *
 * What it does:
 *   - Precaches the app shell so an installed PWA opens instantly, and opens
 *     at all without a connection.
 *   - Serves previously visited screens from cache when the network is gone.
 *   - Never touches writes. Every mutation is a POST to a Server Action and
 *     goes straight to the network, so a repayment is either recorded now or
 *     not at all. Queuing financial writes for a later, out-of-order replay
 *     would be worse than refusing them.
 *
 * Bump CACHE_VERSION to retire every previous cache on the next activation.
 */

const CACHE_VERSION = "v1";
const SHELL_CACHE = `ledger-shell-${CACHE_VERSION}`;
const PAGES_CACHE = `ledger-pages-${CACHE_VERSION}`;
const ASSETS_CACHE = `ledger-assets-${CACHE_VERSION}`;

const OWN_CACHES = new Set([SHELL_CACHE, PAGES_CACHE, ASSETS_CACHE]);

const SHELL_ASSETS = [
  "/offline",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // One failed asset must not abandon the whole install.
      await Promise.allSettled(SHELL_ASSETS.map((asset) => cache.add(asset)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => !OWN_CACHES.has(key)).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

/**
 * Signing out wipes the cached pages, so the next person to open the app on
 * this device cannot page back through someone else's balances.
 */
self.addEventListener("message", (event) => {
  if (event.data?.type !== "CLEAR_PRIVATE_CACHES") return;

  event.waitUntil(
    caches.delete(PAGES_CACHE).then(() => {
      // Reply so the page can wait for the clear before ending the session,
      // rather than redirecting while cached screens are still on disk.
      event.ports?.[0]?.postMessage({ type: "CLEARED" });
    }),
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/favicon.ico"
  );
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

/**
 * Fresh when possible, cached when not.
 *
 * Financial figures must never be stale while online, so the network always
 * wins; the cache exists purely so the screen still opens offline.
 */
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);

  try {
    const response = await fetch(request);
    if (response.ok && response.type === "basic") {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Writes, cross-origin calls (Supabase) and CSV exports always go to the
  // network untouched.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname.startsWith("/auth/")) return;

  // React Server Component payloads are keyed by headers the Cache API does
  // not vary on, so caching them would serve the wrong page.
  if (url.searchParams.has("_rsc") || request.headers.get("RSC") === "1") return;

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, ASSETS_CACHE));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await networkFirst(request, PAGES_CACHE);
        } catch {
          const cache = await caches.open(SHELL_CACHE);
          const offline = await cache.match("/offline");
          return (
            offline ??
            new Response("You are offline.", {
              status: 503,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            })
          );
        }
      })(),
    );
  }
});
