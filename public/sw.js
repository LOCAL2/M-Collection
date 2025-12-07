// Service Worker for Image Caching
const CACHE_NAME = 'gallery-images-v1';
const IMAGE_CACHE_NAME = 'gallery-images-cache-v1';

// Cache static assets
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/real-fake.png',
  '/vite.svg',
];

// Install event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== IMAGE_CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - cache images
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Cache images from Supabase storage
  if (
    request.destination === 'image' ||
    url.pathname.includes('/storage/') ||
    url.pathname.includes('/render/image/')
  ) {
    event.respondWith(
      caches.open(IMAGE_CACHE_NAME).then(async (cache) => {
        // Try cache first
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
          // Return cached and update in background
          fetch(request).then((response) => {
            if (response.ok) {
              cache.put(request, response.clone());
            }
          }).catch(() => {});
          return cachedResponse;
        }

        // Fetch and cache
        try {
          const response = await fetch(request);
          if (response.ok) {
            cache.put(request, response.clone());
          }
          return response;
        } catch (error) {
          // Return placeholder if offline
          return new Response('', { status: 503 });
        }
      })
    );
    return;
  }

  // Network first for other requests
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

// Listen for messages to clear cache
self.addEventListener('message', (event) => {
  if (event.data === 'CLEAR_IMAGE_CACHE') {
    caches.delete(IMAGE_CACHE_NAME);
  }
});
