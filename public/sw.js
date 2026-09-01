// 🛡️ Service Worker SigilOS — PWA & Offline Caching (#197)
const CACHE_NAME = 'sigilos-cache-v1';
const STATIC_ASSETS = [
    '/',
    '/manifest.webmanifest',
    '/assets/ui/logo-v2.png',
    '/favicon.ico',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS).catch(() => {
                // Best-effort cache on install
            });
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Bypass non-GET requests (Server actions, Webhooks, API posts)
    if (event.request.method !== 'GET') {
        return;
    }

    // Bypass Next.js internal development files
    if (url.pathname.startsWith('/_next/webpack-hmr') || url.pathname.startsWith('/api/chat/')) {
        return;
    }

    // Cache First for static images, logos, avatars, fonts
    if (
        url.pathname.startsWith('/assets/') ||
        url.pathname.startsWith('/game-data/') ||
        url.pathname.endsWith('.webp') ||
        url.pathname.endsWith('.png') ||
        url.pathname.endsWith('.jpg') ||
        url.pathname.endsWith('.woff2')
    ) {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                return fetch(event.request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return networkResponse;
                }).catch(() => cachedResponse);
            })
        );
        return;
    }

    // Network First with Cache Fallback for HTML and Guides
    event.respondWith(
        fetch(event.request).then((response) => {
            if (response && response.status === 200 && event.request.mode === 'navigate') {
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseClone);
                });
            }
            return response;
        }).catch(async () => {
            const cached = await caches.match(event.request);
            if (cached) return cached;
            return caches.match('/');
        })
    );
});
