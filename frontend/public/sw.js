/**
 * ZIONX service worker.
 *
 * Deliberately does NOT precache the app.
 *
 * Every build hashes its chunks, and we deploy several times a day. A service
 * worker that serves a cached shell would hand an old index.html to a browser
 * whose chunks no longer exist — the exact white screen we just fixed (ZIONX-2),
 * except a cached one that survives a reload. This product is live data anyway:
 * a calendar or a metrics page cached offline would be worse than an honest
 * "no connection".
 *
 * So the worker exists for two jobs it can do well: receive push notifications
 * and open the right page when one is tapped.
 */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'ZIONX', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'ZIONX';
  const options = {
    body: payload.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    // Same tag replaces an earlier notice about the same thing instead of
    // stacking three copies of "no se pudo publicar".
    tag: payload.tag || undefined,
    renotify: Boolean(payload.tag),
    data: { url: payload.url || '/notifications' },
    timestamp: Date.now(),
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/notifications';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Reuse an open ZIONX window when there is one — tapping a notification
      // should not pile up tabs.
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(target).catch(() => {});
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
