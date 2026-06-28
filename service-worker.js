// 1. Add a version number for easier cache management
const CACHE_VERSION = 'v1'; 
const CACHE_NAME = 'broski-tabung-' + CACHE_VERSION;
const CORE_ASSETS = ['./', './index.html', './Broski.jpg', './manifest.json'];

self.addEventListener('install', event => {
  // Use skipWaiting to activate immediately after installing
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS))
  );
});

self.addEventListener('activate', event => {
  // Clear old caches that don't match the current CACHE_NAME
  event.waitUntil(
    caches.keys().then(keys => 
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      // Return cached version OR fetch from network
      return cachedResponse || fetch(event.request).then(networkResponse => {
        // Cache the new network response
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      });
    })
  );
});
