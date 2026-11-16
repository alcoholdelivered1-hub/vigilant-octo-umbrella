import React, { useState } from 'react';
import { Bell, Loader2 } from 'lucide-react';
import { useFCMPush } from '@/hooks/useFCMPush';

/**
 * Drop this component into any page where you want to enable push notifications.
 * Pass your Firebase web app config and VAPID key as props.
 *
 * Props:
 *   firebaseConfig — Firebase web app config object (from Firebase Console)
 *   vapidKey       — Web Push certificate key (Firebase Console → Project Settings → Cloud Messaging)
 *   storeId        — (optional) associate token with a store
 *   driverId       — (optional) associate token with a driver
 */
export default function FCMSetup({ firebaseConfig, vapidKey, storeId, driverId }) {
  const [active,setActive] = useState(false), [permissionError,setPermissionError] = useState('');
  const { status,error } = useFCMPush(active ? { firebaseConfig,vapidKey,storeId,driverId } : {});
  const enable = async () => {
    setPermissionError('');
    if (!('Notification' in window)) {setPermissionError('Use a supported browser; on iPhone/iPad, open the app from its home-screen icon.'); return;}
    try {const permission = await Notification.requestPermission(); if (permission !== 'granted') throw new Error('Allow notifications for this app in your browser settings.'); setActive(true);} catch(e) {setPermissionError(e.message);}
  };
  if (!firebaseConfig || !vapidKey) return <p className="text-sm text-destructive">Notification configuration is missing. Ask an administrator to complete Firebase setup.</p>;
  return <div className="space-y-2"><button type="button" disabled={status === 'registering' || status === 'registered'} onClick={enable} className="inline-flex min-h-11 items-center gap-2 rounded-md border px-4 py-2 text-sm">{status === 'registering' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}{status === 'registered' ? 'Device registration confirmed' : status === 'registering' ? 'Registering device…' : 'Register this notification device'}</button>{status === 'registered' && <p role="status" className="text-sm">Device token saved. An actual notification test still requires review.</p>}{(permissionError || error) && <p role="alert" className="text-sm text-destructive">{permissionError || error} Reload after correcting the issue to retry.</p>}</div>;
}