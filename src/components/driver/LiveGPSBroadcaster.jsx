import { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

/**
 * Invisible component: while mounted, watches the device GPS and pushes
 * coordinates every 10 seconds to:
 *  - All in_transit orders assigned to this driver
 *  - The Driver entity record (for the admin dispatch map)
 */
export default function LiveGPSBroadcaster({ driverId, driverEmail }) {
  const watchRef = useRef(null);
  const intervalRef = useRef(null);
  const locationRef = useRef(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    if ((!driverId && !driverEmail) || !navigator.geolocation) return;

    // Watch GPS position
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        locationRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setPermissionDenied(true);
          toast.error('GPS access denied. Enable location in your browser to share your position.');
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );

    const push = async () => {
      if (!locationRef.current) return;
      const { lat, lng } = locationRef.current;
      const now = new Date().toISOString();

      try {
        // 1. Update in_transit orders for this driver — match ONLY by driver_id
        //    (previous logic matched any order with a driver_name set, which
        //    leaked one driver's GPS into every other driver's in-transit order).
        const orders = await base44.entities.Order.filter({ status: 'in_transit' });
        const myOrders = orders.filter(o => driverId && o.driver_id === driverId);
        await Promise.all(myOrders.map(o =>
          base44.entities.Order.update(o.id, {
            driver_current_latitude: lat,
            driver_current_longitude: lng,
            driver_location_updated_at: now,
          })
        ));

        // 2. Update the Driver entity record
        const query = driverId ? { id: driverId } : { email: driverEmail };
        const drivers = await base44.entities.Driver.filter(query);
        if (drivers[0]) {
          await base44.entities.Driver.update(drivers[0].id, {
            current_latitude: lat,
            current_longitude: lng,
          });
        }
      } catch (err) {
        console.error('LiveGPSBroadcaster push error:', err);
      }
    };

    // Push immediately, then every 10s
    push();
    intervalRef.current = setInterval(push, 10000);

    return () => {
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [driverId, driverEmail]);

  // This component renders nothing visible — GPS errors are surfaced via toast
  return null;
}