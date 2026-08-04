const CACHE_NAME = 'cobertura-v25';
const STATIC_ASSETS = [
  './','./index.html','./css/style.css',
  './lib/xlsx.full.min.js',
  './js/utils.js','./js/db.js','./js/config.js','./js/sheets.js','./js/data-sheets.js','./js/data-excel.js','./js/panel-data.js','./js/app.js',
  './manifest.json','./vercel.json'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(STATIC_ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(names => Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const { request } = e;
  const url = new URL(request.url);

  // Navegación: network-first para siempre traer la versión nueva
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put('./index.html', clone));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  if (url.origin === self.location.origin) {
    // JS y CSS: network-first para actualizaciones rápidas
    if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
      e.respondWith(
        fetch(request)
          .then(res => {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(request, clone));
            return res;
          })
          .catch(() => caches.match(request))
      );
      return;
    }
    // Resto: cache-first
    e.respondWith(caches.match(request).then(cached => cached || fetch(request).then(res => {
      return caches.open(CACHE_NAME).then(c => { c.put(request, res.clone()); return res; });
    })));
    return;
  }
  if (url.hostname.includes('google.com') || url.hostname.includes('script.google.com') || url.hostname.includes('docs.google.com')) {
    e.respondWith(fetch(request));
    return;
  }
  e.respondWith(fetch(request).catch(() => caches.match(request)));
});
