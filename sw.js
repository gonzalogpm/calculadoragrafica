
const CACHE_NAME = 'creastickers-v2';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  'https://cdn-icons-png.flaticon.com/512/9402/9402314.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Solo cachear peticiones GET de nuestro propio dominio o CDN de iconos
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(event.request).catch(() => {
        // Fallback si no hay red y no está en cache
        return caches.match('./index.html');
      });
    })
  );
});

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const options = {
    body: data.body || 'Nuevo movimiento en el taller',
    icon: 'https://cdn-icons-png.flaticon.com/512/9402/9402314.png',
    badge: 'https://cdn-icons-png.flaticon.com/512/9402/9402314.png',
    data: data.url || '/'
  };
  event.waitUntil(self.registration.showNotification(data.title || 'CreaStickers', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data));
});
