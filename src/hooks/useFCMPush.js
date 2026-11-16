import { useEffect, useRef, useState } from 'react';
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
  const registered = useRef('');
  const [status,setStatus] = useState('idle'), [error,setError] = useState('');

  useEffect(() => {
    if (!firebaseConfig || !vapidKey) return;
    const registrationKey = `${storeId || ''}:${driverId || ''}`;
    if (registered.current === registrationKey) return;
    if (!('Notification' in window) || !('serviceWorker' in navigator)) { setError('This device does not support web push. Use a supported browser or installed app.'); setStatus('error'); return; }
    if (import.meta.env.DEV) { setError('Push registration is unavailable in preview. Complete registration on a published device.'); return; }

    let messaging = null;

    async function register() {
      try {
        setStatus('registering'); setError('');
        if (!firebaseConfig.apiKey || /^\*+$/.test(firebaseConfig.apiKey)) throw new Error('Administrator setup is required: Firebase web configuration is incomplete.');
        // Dynamically import Firebase (already installed via CDN in SW, use modular SDK here)
        const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
        const { getMessaging, getToken, onMessage } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js');

        const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
        messaging = getMessaging(app);

        // Register service worker and pass it the config
        const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        await navigator.serviceWorker.ready;

        // Send firebase config to SW
        swReg.active?.postMessage({ type: 'FIREBASE_CONFIG', config: firebaseConfig });

        // Request notification permission
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          throw new Error('Notification permission was not granted. Enable it in your browser settings.');
        }

        // Get FCM token
        const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: swReg });
        if (!token) {
          throw new Error('The notification provider did not issue a device token. Check the Firebase configuration.');
        }

        // Register token with backend
        const response = await base44.functions.invoke('registerFCMToken', {
          token,
          store_id: storeId || '',
          driver_id: driverId || '',
          device_info: navigator.userAgent.slice(0, 100),
        });

        if (response.data?.success !== true) throw new Error(response.data?.error || 'Device registration was not confirmed.');
        registered.current = registrationKey;
        setStatus('registered');
        console.log('FCM: token registered successfully');

        // Handle foreground messages as browser notifications
        onMessage(messaging, (payload) => {
          const { title, body } = payload.notification || {};
          if (title && Notification.permission === 'granted') {
            swReg.showNotification(title, {
              body: body || '',
              icon: '/favicon.ico',
              tag: payload.data?.event_key || payload.data?.order_id || 'alcohol-delivered',
              data: payload.data || {},
            });
          }
        });
      } catch (err) {
        console.error('FCM registration error:', err);
        setError(err?.response?.data?.error || err.message); setStatus('error');
      }
    }

    register();
  }, [firebaseConfig, vapidKey, storeId, driverId]);
  return { status,error };
}