'use strict';
// Notification routing only: no fetch handler and no offline/account cache.
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 const keys=await caches.keys();
 await Promise.all(keys.filter(k=>k.startsWith('vice-os-')).map(k=>caches.delete(k)));
 await self.clients.claim();
})()));
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const route=event.notification.data?.route;
 if(!route||typeof route.receiverId!=='string')return;
 event.waitUntil((async()=>{
  const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const target=clients.find(c=>new URL(c.url).origin===self.location.origin&&new URL(c.url).pathname==='/');
  if(target){await target.focus();target.postMessage({type:'VICE4X_NOTIFICATION_OPEN',route});}
  else await self.clients.openWindow('/?alert='+encodeURIComponent(JSON.stringify(route)));
 })());
});
