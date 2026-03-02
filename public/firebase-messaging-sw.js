/* eslint-disable no-undef */
// Firebase Cloud Messaging Service Worker

importScripts('https://www.gstatic.com/firebasejs/12.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.7.0/firebase-messaging-compat.js');

const search = new URL(self.location.href).searchParams;

firebase.initializeApp({
  apiKey: search.get('apiKey') || '',
  authDomain: search.get('authDomain') || '',
  projectId: search.get('projectId') || 'coach-52bf4',
  storageBucket: search.get('storageBucket') || '',
  messagingSenderId: search.get('messagingSenderId') || '',
  appId: search.get('appId') || '',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title || 'SuperCoach AI';
  const body = payload.notification?.body || payload.data?.body || '';
  const link = payload.data?.link || '/';
  const slot = payload.data?.slot || '';
  const options = {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: payload.data?.tag || 'default',
    data: {
      link,
      slot,
    },
  };
  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const link = event.notification?.data?.link || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus().then(() => {
            if ('navigate' in client) {
              return client.navigate(link);
            }
            return undefined;
          });
        }
      }
      return self.clients.openWindow(link);
    }),
  );
});
