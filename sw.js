
const CACHE_NAME = 'creastickers-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
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
