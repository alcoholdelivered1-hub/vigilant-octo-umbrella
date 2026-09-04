import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { isBackgroundCheckGenuine } from '../../shared/driverVetting.ts';

const PINE_BLUFF_LAT = 34.2284;
const PINE_BLUFF_LON = -92.0032;

// Max active orders per vehicle type (capacity)
const CAPACITY_LIMIT = {
  car: 3,
  suv: 4,
  truck: 5,
  van: 6,
  motorcycle: 2,
};

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 3959; // miles
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getCapacityLimit(driver) {
  if (!driver.vehicle_info) return 3; // default
  const info = driver.vehicle_info.toLowerCase();
  for (const [type, limit] of Object.entries(CAPACITY_LIMIT)) {
    if (info.includes(type)) return limit;
  }
  return 3; // fallback
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // Auth: must be authenticated via platform (admin user or automation)
    const authenticated = await base44.auth.isAuthenticated().catch(() => false);
    if (!authenticated) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }
    // If a user is present, they must be an admin (automations have no user)
    const currentUser = await base44.auth.me().catch(() => null);
    if (currentUser && currentUser.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Accept either a direct call with order_id OR an automation payload
    const orderId = body.order_id || body.event?.entity_id || body.data?.id;

    if (!orderId) {
      return Response.json({ error: 'order_id is required' }, { status: 400 });
    }

    // Fetch the order
    const order = await base44.asServiceRole.entities.Order.get(orderId);

    if (!order) {
      return Response.json({ error: 'Order not found' }, { status: 404 });
    }

    // Dispatch orders that are paid/confirmed or pending and have no driver yet.
    // The Stripe webhook creates paid orders with status 'confirmed', so we must
    // accept 'confirmed' here or auto-dispatch would never fire for real orders.
    if (order.driver_id) {
      return Response.json({ skipped: true, reason: 'Order already has a driver' });
    }
    if (order.status !== 'pending' && order.status !== 'confirmed') {
      return Response.json({
        skipped: true,
        reason: `Order status is '${order.status}' — only pending/confirmed orders can be dispatched`,
      });
    }

    const orderLat = order.delivery_latitude || order.order_latitude || PINE_BLUFF_LAT;
    const orderLon = order.delivery_longitude || order.order_longitude || PINE_BLUFF_LON;

    // --- ZONE DETECTION ---
    // Determine which delivery zone the order's delivery address falls within
    const zones = await base44.asServiceRole.entities.DeliveryZone.filter({ is_active: true });

    const orderZone = zones
      .filter((z) => z.center_latitude && z.center_longitude)
      .map((z) => {
        const dist = haversineDistance(orderLat, orderLon, z.center_latitude, z.center_longitude);
        return { zone: z, distance: dist, inZone: dist <= (z.radius_miles || 10) };
      })
      .filter((z) => z.inZone)
      .sort((a, b) => a.distance - b.distance)[0];

    console.log(
      `[autoDispatch] Order ${order.order_number} at (${orderLat.toFixed(4)}, ${orderLon.toFixed(4)})` +
        (orderZone
          ? ` → zone "${orderZone.zone.name}" (${orderZone.distance.toFixed(1)} mi from center, radius ${orderZone.zone.radius_miles}mi)`
          : ' → no matching zone, using all drivers')
    );

    // Fetch all active, available drivers
    const allDrivers = await base44.asServiceRole.entities.Driver.filter({
      is_active: true,
      status: { $in: ['available', 'on_delivery'] },
    });

    if (allDrivers.length === 0) {
      console.warn(`[autoDispatch] No available drivers for order ${order.order_number}`);
      return Response.json({ success: false, reason: 'No available drivers' });
    }

    // --- ZONE-AWARE DRIVER FILTERING ---
    // Only consider drivers whose current GPS location is within the order's zone
    let candidateDrivers = allDrivers;
    let zoneMatched = false;
    if (orderZone) {
      const zc = orderZone.zone;
      candidateDrivers = allDrivers.filter((d) => {
        if (!d.current_latitude || !d.current_longitude) return false;
        return (
          haversineDistance(d.current_latitude, d.current_longitude, zc.center_latitude, zc.center_longitude) <=
          (zc.radius_miles || 10)
        );
      });
      zoneMatched = true;
      console.log(
        `[autoDispatch] Zone "${zc.name}": ${candidateDrivers.length} of ${allDrivers.length} available drivers are in-zone`
      );
      // Fall back to all drivers if no drivers are currently in the zone
      if (candidateDrivers.length === 0) {
        console.warn(`[autoDispatch] No drivers in zone "${zc.name}" — falling back to all available drivers`);
        candidateDrivers = allDrivers;
        zoneMatched = false;
      }
    }

    // Fetch active orders to measure each driver's current load
    const activeOrders = await base44.asServiceRole.entities.Order.filter({
      status: { $in: ['confirmed', 'preparing', 'pickup_ready', 'in_transit'] },
    });

    // Score each candidate driver: lower = better
    const scored = candidateDrivers
      .map((driver) => {
        const dLat = driver.current_latitude || PINE_BLUFF_LAT;
        const dLon = driver.current_longitude || PINE_BLUFF_LON;
        const distance = haversineDistance(dLat, dLon, orderLat, orderLon);
        const load = activeOrders.filter((o) => o.driver_id === driver.id).length;
        const capacity = getCapacityLimit(driver);

        // Skip drivers at capacity
        if (load >= capacity) return null;

        // Security gate: only drivers with a genuine cleared background check
        // may carry customer orders (simulated/test checks are rejected).
        if (!isBackgroundCheckGenuine(driver)) return null;

        // Score: distance (miles) + 4 pts per active order already carrying
        const score = distance + load * 4;
        return { driver, distance, load, capacity, score };
      })
      .filter(Boolean)
      .sort((a, b) => a.score - b.score);

    if (scored.length === 0) {
      console.warn(`[autoDispatch] All candidate drivers are at capacity for order ${order.order_number}`);
      return Response.json({ success: false, reason: 'All available drivers are at capacity' });
    }

    const best = scored[0];

    // Assign driver and advance status to 'confirmed'
    await base44.asServiceRole.entities.Order.update(orderId, {
      driver_id: best.driver.id,
      driver_name: best.driver.name,
      status: 'confirmed',
    });

    // Update driver status to on_delivery if they were available
    if (best.driver.status === 'available') {
      await base44.asServiceRole.entities.Driver.update(best.driver.id, {
        status: 'on_delivery',
      });
    }

    console.log(
      `[autoDispatch] Order ${order.order_number} → Driver ${best.driver.name} ` +
        `(${best.distance.toFixed(1)} mi, load ${best.load}/${best.capacity}, score ${best.score.toFixed(1)}, zone_match: ${zoneMatched})`
    );

    // --- NOTIFY THE CLOSEST ZONE DRIVER ---
    const zoneName = orderZone?.zone?.name || 'Pine Bluff';
    const distStr = best.distance.toFixed(1);

    // FCM push notification to the driver's registered devices
    try {
      const fcmTokens = await base44.asServiceRole.entities.FCMToken.filter({ driver_id: best.driver.id });
      if (fcmTokens.length > 0) {
        await base44.asServiceRole.functions.invoke('sendFCMPush', {
          tokens: fcmTokens.map((t) => t.token),
          title: '🎯 New Order in Your Zone',
          body: `Order #${order.order_number} from ${order.store_name} — ${distStr} mi away. You're the closest driver in ${zoneName}!`,
          data: {
            order_id: order.id,
            order_number: order.order_number,
            type: 'zone_dispatch',
            zone: zoneName,
          },
        });
        console.log(`[autoDispatch] Push sent to driver ${best.driver.name} (${fcmTokens.length} tokens)`);
      } else {
        console.log(`[autoDispatch] No FCM tokens for driver ${best.driver.name} — push skipped`);
      }
    } catch (pushErr) {
      console.error(`[autoDispatch] Push notification failed:`, pushErr.message);
    }

    // Email notification to the driver
    if (best.driver.email) {
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: best.driver.email,
          subject: `🎯 New Order in Your Zone — ${order.order_number}`,
          body: `
            <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; background: #f9fafb; border-radius: 12px;">
              <h2 style="color: #1e3a8a; margin-bottom: 4px;">🎯 New Order Dispatched to You!</h2>
              <p style="color: #6b7280; font-size: 14px; margin-bottom: 20px;">You're the closest available driver in the <strong>${zoneName}</strong> zone. This order has been auto-assigned to you.</p>
              <div style="background: white; border-radius: 10px; padding: 16px; margin-bottom: 16px; border: 1px solid #e5e7eb;">
                <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
                  <tr><td style="padding: 6px 0; color: #6b7280; width: 140px;">Order #</td><td style="padding: 6px 0; font-weight: 600;">${order.order_number}</td></tr>
                  <tr><td style="padding: 6px 0; color: #6b7280;">Store</td><td style="padding: 6px 0;">${order.store_name}</td></tr>
                  <tr><td style="padding: 6px 0; color: #6b7280;">Deliver To</td><td style="padding: 6px 0;">${order.delivery_address}</td></tr>
                  <tr><td style="padding: 6px 0; color: #6b7280;">Distance</td><td style="padding: 6px 0;">~${distStr} miles from your location</td></tr>
                  <tr><td style="padding: 6px 0; color: #6b7280;">Zone</td><td style="padding: 6px 0;">${zoneName}</td></tr>
                </table>
              </div>
              <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0;">Open the Driver Portal to view full details and confirm pickup. Remember to verify customer ID at delivery.</p>
            </div>
          `,
        });
        console.log(`[autoDispatch] Email sent to driver ${best.driver.email}`);
      } catch (emailErr) {
        console.error(`[autoDispatch] Email notification failed:`, emailErr.message);
      }
    }

    return Response.json({
      success: true,
      order_number: order.order_number,
      zone: zoneName,
      zone_match: zoneMatched,
      assigned_driver: best.driver.name,
      driver_distance_miles: parseFloat(best.distance.toFixed(2)),
      driver_current_load: best.load,
      driver_capacity: best.capacity,
      score: parseFloat(best.score.toFixed(2)),
      notification_sent: true,
      all_candidates: scored.map((s) => ({
        name: s.driver.name,
        distance_mi: parseFloat(s.distance.toFixed(2)),
        load: s.load,
        capacity: s.capacity,
        score: parseFloat(s.score.toFixed(2)),
      })),
    });
  } catch (error) {
    console.error('[autoDispatch] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});