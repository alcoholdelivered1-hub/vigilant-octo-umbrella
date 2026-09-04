import { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

const ARRIVAL_RADIUS_MILES = 0.12; // ~190 meters
const NOTIFIED_KEY = 'ad_notified_arrivals';
const CUSTOMER_NOTIFIED_KEY = 'ad_notified_customer_arrivals';

function haversineMiles(a, b) {
  const R = 3958.8;
  const dLat = (b[0] - a[0]) * Math.PI / 180;
  const dLon = (b[1] - a[1]) * Math.PI / 180;
  const la1 = a[0] * Math.PI / 180;
  const la2 = b[0] * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function getNotifiedSet() {
  try {
    return new Set(JSON.parse(localStorage.getItem(NOTIFIED_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

function markNotified(id) {
  const set = getNotifiedSet();
  set.add(id);
  try {
    localStorage.setItem(NOTIFIED_KEY, JSON.stringify([...set]));
  } catch {}
}

function getCustomerNotifiedSet() {
  try {
    return new Set(JSON.parse(localStorage.getItem(CUSTOMER_NOTIFIED_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

function markCustomerNotified(id) {
  const set = getCustomerNotifiedSet();
  set.add(id);
  try {
    localStorage.setItem(CUSTOMER_NOTIFIED_KEY, JSON.stringify([...set]));
  } catch {}
}

/**
 * Watches the driver's GPS and automatically notifies the store when the driver
 * arrives at the store location for any confirmed/preparing order.
 */
export default function AutoArrivalNotifier({ orders = [] }) {
  const posRef = useRef(null);
  const storeMapRef = useRef({}); // store_id -> { lat, lng, name }
  const notifiableRef = useRef(orders);
  notifiableRef.current = orders;
  const [permissionDenied, setPermissionDenied] = useState(false);

  // Fetch store coordinates for any order we might need to check
  useEffect(() => {
    const eligible = orders.filter(o =>
      ['confirmed', 'preparing'].includes(o.status) && o.store_id
    );
    const storeIds = [...new Set(eligible.map(o => o.store_id))];
    if (storeIds.length === 0) return;

    const missing = storeIds.filter(id => !storeMapRef.current[id]);
    if (missing.length === 0) return;

    let cancelled = false;
    (async () => {
      try {
        const stores = await Promise.all(
          missing.map(id => base44.entities.Store.get(id).catch(() => null))
        );
        if (cancelled) return;
        stores.forEach(s => {
          if (s && s.latitude && s.longitude) {
            storeMapRef.current[s.id] = { lat: s.latitude, lng: s.longitude, name: s.name };
          }
        });
      } catch (err) {
        console.error('[AutoArrivalNotifier] store fetch error:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [orders]);

  // GPS watch
  useEffect(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => { posRef.current = [pos.coords.latitude, pos.coords.longitude]; },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setPermissionDenied(true);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // Proximity check loop — store pickup (confirmed/preparing) + customer delivery (in_transit)
  useEffect(() => {
    const notified = getNotifiedSet();
    const customerNotified = getCustomerNotifiedSet();
    const check = async () => {
      const pos = posRef.current;
      if (!pos) return;

      // Store arrival check
      const storeEligible = notifiableRef.current.filter(o =>
        ['confirmed', 'preparing'].includes(o.status) &&
        o.store_id &&
        storeMapRef.current[o.store_id] &&
        !notified.has(o.id)
      );
      for (const order of storeEligible) {
        const store = storeMapRef.current[order.store_id];
        const dist = haversineMiles(pos, [store.lat, store.lng]);
        if (dist <= ARRIVAL_RADIUS_MILES) {
          notified.add(order.id);
          markNotified(order.id);
          try {
            const res = await base44.functions.invoke('notifyStoreDriverArrived', { order_id: order.id });
            if (res.data?.success) {
              toast.success(`📍 Arrived at ${store.name} — they've been notified!`, { duration: 5000 });
            }
          } catch (err) {
            console.error('[AutoArrivalNotifier] store notify failed:', err);
          }
        }
      }

      // Customer delivery arrival check
      const deliveryEligible = notifiableRef.current.filter(o =>
        o.status === 'in_transit' &&
        o.delivery_latitude &&
        o.delivery_longitude &&
        !customerNotified.has(o.id)
      );
      for (const order of deliveryEligible) {
        const dist = haversineMiles(pos, [order.delivery_latitude, order.delivery_longitude]);
        if (dist <= ARRIVAL_RADIUS_MILES) {
          customerNotified.add(order.id);
          markCustomerNotified(order.id);
          try {
            const res = await base44.functions.invoke('notifyCustomerDriverArrived', { order_id: order.id });
            if (res.data?.success) {
              toast.success(`📍 Customer notified you've arrived for #${order.order_number} — ID ready!`, { duration: 5000 });
            }
          } catch (err) {
            console.error('[AutoArrivalNotifier] customer notify failed:', err);
          }
        }
      }
    };

    check();
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, []);

  if (permissionDenied) {
    return (
      <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 flex items-center gap-2">
        <span>⚠️ Enable location access so the store can be auto-notified when you arrive.</span>
      </div>
    );
  }
  return null;
}