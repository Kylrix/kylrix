// Kylrix Zero-Network Service Worker (The "Session Worker")
// Version: 1.0.1

const CACHE_NAME = 'kylrix-session-v1';

// 1. Install Phase
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// 2. Activate Phase: Cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Cleaning old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. Volatile MEK Preservation
// We store the encrypted Master Encryption Key (MEK) and other volatile state in memory here.
// Since the SW outlives page reloads, this data survives a hard refresh (F5).
let volatileContext = null;

self.addEventListener('message', (event) => {
  if (event.data.type === 'STORE_CONTEXT') {
    console.log('[SW] Context stored in volatile memory space');
    volatileContext = event.data.payload;
  }
  
  if (event.data.type === 'RECOVER_CONTEXT') {
    console.log('[SW] Context recovery requested');
    event.ports[0].postMessage({ type: 'CONTEXT_RECOVERED', payload: volatileContext });
  }

  if (event.data.type === 'WIPE_CONTEXT') {
    console.log('[SW] Context wiped');
    volatileContext = null;
  }
});

// 4. Fetch Interception (Standard behavior, no shell hijacking)
self.addEventListener('fetch', (event) => {
  // Let everything go to network by default
});

