import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { haversineDistance, PINE_BLUFF_LAT, PINE_BLUFF_LON } from '../../shared/geoUtils.ts';
import { sendSms, normalizePhone } from '../../shared/twilioSms.ts';
import { sendFCMToTokens } from '../../shared/fcmUtils.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // Accept entity automation payload OR admin call
    const isAutomation = body?.event?.type !== undefined;
    if (!isAutomation) {
      const user = await base44.auth.me();
      if (user?.role !== 'admin') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

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
    const sorted = drivers
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
    let smsSent = 0;
    for (const { driver, distance } of toNotify) {
      if (!driver.email) continue;

      const payEstimate = `$4.75${order.tip > 0 ? ` + $${order.tip.toFixed(2)} tip = $${(4.75 + order.tip).toFixed(2)} total` : ' delivery fee + any tip'}`;
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

      // Instant SMS alert (in addition to email) so drivers can react fast
      const phone = normalizePhone(driver.phone || '');
      if (phone) {
        const smsBody = `🚚 New delivery available — ${order.order_number} at ${order.store_name}. ~${distStr} mi away. Pay est: ${payEstimate}. Open the driver app to claim it fast!`;
        const smsRes = await sendSms(phone, smsBody);
        if (smsRes.success) {
          smsSent++;
          console.log(`[notifyNearestDriver] SMS sent to ${driver.name} (${phone})`);
        } else {
          console.warn(`[notifyNearestDriver] SMS failed for ${driver.name}: ${smsRes.error}`);
        }
      }

      // High-priority push — shows a banner even when the driver is inside
      // DoorDash/Instacart/another gig app, so they don't miss the order.
      try {
        const tokens = (await base44.asServiceRole.entities.FCMToken.filter({ user_email: driver.email })).map(t => t.token);
        if (tokens.length > 0) {
          const pushResults = await sendFCMToTokens(
            tokens,
            `🚚 New Delivery — ${payEstimate}`,
            `${order.store_name} · ${itemCount} item(s) · ~${distStr} mi · #${order.order_number}`,
            { order_id: order.id || '', order_number: order.order_number || '', type: 'new_delivery', claim_url }
          );
          const delivered = pushResults.filter(r => r.success).length;
          console.log(`[notifyNearestDriver] Push to ${driver.name}: ${delivered}/${tokens.length} device(s)`);
        }
      } catch (err) {
        console.warn(`[notifyNearestDriver] Push failed for ${driver.name}: ${err.message}`);
      }
    }

    return Response.json({
      success: true,
      order_number: order.order_number,
      drivers_notified: notified,
      sms_sent: smsSent,
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
});