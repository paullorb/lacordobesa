// Minimal service worker for the staff PWA: network-first, with an offline fallback page.
// Data must always be fresh, so nothing from /staff is cached except the offline page itself.
//
// This file never changes between deploys, so the browser never sees a "new" worker and `install`
// does not run again. The cached offline page is Next's HTML and points at hashed CSS/JS files
// that change with every build, so a copy taken once at install would go stale and, offline,
// reference assets that no longer exist. The copy is therefore re-fetched: on activation, and on a
// navigation that succeeds more than REFRESH_MS after the last refresh. Bumping CACHE still forces
// a clean start (it makes this file different, which installs a new worker).
const CACHE = "cordobesa-staff-v4";
const OFFLINE_URL = "/staff/offline";
const REFRESH_MS = 60 * 60 * 1000;
let lastRefresh = 0;

/** Stores the current offline page. Quiet on failure: the previous copy stays. A redirect (to the
 *  login page, say) or an error status is not the offline page and is never stored. */
async function refreshOffline() {
  lastRefresh = Date.now();
  try {
    const response = await fetch(OFFLINE_URL, { cache: "reload", credentials: "same-origin" });
    if (!response.ok || response.redirected) return;
    const cache = await caches.open(CACHE);
    await cache.put(OFFLINE_URL, response);
  } catch {
    lastRefresh = 0; // try again on the next successful navigation
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.add(OFFLINE_URL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(refreshOffline),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).then(
      (response) => {
        // The network works, so this is a good moment to keep the fallback current.
        if (Date.now() - lastRefresh > REFRESH_MS) event.waitUntil(refreshOffline());
        return response;
      },
      () => caches.match(OFFLINE_URL),
    ),
  );
});
