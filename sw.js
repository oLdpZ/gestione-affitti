// sw.js — PR2b → v2 (added idb-keyval). Versioned cache, Stale-While-Revalidate per
// app shell + CDN pinnati. NON cacha le chiamate Supabase API (devono
// sempre andare in rete: dati live + auth).
//
// Strategia:
//   - install:  pre-cache esplicito dell'app shell + CDN pinnati; skipWaiting()
//   - activate: elimina ogni cache con nome != CACHE_NAME; clients.claim()
//   - fetch:    navigation        -> SWR con fallback offline su index.html
//               app shell + CDN   -> SWR
//               Supabase / fonts  -> network passthrough
//
// Bump CACHE_NAME a ogni deploy che cambia file in PRECACHE_URLS.
// Naming: 'gestione-affitti-v<N>' (N intero monotono crescente).

const CACHE_NAME = 'gestione-affitti-v2';

const PRECACHE_URLS = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-1024.png',
  './icons/apple-touch-icon-180.png',
  // CDN pinnati (esattamente come in index.html righe 17/19/21)
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js',
  'https://cdn.jsdelivr.net/npm/idb-keyval@6.2.2/dist/umd.js',
];

// URL pattern che NON devono mai essere cachati (devono sempre andare in rete).
// Supabase REST/auth + Google Fonts CSS dinamico (le woff2 si' sono cachabili
// ma il foglio CSS puo' cambiare; per semplicita' in PR2a lasciamo passthrough).
const NETWORK_ONLY_HOSTS = [
  'supabase.co',
  'supabase.in',
  'fonts.googleapis.com', // foglio dinamico
];

self.addEventListener('install', (event) => {
  // Resilient precache: usa Promise.allSettled invece di cache.addAll().
  // Rationale: addAll() rifiuta l'INTERA install se anche UN solo URL fallisce
  // (es. CDN irraggiungibile dal runner CI, CORS opaque, throttle). Una install
  // fallita -> SW non attiva mai -> clients.claim() non firea -> controller
  // resta null sulla pagina -> REGRESSION-03 timeout. allSettled isola i
  // fallimenti dei singoli URL; gli URL critici (app shell same-origin) di
  // solito riescono, i CDN si auto-cachano poi via SWR al primo fetch.
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) =>
        Promise.allSettled(
          PRECACHE_URLS.map((url) =>
            fetch(url, { credentials: 'omit', mode: url.startsWith('http') ? 'cors' : 'same-origin' })
              .then((res) => {
                if (res && res.status === 200) return cache.put(url, res);
              })
              .catch(() => {})
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

// Stale-While-Revalidate: serve subito dalla cache (se c'e'), in parallelo
// fetch dal network e aggiorna la cache per la prossima nav.
function staleWhileRevalidate(request) {
  return caches.open(CACHE_NAME).then((cache) =>
    cache.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          // Solo 200 OK puo' essere cachato safely. Skip non-200 (304, 5xx)
          // per non avvelenare la cache con risposte parziali o errori.
          if (response && response.status === 200) {
            cache.put(request, response.clone()).catch(() => {});
          }
          return response;
        })
        .catch(() => cached); // offline: torna il cached anche se e' null
      // Range requests (video) non sono safe per SWR: passthrough.
      if (request.headers.get('range')) return fetch(request);
      return cached || networkFetch;
    })
  );
}

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Solo GET viene cachato. POST/PATCH/DELETE -> passthrough.
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Network-only: Supabase API/auth, font dinamico.
  if (NETWORK_ONLY_HOSTS.some((h) => url.hostname.endsWith(h))) {
    return; // niente event.respondWith -> default browser fetch
  }

  // Navigation request (HTML page load): SWR con fallback a index.html
  // se la rete e' down e la cache non ha il path richiesto.
  if (req.mode === 'navigate') {
    event.respondWith(
      staleWhileRevalidate(req).catch(() =>
        caches.match('./index.html').then((r) => r || fetch(req))
      )
    );
    return;
  }

  // App shell same-origin + CDN pinnati: SWR.
  const isAppShell = url.origin === self.location.origin;
  const isPinnedCdn = PRECACHE_URLS.some((u) => u === req.url || req.url.startsWith(u));
  if (isAppShell || isPinnedCdn) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  // Default: passthrough (fonts.gstatic woff2 etc.).
  // Niente event.respondWith -> browser fa la fetch standard.
});
