// Network first, so updates show up as soon as you're online; cached copy is the offline fallback.
const V = 'work-v15';
const SHELL = ['./', 'index.html', 'style.css?v=15', 'manifest.webmanifest', 'js/stocklist.js?v=15', 'js/core.js?v=15', 'js/views.js?v=15', 'js/tasks.js?v=15', 'js/today.js?v=15', 'js/stock.js?v=15', 'js/money.js?v=15', 'js/app.js?v=15'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  if (u.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }).then(r => {
      const copy = r.clone();
      caches.open(V).then(c => c.put(e.request, copy));
      return r;
    }).catch(() => caches.match(e.request).then(m => m || caches.match('index.html')))
  );
});
