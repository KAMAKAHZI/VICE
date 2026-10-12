// Legacy cache eviction only. v1.0.4 does not register a service worker.
const OLD_PREFIX='vice-os-';
self.addEventListener('install', e=>{e.waitUntil(self.skipWaiting());});
self.addEventListener('activate',e=>e.waitUntil((async()=>{
 const keys=await caches.keys();
 await Promise.all(keys.filter(k=>k.startsWith(OLD_PREFIX)).map(k=>caches.delete(k)));
 await self.registration.unregister();
})()));
self.addEventListener('fetch',()=>{});
