// Kylrix Zero-Network Service Worker (The "Session Worker")
// Version: 1.0.2

// 1. Install Phase: Skip waiting to activate immediately
self.addEventListener('install', (_event) => {
  self.skipWaiting();
});

// 2. Activate Phase: Nuke ALL old caches to clear broken skeletons
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          console.log('[SW] Nuclear cleanup of cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    })
  );
  self.clients.claim();
});

// 3. Volatile MEK Preservation
let volatileContext = null;

self.addEventListener('message', (event) => {
  if (event.data.type === 'STORE_CONTEXT') {
    volatileContext = event.data.payload;
  }
  
  if (event.data.type === 'RECOVER_CONTEXT') {
    event.ports[0].postMessage({ type: 'CONTEXT_RECOVERED', payload: volatileContext });
  }

  if (event.data.type === 'WIPE_CONTEXT') {
    volatileContext = null;
  }
});

// 4. Fetch: No interception. Let the app render its own page structure.
self.addEventListener('fetch', (_event) => {
  // Pass-through
});


