// Kylrix Zero-Network Service Worker (The "Reload Annihilator")
// Version: 1.0.0

const CACHE_NAME = 'kylrix-shell-v1';
const SHELL_URL = '/shell.html';

// 1. Install Phase: Cache the static App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching application shell');
      return cache.addAll([SHELL_URL]);
    })
  );
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

// 3. Volatile MEK Preservation (The "Session Worker")
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

// 4. Navigation Interception (Instant Shell Delivery)
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Intercept navigation requests (standard page loads/refreshes)
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match(SHELL_URL).then((cachedShell) => {
        if (cachedShell) {
          console.log('[SW] Serving cached shell for navigation:', request.url);
          // Return the static shell instantly (0ms TTFB)
          return cachedShell;
        }
        // Fallback to network if shell is missing
        return fetch(request);
      })
    );
    return;
  }

  // Optional: Cache-first for static assets (fonts, icons)
  if (request.destination === 'font' || request.destination === 'image') {
      event.respondWith(
          caches.match(request).then((response) => {
              return response || fetch(request).then((networkResponse) => {
                  return caches.open(CACHE_NAME).then((cache) => {
                      cache.put(request, networkResponse.clone());
                      return networkResponse;
                  });
              });
          })
      );
  }
});
