import React, { useState } from 'react';
import { Bell, BellOff, Loader2, CheckCircle2 } from 'lucide-react';
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
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Only activate FCM when the user clicks Enable
  const [active, setActive] = useState(false);
  useFCMPush(active ? { firebaseConfig, vapidKey, storeId, driverId } : {});

  if (!firebaseConfig || !vapidKey) return null;
  if (!('Notification' in window)) return null;

  if (Notification.permission === 'granted' || enabled) {
    return (
      <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Push notifications enabled
      </div>
    );
  }

  if (Notification.permission === 'denied') {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted rounded-xl px-3 py-2">
        <BellOff className="w-3.5 h-3.5" />
        Notifications blocked — enable in browser settings
      </div>
    );
  }

  const handleEnable = async () => {
    setLoading(true);
    setError('');
    setActive(true);
    // Give the hook a moment to run
    await new Promise(r => setTimeout(r, 1500));
    if (Notification.permission === 'granted') {
      setEnabled(true);
    } else if (Notification.permission === 'denied') {
      setError('Permission denied. Enable notifications in your browser settings.');
    }
    setLoading(false);
  };

  return (
    <div className="space-y-1">
      <button
        onClick={handleEnable}
        disabled={loading}
        className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-xl border border-primary/30 text-primary hover:bg-primary/5 transition-colors disabled:opacity-60"
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />}
        {loading ? 'Enabling…' : 'Enable Push Notifications'}
      </button>
      {error && <p className="text-xs text-red-500 px-1">{error}</p>}
    </div>
  );
}