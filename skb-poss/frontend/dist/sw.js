// KSB POSS Service Worker — enables offline caching and PWA installability
const CACHE_NAME = 'ksb-poss-v2';

// Assets to pre-cache on install
const PRE_CACHE = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/manifest.json',
];

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first strategy: try network, fall back to cache
self.addEventListener('fetch', event => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Skip API requests — always go to network for fresh data
  if (event.request.url.includes('/api/')) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache successful HTML/JS/CSS/image responses
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
