self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) => self.clients.claim());

// Cache opcional básico (habilite se quiser offline parcial da UI)
// const STATIC_CACHE = 'static-v1';
// const ASSETS = [
//   '/', '/index.html', '/manifest.json',
//   '/icons/icon-192.png', '/icons/icon-512.png'
// ];
// self.addEventListener('install', (event) => {
//   event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(ASSETS)));
// });
// self.addEventListener('fetch', (event) => {
//   const { request } = event;
//   if (request.method !== 'GET') return;
//   event.respondWith(
//     caches.match(request).then((cached) => cached || fetch(request))
//   );
// });
