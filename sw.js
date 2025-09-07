const CACHE_NAME = 'cactolog-v2';
const ASSETS = [
  
  'index.html',
  'css/styles.css',
  'js/app.js',
  'js/store.js',
  'js/db.js',
  'js/utils.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'assets/placeholder.jpg'
];
self.addEventListener('install', (event)=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=> cache.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', (event)=>{
  event.waitUntil(caches.keys().then(keys=> Promise.all(keys.map(k=> k===CACHE_NAME?null:caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', (event)=>{
  const req = event.request;
  if (req.method !== 'GET') return;
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res=>{
      if (res.ok && new URL(req.url).origin === location.origin){
        const copy = res.clone();
        caches.open(CACHE_NAME).then(c=> c.put(req, copy));
      }
      return res;
    }).catch(()=>{
      if (req.destination === 'image') return caches.match('assets/placeholder.jpg');
      if (req.mode === 'navigate') return caches.match('index.html');
      return Response.error();
    }))
  );
});
