/* ============================================================
 *  BIZIM SOHBET - Service Worker
 *  PWA / APK offline desteği
 * ============================================================ */

const CACHE_NAME = 'bizim-sohbet-v3.0.0';
const CACHE_URLS = [
  '/',
  '/index.html',
  '/admin.html',
  '/style.css',
  '/app.js',
  '/admin.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png'
];

// ----- KURULUM -----
self.addEventListener('install', (event) => {
  console.log('[SW] Kuruluyor...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CACHE_URLS).catch((err) => {
        console.warn('[SW] Bazı dosyalar önbelleğe alınamadı:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// ----- AKTİVASYON -----
self.addEventListener('activate', (event) => {
  console.log('[SW] Aktifleşiyor...');
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// ----- FETCH -----
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Socket.IO ve API isteklerini önbelleğe alma
  if (url.pathname.startsWith('/socket.io') || url.pathname.startsWith('/api')) {
    return;
  }

  // GET dışındaki istekleri önbelleğe alma
  if (request.method !== 'GET') return;

  // Network-first (yeni içerik her zaman önce gelir)
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(request).then((cached) => {
          if (cached) return cached;
          if (request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          return new Response('Offline', { status: 503 });
        });
      })
  );
});

// ----- MESAJ -----
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ----- PUSH BİLDİRİM -----
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Yeni mesaj';
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-96.png',
    vibrate: [200, 100, 200],
    tag: 'chat-message',
    renotify: true
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});