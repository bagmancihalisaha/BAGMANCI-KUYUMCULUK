const OFFLINE_CACHE = 'bagmanci-offline-v1';
const OFFLINE_URL = new URL('offline.html', self.registration.scope).href;
self.addEventListener('install', event => {
  event.waitUntil(caches.open(OFFLINE_CACHE).then(cache => cache.add(OFFLINE_URL)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith('bagmanci-offline-') && key !== OFFLINE_CACHE)
    .map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (error) { data = { body: event.data?.text() || '' }; }
  const title = data.title || 'Bağmancı Kuyumculuk';
  const options = {
    body: data.body || 'Yeni bir duyuru yayınlandı.',
    icon: data.icon || './bk-logo.png',
    badge: data.badge || './bk-logo.png',
    tag: data.tag || 'bagmanci-announcement',
    data: { url: data.url || './index.html#duyurular' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || './index.html#duyurular', self.registration.scope).href;
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const existing = list.find(client => 'focus' in client);
    return existing ? existing.navigate(target).then(client => client.focus()) : clients.openWindow(target);
  }));
});
// Prices, accounts, orders and API responses always come from the network.
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const base = new URL(self.registration.scope);
  const page = url.pathname.slice(base.pathname.length);
  if (event.request.method !== 'GET' || event.request.mode !== 'navigate' || url.origin !== base.origin || !['', 'index.html', 'product.html'].includes(page)) return;
  event.respondWith(fetch(event.request).catch(async () => {
    const cached = await caches.match(OFFLINE_URL);
    return cached || new Response('İnternet bağlantınızı kontrol edin.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }));
});
