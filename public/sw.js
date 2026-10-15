/*
 * SafePath offline support: lets the child's screens open and the map show with no mobile data.
 * Online, everything comes fresh from the network (so updates and dev changes are never stale);
 * the cached copy is used only when the network fails. Map tiles are reused as they are.
 */
const APP_CACHE = "safepath-app-v1";
const TILE_CACHE = "safepath-tiles-v1";
const MAX_TILES = 400;
// Screens the child needs to get home; other pages and all API calls stay online-only.
const OFFLINE_PAGES = ["/tracker", "/tracker/companion"];

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== APP_CACHE && key !== TILE_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function isAppAsset(url) {
  return url.origin === self.location.origin && (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/companions/") ||
    url.pathname === "/icon" || url.pathname === "/icon-192" || url.pathname === "/manifest.webmanifest"
  );
}

function isOfflinePage(url, request) {
  return url.origin === self.location.origin && OFFLINE_PAGES.includes(url.pathname) &&
    (request.mode === "navigate" || request.headers.get("RSC") === "1");
}

async function networkFirst(request, fallbackKey) {
  const cache = await caches.open(APP_CACHE);
  try {
    const response = await fetch(request);
    // Keep only good, same-origin answers; a redirect to the login page must not be cached.
    if (response.ok && response.type === "basic" && !response.redirected) {
      await cache.put(fallbackKey ?? request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(fallbackKey ?? request, { ignoreVary: true });
    if (cached) return cached;
    throw error;
  }
}

async function trimTiles(cache) {
  const keys = await cache.keys();
  for (let index = 0; index < keys.length - MAX_TILES; index += 1) await cache.delete(keys[index]);
}

async function tileFromCacheFirst(request) {
  const cache = await caches.open(TILE_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok || response.type === "opaque") {
    await cache.put(request, response.clone());
    void trimTiles(cache);
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (url.hostname.endsWith("tile.openstreetmap.org")) {
    event.respondWith(tileFromCacheFirst(request));
  } else if (isOfflinePage(url, request)) {
    // Page HTML and its React data are stored under separate keys so each falls back to its own kind.
    const key = request.mode === "navigate" ? url.pathname : `${url.pathname}?__rsc`;
    event.respondWith(networkFirst(request, key));
  } else if (isAppAsset(url)) {
    event.respondWith(networkFirst(request));
  }
});
