// Firebase Cloud Messaging Service Worker
// This file must be served from the root of the app (public/)

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Firebase's web configuration is public client configuration. Initialize at
// worker startup so background pushes still work after the page has been closed.
const firebaseConfig = {
  apiKey: 'AIzaSyDTHqD-9pdv9ovWexIbImWhG3SJD8sdGLg',
  authDomain: 'project-963d2d6b-eda5-4d8e-b5e.firebaseapp.com',
  projectId: 'project-963d2d6b-eda5-4d8e-b5e',
  storageBucket: 'project-963d2d6b-eda5-4d8e-b5e.firebasestorage.app',
  messagingSenderId: '612812212750',
  appId: '1:612812212750:web:f2cd4dcbc8b772d73e4a5f',
  measurementId: 'G-QC5N06EFK7',
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || payload.data || {};
  if (!title) return;
  self.registration.showNotification(title, {
    body: body || '',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: payload.data?.order_id || 'alcohol-delivered',
    data: payload.data || {},
    requireInteraction: true,
  });
});

// Handle notification click — focus or open the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
