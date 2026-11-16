import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { assertAdmin } from '../../shared/authGuard.ts';
import { attachDriverCompliance } from '../../shared/driverAnnualCompliance.ts';
import { driverIsProductionQualified } from '../../shared/verifiedTaxDriverReadiness.ts';

const PINE_BLUFF_LAT = 34.2284;
const PINE_BLUFF_LON = -92.0032;

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 3959;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const { authorized, response } = await assertAdmin(base44);
    if (!authorized) return response;

    const order = body?.data;
    const oldData = body?.old_data;

    if (!order) {
      return Response.json({ skipped: true, reason: 'No order data' });
    }

    // Only fire when status transitions TO 'confirmed'
    const becameConfirmed = order.status === 'confirmed' && oldData?.status !== 'confirmed';
    if (!becameConfirmed) {
      return Response.json({ skipped: true, reason: 'Not a confirmed transition' });
    }

    // Skip if a driver is already assigned
    if (order.driver_id) {
      return Response.json({ skipped: true, reason: 'Driver already assigned' });
    }

    // Fetch available drivers
    const drivers = await base44.asServiceRole.entities.Driver.filter({
      is_active: true,
      status: 'available',
      training_completed: true,
    });

    if (drivers.length === 0) {
      console.warn(`[notifyNearestDriver] No available drivers for order ${order.order_number}`);
      return Response.json({ success: false, reason: 'No available drivers' });
    }

    const orderLat = order.delivery_latitude || order.order_latitude || PINE_BLUFF_LAT;
    const orderLon = order.delivery_longitude || order.order_longitude || PINE_BLUFF_LON;

    // Sort drivers by distance
    const qualifiedDrivers = (await attachDriverCompliance(base44, drivers)).filter(driverIsProductionQualified);
    const sorted = qualifiedDrivers
      .map(driver => {
        const dLat = driver.current_latitude || PINE_BLUFF_LAT;
        const dLon = driver.current_longitude || PINE_BLUFF_LON;
        const distance = haversineDistance(dLat, dLon, orderLat, orderLon);
        return { driver, distance };
      })
      .sort((a, b) => a.distance - b.distance);

    // Notify top 3 closest drivers so there's redundancy
    const toNotify = sorted.slice(0, 3);
    const appUrl = 'https://app.base44.com/apps/alcohol-delivered-biz';
    const claimUrl = `${appUrl}/driver?claim=${order.id}`;

    let notified = 0;
    for (const { driver, distance } of toNotify) {
      if (!driver.email) continue;

      const payEstimate = `$3.00${order.tip > 0 ? ` + $${order.tip.toFixed(2)} tip = $${(3 + order.tip).toFixed(2)} total` : ' delivery fee + any tip'}`;
      const distStr = distance.toFixed(1);
      const itemCount = order.items?.length || 0;

      await base44.asServiceRole.integrations.Core.SendEmail({
        to: driver.email,
        subject: `🔔 New Delivery Available — $${(3 + (order.tip || 0)).toFixed(2)} — ${order.order_number}`,
        body: `
          <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; background: #f9fafb; border-radius: 12px;">
            <h2 style="color: #1e3a8a; margin-bottom: 4px;">New Order Available! 🚚</h2>
            <p style="color: #6b7280; font-size: 14px; margin-bottom: 20px;">You're one of the closest available drivers. Claim it fast before someone else does!</p>

            <div style="background: #d1fae5; border: 1px solid #6ee7b7; border-radius: 10px; padding: 14px 16px; margin-bottom: 16px; text-align: center;">
              <p style="font-size: 13px; color: #065f46; margin: 0 0 4px;">Your estimated pay</p>
              <p style="font-size: 28px; font-weight: bold; color: #047857; margin: 0;">${payEstimate}</p>
            </div>

            <div style="background: white; border-radius: 10px; padding: 16px; margin-bottom: 16px; border: 1px solid #e5e7eb;">
              <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
                <tr><td style="padding: 6px 0; color: #6b7280; width: 140px;">Order #</td><td style="padding: 6px 0; font-weight: 600;">${order.order_number}</td></tr>
                <tr><td style="padding: 6px 0; color: #6b7280;">Store</td><td style="padding: 6px 0;">${order.store_name}</td></tr>
                <tr><td style="padding: 6px 0; color: #6b7280;">Deliver To</td><td style="padding: 6px 0;">${order.delivery_address}</td></tr>
                <tr><td style="padding: 6px 0; color: #6b7280;">Items</td><td style="padding: 6px 0;">${itemCount} item${itemCount !== 1 ? 's' : ''}</td></tr>
                <tr><td style="padding: 6px 0; color: #6b7280;">Distance</td><td style="padding: 6px 0;">~${distStr} miles from your location</td></tr>
              </table>
            </div>

            <a href="${claimUrl}" style="display: block; background: #1e3a8a; color: white; text-align: center; text-decoration: none; font-weight: bold; font-size: 16px; padding: 14px 20px; border-radius: 10px; margin-bottom: 12px;">
              ✅ Claim This Delivery
            </a>

            <p style="font-size: 11px; color: #9ca3af; text-align: center; margin: 0;">This order may be claimed by another driver. First to click wins. Remember to verify customer ID at delivery.</p>
          </div>
        `,
      });

      notified++;
      console.log(`[notifyNearestDriver] Notified driver ${driver.name} (${driver.email}) — ${distStr} mi away`);
    }

    return Response.json({
      success: true,
      order_number: order.order_number,
      drivers_notified: notified,
      candidates: toNotify.map(({ driver, distance }) => ({
        name: driver.name,
        email: driver.email,
        distance_miles: parseFloat(distance.toFixed(2)),
      })),
    });
  } catch (error) {
    console.error('[notifyNearestDriver] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}