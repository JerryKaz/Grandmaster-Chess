/*
 * Service worker: makes the app installable and lets it open (and play bots/puzzles) offline.
 * - Pages: network first, cached copy when offline (so updates show up immediately).
 * - Hashed build assets, pieces and the engine: cache first (their names change when they change).
 * - Everything else (icons, puzzles): stale-while-revalidate.
 * - API calls and the WebSocket are never touched.
 */
const VERSION = 'gm-v3';
const PRECACHE = ['/', '/manifest.webmanifest', '/icon-192.png', '/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const cacheFirst = async (request) => {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) (await caches.open(VERSION)).put(request, response.clone());
  return response;
};

const networkFirst = async (request) => {
  try {
    const response = await fetch(request);
    if (response.ok) (await caches.open(VERSION)).put('/', response.clone());
    return response;
  } catch {
    return (await caches.match('/')) || Response.error();
  }
};

const staleWhileRevalidate = async (request) => {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(request);
  const fresh = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || fresh;
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname === '/ws') return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
  } else if (/^\/(assets|pieces|engine)\//.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
  } else {
    event.respondWith(staleWhileRevalidate(request));
  }
});
