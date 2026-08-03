importScripts('https://www.gstatic.com/firebasejs/12.17.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.17.0/firebase-messaging-compat.js');

console.log('[sw-debug] service worker started', new Date().toISOString());

firebase.initializeApp({
  apiKey: 'AIzaSyBMOPubtxpzjp7D-eJRwgDL7taLysvAEJA',
  authDomain: 'moktari-39d66.firebaseapp.com',
  projectId: 'moktari-39d66',
  storageBucket: 'moktari-39d66.firebasestorage.app',
  messagingSenderId: '592333922936',
  appId: '1:592333922936:web:87dbac14815e9fa988038d',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[sw-debug] onBackgroundMessage invoked', payload);
  const { title_ar, body_ar, link, notification_id } = payload.data || {};

  const debugTitle = title_ar || payload.notification?.title || '';
  const debugBody = body_ar || payload.notification?.body || '';
  console.log('[sw-debug] before showNotification', { title: debugTitle, body: debugBody });

  self.registration.showNotification(debugTitle, {
    body: debugBody,
    icon: '/favicon.png',
    badge: '/favicon.png',
    data: { link, notification_id },
    tag: notification_id,
    renotify: false,
    requireInteraction: false,
  }).then(
    () => console.log('[sw-debug] showNotification resolved'),
    (err) => console.log('[sw-debug] showNotification rejected', err)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const link = event.notification.data?.link || '/notifications';

  const urlToOpen = new URL(link, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }

        for (const client of windowClients) {
          if ('focus' in client) {
            return client.focus();
          }
        }

        if ('openWindow' in clients) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});
