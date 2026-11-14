import { useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * useFCMPush — registers this device for Firebase Cloud Messaging push notifications.
 *
 * Usage:
 *   useFCMPush({ firebaseConfig, vapidKey, storeId, driverId })
 *
 * firebaseConfig — your Firebase web app config object
 * vapidKey       — your VAPID/Web Push certificate key from Firebase Console
 * storeId        — (optional) link this token to a specific store
 * driverId       — (optional) link this token to a specific driver
 */
export function useFCMPush({ firebaseConfig, vapidKey, storeId, driverId } = {}) {
  const registered = useRef(false);

  useEffect(() => {
    if (!firebaseConfig || !vapidKey) return;
    if (registered.current) return;
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;

    let messaging = null;

    async function register() {
      try {
        // Dynamically import Firebase (already installed via CDN in SW, use modular SDK here)
        const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
        const { getMessaging, getToken, onMessage } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js');

        const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
        messaging = getMessaging(app);

        // Skip service worker registration in dev to avoid stale cache breaking React
        if (import.meta.env.DEV) {
          console.log('FCM: skipping SW registration in dev mode');
          return;
        }

        // Register service worker and pass it the config
        const config = encodeURIComponent(JSON.stringify(firebaseConfig));
        const swReg = await navigator.serviceWorker.register(
          `/firebase-messaging-sw.js?firebaseConfig=${config}`,
        );
        await navigator.serviceWorker.ready;

        // Request notification permission
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          console.log('FCM: notification permission denied');
          return;
        }

        // Get FCM token
        const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: swReg });
        if (!token) {
          console.log('FCM: no token received');
          return;
        }

        // Register token with backend
        await base44.functions.invoke('registerFCMToken', {
          token,
          store_id: storeId || '',
          driver_id: driverId || '',
          device_info: navigator.userAgent.slice(0, 100),
        });

        registered.current = true;
        console.log('FCM: token registered successfully');

        // Handle foreground messages as browser notifications
        onMessage(messaging, (payload) => {
          const { title, body } = payload.notification || {};
          if (title && Notification.permission === 'granted') {
            new Notification(title, {
              body: body || '',
              icon: '/favicon.ico',
              tag: payload.data?.order_id || 'alcohol-delivered',
            });
          }
        });
      } catch (err) {
        console.error('FCM registration error:', err);
      }
    }

    register();
  }, [firebaseConfig, vapidKey, storeId, driverId]);
}