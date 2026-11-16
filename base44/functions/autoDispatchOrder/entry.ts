import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';
import { assertAdmin } from '../../shared/authGuard.ts';
import { createDoorDashDelivery } from '../../shared/doordash.ts';
import { PRIORITY_STORE_IDS, dispatchPriorityOrder } from '../../shared/priorityDeliveries.ts';
import { verifyABCDeliveryArea } from '../../shared/abcDeliveryArea.ts';
import { attachDriverCompliance } from '../../shared/driverAnnualCompliance.ts';
import { driverHasProductionCredentials } from '../../shared/verifiedTaxDriverReadiness.ts';

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

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const { authorized, response } = await assertAdmin(base44);
    if (!authorized) return response;

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

    // The two priority retailers use cleared internal drivers, never paid third-party fallback.
    if (PRIORITY_STORE_IDS.includes(order.store_id)) {
      return Response.json(await dispatchPriorityOrder(base44, order, body.dry_run === true));
    }
    if (body.priority_only === true) return Response.json({ skipped: true, reason: 'Not a priority store' });

    // Only dispatch after the retailer has accepted the paid, compliant order.
    if (order.status !== 'confirmed' || order.driver_id || order.stripe_payment_status !== 'paid' || order.id_verified_at_checkout !== true || order.is_in_legal_zone !== true) {
      let reason = `Order status is '${order.status}', not retailer-confirmed`;
      if (order.driver_id) reason = 'Order already has a driver';
      else if (order.stripe_payment_status !== 'paid') reason = 'Order payment is not confirmed';
      else if (order.id_verified_at_checkout !== true) reason = 'Checkout ID verification is not confirmed';
      else if (order.is_in_legal_zone !== true) reason = 'Delivery zone is not confirmed legal';
      return Response.json({ skipped: true, reason });
    }

    // === Primary: attempt DoorDash Drive delivery ===
    let store = null;
    try {
      if (order.store_id) store = await base44.asServiceRole.entities.Store.get(order.store_id);
    } catch {}
    if (!store && order.store_name) {
      const byName = await base44.asServiceRole.entities.Store.filter({ name: order.store_name }, '-updated_date', 1);
      store = byName?.[0] || null;
    }

    if (!store) return Response.json({ skipped: true, reason: 'A verified retailer is required before dispatch.' });
    try { await verifyABCDeliveryArea(store, order.delivery_latitude, order.delivery_longitude); }
    catch (error) { return Response.json({ skipped: true, reason: error.message }); }

    if (store) {
      let ddResult;
      try {
        ddResult = await createDoorDashDelivery({ order, store });
      } catch (ddErr) {
        ddResult = { success: false, error: ddErr.message };
      }

      if (ddResult.success) {
        await base44.asServiceRole.entities.Order.update(orderId, {
          driver_id: `doordash:${ddResult.delivery_id}`,
          driver_email: 'doordash@alcohol-delivered.local',
          driver_name: 'DoorDash Dasher',
          doordash_delivery_id: ddResult.delivery_id,
          status: 'confirmed',
          notes: (order.notes ? order.notes + '\n' : '') + `Dispatched to DoorDash (delivery ${ddResult.delivery_id}).`,
        });

        console.log(`[autoDispatch] Order ${order.order_number} → DoorDash (delivery ${ddResult.delivery_id})`);

        return Response.json({
          success: true,
          fulfillment: 'doordash',
          order_number: order.order_number,
          doordash_delivery_id: ddResult.delivery_id,
          dasher_status: ddResult.dasher_status,
        });
      }

      console.warn(`[autoDispatch] DoorDash unavailable for order ${order.order_number}: ${ddResult.error}. Falling back to internal drivers.`);
    } else {
      console.warn(`[autoDispatch] Store not found for order ${order.order_number}; skipping DoorDash attempt, using internal drivers.`);
    }

    // === Fallback: internal drivers ===
    const driverRecords = await base44.asServiceRole.entities.Driver.filter({
      is_active: true,
      status: { $in: ['available', 'on_delivery'] },
    });
    const allDrivers = (await attachDriverCompliance(base44, driverRecords)).filter(driverHasProductionCredentials);

    if (allDrivers.length === 0) {
      console.warn(`[autoDispatch] No available drivers for order ${order.order_number}`);
      return Response.json({ success: false, fulfillment: 'internal', reason: 'No available drivers' });
    }

    // Fetch active orders to measure each driver's current load
    const activeOrders = await base44.asServiceRole.entities.Order.filter({
      status: { $in: ['confirmed', 'preparing', 'pickup_ready', 'in_transit'] },
    });

    const orderLat = order.delivery_latitude || order.order_latitude || PINE_BLUFF_LAT;
    const orderLon = order.delivery_longitude || order.order_longitude || PINE_BLUFF_LON;

    // Score each driver: lower = better
    const scored = allDrivers
      .map((driver) => {
        const dLat = driver.current_latitude || PINE_BLUFF_LAT;
        const dLon = driver.current_longitude || PINE_BLUFF_LON;
        const distance = haversineDistance(dLat, dLon, orderLat, orderLon);
        const load = activeOrders.filter((o) => o.driver_id === driver.id).length;
        const capacity = getCapacityLimit(driver);

        // Skip drivers at capacity
        if (load >= capacity) return null;

        // Score: distance (miles) + 4 pts per active order already carrying
        const score = distance + load * 4;
        return { driver, distance, load, capacity, score };
      })
      .filter(Boolean)
      .sort((a, b) => a.score - b.score);

    if (scored.length === 0) {
      console.warn(`[autoDispatch] All drivers are at capacity for order ${order.order_number}`);
      return Response.json({ success: false, fulfillment: 'internal', reason: 'All available drivers are at capacity' });
    }

    const best = scored[0];

    // Assign driver while preserving the retailer-confirmed status.
    await base44.asServiceRole.entities.Order.update(orderId, {
      driver_id: best.driver.id,
      driver_email: best.driver.email,
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
        `(${best.distance.toFixed(1)} mi, load ${best.load}/${best.capacity}, score ${best.score.toFixed(1)})`
    );

    return Response.json({
      success: true,
      fulfillment: 'internal',
      order_number: order.order_number,
      assigned_driver: best.driver.name,
      driver_distance_miles: parseFloat(best.distance.toFixed(2)),
      driver_current_load: best.load,
      driver_capacity: best.capacity,
      score: parseFloat(best.score.toFixed(2)),
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
}