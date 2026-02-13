/* iPad Visitor Log PWA Service Worker
   - App-shell caching for offline use
   - Network-first for HTML (so updates apply), cache-first for assets
*/

const CACHE_VERSION = "v1.0.1";
const CACHE_NAME = `visitor-log-${CACHE_VERSION}`;

// Update this list to match your actual filenames
const APP_SHELL = [
  "./",
  "./index.html",     // welcome/start page
  "./app.html",       // main visitor log app
  "./manifest.json",

  // Logos / icons
  "./CSELogo.png",    // welcome page logo
  "./logo.png",       // app header logo (keep if used)
  "./logo-192.png",
  "./logo-512.png",
  "./logo-maskable-512.png"
];

// Install: cache core files
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(APP_SHELL);
      await self.skipWaiting();
    })()
  );
});

// Activate: cleanup old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("visitor-log-") && k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

// Fetch strategy
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only handle GET
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Only same-origin (avoid caching 3rd party)
  if (url.origin !== self.location.origin) return;

  const isHTML =
    req.mode === "navigate" ||
    (req.headers.get("accept") || "").includes("text/html") ||
    url.pathname.endsWith(".html");

  if (isHTML) {
    // Network-first for HTML so you get updates when online
    event.respondWith(networkFirst(req));
  } else {
    // Cache-first for assets (fast + offline)
    event.respondWith(cacheFirst(req));
  }
});

async function cacheFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);
  if (cached) return cached;

  const res = await fetch(req);
  if (res && res.ok) cache.put(req, res.clone());
  return res;
}

async function networkFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const cached = await cache.match(req);
    if (cached) return cached;

    // Fallback to cached index for navigation if present
    const fallback = await cache.match("./index.html");
    if (fallback) return fallback;

    throw err;
  }
}
