// Service worker de "Planos". Solo cachea el "cascarón" de la app
// (HTML, manifest, iconos) para que se pueda instalar y abrir offline.
// Las llamadas a /api/* NUNCA se cachean: los datos siempre deben ir
// a la red (o fallar y dejar que la propia app use su copia local).
const CACHE_VERSION = 'planos-v1';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon.png',
  '/favicon-32.png',
  '/favicon-16.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Nunca intervenir en peticiones a otros orígenes ni a la API.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;
  if (req.method !== 'GET') return;

  // HTML (navegación): red primero, con la copia cacheada como respaldo
  // offline. Así el usuario siempre recibe la última versión cuando hay
  // conexión, y algo funcional cuando no la hay.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put('/index.html', copy));
          return res;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Resto de archivos del cascarón (iconos, manifest): caché primero.
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});
