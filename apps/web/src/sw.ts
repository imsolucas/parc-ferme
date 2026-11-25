/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

type Manifest = (string | { url: string; revision: string | null })[];
const sw = self as unknown as ServiceWorkerGlobalScope;

void sw.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
// The build looks for the literal `self.__WB_MANIFEST` to inject the precache list.
precacheAndRoute((self as unknown as { __WB_MANIFEST: Manifest }).__WB_MANIFEST);

// App shell for client-side routes. API, share pages and card images always go to the network.
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/api\//, /^\/card\//, /^\/share\//] }));

interface PushMessage {
  title?: string;
  body?: string;
  url?: string;
}

sw.addEventListener('push', (event) => {
  let msg: PushMessage = {};
  try {
    msg = (event.data?.json() ?? {}) as PushMessage;
  } catch {
    msg = { body: event.data?.text() };
  }
  event.waitUntil(
    sw.registration.showNotification(msg.title ?? 'PARC FERMÉ', {
      body: msg.body ?? '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: msg.url ?? '/' },
    }),
  );
});

sw.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string } | null)?.url ?? '/';
  event.waitUntil(
    sw.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const open = wins.find((w) => 'focus' in w);
      return open ? open.focus().then((w) => w.navigate(url)) : sw.clients.openWindow(url);
    }),
  );
});
