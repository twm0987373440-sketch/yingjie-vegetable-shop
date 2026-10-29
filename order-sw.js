// Deliberately no fetch/cache handler: never cache orders, credentials or checkout.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
 event.waitUntil(self.registration.showNotification('英姐訂單｜收到新訂單',{
  body:'請點此開啟訂單管理，確認最新訂單。',
  icon:new URL('order-icon-192.png',self.registration.scope).href,
  badge:new URL('order-icon-192.png',self.registration.scope).href,
  tag:'yingjie-new-orders',renotify:true,
  data:{url:new URL('admin.html?view=orders',self.registration.scope).href}
 }));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const target=new URL('admin.html?view=orders',self.registration.scope).href;
 event.waitUntil((async()=>{
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const existing=windows.find(c=>c.url.startsWith(new URL('admin.html',self.registration.scope).href));
  if(existing){await existing.navigate(target);return existing.focus();}
  return self.clients.openWindow(target);
 })());
});
