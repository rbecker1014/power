// Basic PWA cache: app shell + static CDNs (opaque cached), network-first for Sheet data
const CACHE = 'solar-mobile-v1';
const APP_SHELL = [
  './index.html',
  './manifest.webmanifest',
  './service-worker.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
  'https://accounts.google.com/gsi/client'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(APP_SHELL);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Network-first for Google Sheets responses
  const isSheets = url.hostname.endsWith('googleapis.com') || url.hostname.endsWith('google.com');

  if (isSheets) {
    event.respondWith((async () => {
      try {
        const network = await fetch(request);
        const cache = await caches.open(CACHE);
        cache.put(request, network.clone());
        return network;
      } catch (err) {
        const cache = await caches.open(CACHE);
        const cached = await cache.match(request);
        return cached || new Response('Offline', { status: 503, statusText: 'Offline' });
      }
    })());
    return;
  }

  // Cache-first for app shell
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      const network = await fetch(request);
      // Don’t fail if opaque; best effort
      try { cache.put(request, network.clone()); } catch (_) {}
      return network;
    } catch (err) {
      return cached || Response.error();
    }
  })());
});
