/* Service worker for offline use.
   - App shell (page, fonts, icons) is precached.
   - Navigations are network-first (so updates show when online), cache fallback offline.
   - Other same-origin GETs are cache-first with background refresh.
   Bump CACHE when files change to retire old caches. */
const CACHE = "tpobs-v2";
const SHELL = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/form-header.png",
  "/fonts/Faruma.woff2",
  "/fonts/Faruma.woff"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Page navigations: network-first so the latest version loads when online.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then(res => {
        caches.open(CACHE).then(c => c.put("/index.html", res.clone())).catch(() => {});
        return res;
      }).catch(() => caches.match(req).then(r => r || caches.match("/index.html")))
    );
    return;
  }

  // Same-origin assets: cache-first, refresh in background.
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then(cached => {
        const net = fetch(req).then(res => {
          if (res && res.ok) caches.open(CACHE).then(c => c.put(req, res.clone())).catch(() => {});
          return res;
        }).catch(() => cached);
        return cached || net;
      })
    );
  }
  // Cross-origin (Amiri font, analytics): let the browser handle it; fails gracefully offline.
});
