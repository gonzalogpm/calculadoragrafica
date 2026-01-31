
const CACHE_NAME = 'creastickers-v3';
const ASSETS_TO_CACHE = [
  './index.html',
  './manifest.json',
  'https://cdn-icons-png.flaticon.com/512/9402/9402314.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Usamos addAll de forma segura, si falla un recurso externo no bloquea todo
      return cache.addAll(ASSETS_TO_CACHE).catch(err => console.log('Cache partial fail', err));
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
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      
      return fetch(event.request).catch(() => {
        // Si falla la red (offline) o hay un error, devolvemos index.html
        // Esto evita el error 404 visual en la PWA
        return caches.match('./index.html');
      });
    })
  );
});
