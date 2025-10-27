const CACHE_NAME = 'cactolog-v3';
const ASSETS = [
  'index.html',
  'styles.css',
  'src/app.js',
  'src/core/EventBus.js',
  'src/core/Router.js',
  'src/core/Store.js',
  'src/core/Component.js',
  'src/utils/helpers.js',
  'src/utils/validators.js',
  'src/services/PlantService.js',
  'src/services/ActivityService.js',
  'src/services/ExportService.js',
  'src/services/ImageService.js',
  'src/services/QRService.js',
  'src/repositories/Repository.js',
  'src/repositories/Database.js',
  'src/components/shared/Toast.js',
  'src/components/shared/Loading.js',
  'src/components/shared/ImageUpload.js',
  'src/components/shared/Modal.js',
  'src/components/shared/PhotoGallery.js',
  'src/components/pages/Dashboard.js',
  'src/components/pages/PlantList.js',
  'src/components/pages/PlantForm.js',
  'src/components/pages/Calendar.js',
  'src/components/pages/Settings.js',
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
