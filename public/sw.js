// 🛡️ Service Worker SigilOS — PWA & Offline Caching (#197)
const CACHE_NAME = 'sigilos-cache-v3';
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

    // Cross-origin (CDN d'images, avatars Discord, dofusdu/dofusdb…) : ne PAS
    // intercepter. Le navigateur gère ces requêtes via sa propre CSP (`img-src`),
    // et un `fetch()` cross-origin depuis le SW serait bloqué par `connect-src`
    // (header CSP posé sur sw.js) → image cassée / placeholder. On laisse donc le
    // SW sortir du jeu : le navigateur fait sa requête réseau normale.
    if (url.origin !== self.location.origin) {
        return;
    }

    // Network First with Cache Fallback for static images, logos, avatars, fonts.
    // ⚠️ FIX (nav SPA = icônes cassées) : l'ancien `cache-first` faisait
    // `fetch(...).catch(() => cachedResponse)` qui pouvait renvoyer `undefined`
    // (→ `respondWith(undefined)` = `net::ERR_FAILED` = image cassée) quand le
    // fetch réseau échouait sans entrée en cache. Ici : on revalide toujours le
    // réseau, on met en cache les succès, et on retombe sur le cache puis un
    // placeholder gracieux (jamais de réponse `undefined`).
    if (
        url.pathname.startsWith('/assets/') ||
        url.pathname.startsWith('/game-data/') ||
        url.pathname.endsWith('.webp') ||
        url.pathname.endsWith('.png') ||
        url.pathname.endsWith('.jpg') ||
        url.pathname.endsWith('.jpeg') ||
        url.pathname.endsWith('.gif') ||
        url.pathname.endsWith('.woff2')
    ) {
        event.respondWith(
            fetch(event.request).then((networkResponse) => {
                if (networkResponse && networkResponse.ok) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return networkResponse;
            }).catch(async () => {
                const cached = await caches.match(event.request);
                if (cached) return cached;
                // Fallback gracieux : logo plutôt qu'une image cassée.
                const placeholder = await caches.match('/assets/ui/logo-v2.png');
                return placeholder || new Response('', { status: 404 });
            })
        );
        return;
    }

    // HTML / RSC / API : Network First with Cache Fallback (navigations).
    // ⚠️ Ne JAMAIS renvoyer le document racine pour une sous-ressource (image,
    // `/_next/image`, chunk) qui échoue — sinon le navigateur reçoit du HTML en
    // guise d'image → image cassée. On ne sert `/` que si c'est une navigation.
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
            if (event.request.mode === 'navigate') {
                return caches.match('/');
            }
            return new Response('', { status: 404 });
        })
    );
});
