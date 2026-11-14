/**
 * Firebase Cloud Messaging Service Worker
 * Handles background push notifications when the app is not in the foreground.
 *
 * Firebase's public web-app config is supplied in this service worker's query
 * string by useFCMPush, so it remains available when the worker is restarted.
 */

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

const encodedConfig = new URL(self.location.href).searchParams.get('firebaseConfig');
const firebaseConfig = encodedConfig ? JSON.parse(encodedConfig) : null;

if (firebaseConfig?.apiKey) {
  firebase.initializeApp(firebaseConfig);

  const messaging = firebase.messaging();

  // Background push handler — fires when a push arrives and the app tab is not focused
  messaging.onBackgroundMessage((payload) => {
    const { title, body } = payload.notification || {};
    self.registration.showNotification(title || 'Alcohol Delivered', {
      body: body || '',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: payload.data?.order_id || 'alcohol-delivered',
      data: payload.data || {},
    });
  });
}

// Handle notification click — focus or open the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
