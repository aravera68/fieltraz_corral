/* ═══════════════════════════════════════════════════════════
   TIGGA CORRAL — Service Worker
   Estrategia:
   - index.html y raíz → NETWORK-FIRST (siempre trae lo último
     si hay internet; usa caché solo sin señal)
   - resto de archivos → CACHE-FIRST (rápido y offline)
   Así las actualizaciones de código llegan solas, sin tener
   que subir el número de versión en cada cambio.
   ═══════════════════════════════════════════════════════════ */
const CACHE = 'tigga-corral-v7';

// Dominio del backend: las llamadas a la API (licencia, sync, etc.)
// nunca deben cachearse — siempre tienen que ir a la red.
const API_HOST = 'api.fieldtraz.app';

const ARCHIVOS = [
  './',
  './index.html',
  './xlsx.full.min.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Instalar: precachear todo
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ARCHIVOS))
      .then(() => self.skipWaiting())
  );
});

// Activar: borrar cachés viejos
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ¿Es una petición del documento principal (HTML)?
function esHTML(req) {
  if (req.mode === 'navigate') return true;
  const url = new URL(req.url);
  return url.pathname.endsWith('/') ||
         url.pathname.endsWith('/index.html');
}

self.addEventListener('fetch', e => {
  const req = e.request;

  // Solo manejamos GET; el resto va directo a la red
  if (req.method !== 'GET') return;

  // Llamadas a la API del backend: nunca cachear, siempre red.
  if (new URL(req.url).hostname === API_HOST) return;

  if (esHTML(req)) {
    // NETWORK-FIRST para el HTML: siempre lo más nuevo si hay señal
    e.respondWith(
      fetch(req)
        .then(resp => {
          // Guardar copia fresca en caché para uso offline
          const copia = resp.clone();
          caches.open(CACHE).then(c => c.put(req, copia)).catch(()=>{});
          return resp;
        })
        .catch(() => caches.match(req).then(c => c || caches.match('./index.html')))
    );
  } else {
    // CACHE-FIRST para librerías, íconos, etc.
    e.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req).then(resp => {
          // Cachear nuevos recursos estáticos que aparezcan
          const copia = resp.clone();
          caches.open(CACHE).then(c => c.put(req, copia)).catch(()=>{});
          return resp;
        });
      })
    );
  }
});

// Permite que la app pida activar la versión nueva sin esperar
self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
