/* ============================================================================
   Service Worker — makes the whole game playable OFFLINE.

   Strategy: precache every file on install (all same-origin, so no CORS/opaque
   pitfalls), then serve cache-first. Bump CACHE_VERSION whenever you change any
   file so phones pull the fresh copy on the next online launch.
   ========================================================================== */
const CACHE_VERSION = 'voar-v5';

// Every file the game needs offline. Relative paths so it works on GitHub Pages
// subpaths (https://user.github.io/repo/) and on localhost alike.
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './game.js',
  './manifest.json',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/apple-touch-icon-180.png',
  './assets/map/resort-map.jpg',
  './assets/ventureoutlogo.jpeg',
  './assets/frontsign.jpg',
  './assets/fonts/ribeye-latin-400.woff2',
  './assets/fonts/fredoka-latin-var.woff2',
];

// Install: precache the whole app shell + assets, then activate immediately.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: drop any old caches from previous versions.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch: cache-first. Fall back to the network, and if a navigation fails while
// offline, serve the cached index.html so the app still opens.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          // Cache any new same-origin GET we successfully fetch (e.g. swapped art).
          if (res && res.ok && new URL(req.url).origin === self.location.origin) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => {
          if (req.mode === 'navigate') return caches.match('./index.html');
        });
    })
  );
});
