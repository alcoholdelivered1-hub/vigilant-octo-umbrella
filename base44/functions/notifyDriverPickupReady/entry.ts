import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { sendSms, normalizePhone } from '../../shared/twilioSms.ts';

/**
 * Notifies the assigned driver when an order becomes ready for pickup at the store.
 * Sends an FCM push notification + email so the driver knows to head to the store.
 *
 * POST body: { order_id: string }  (called by the workflow on Order update → pickup_ready)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json().catch(() => ({}));

    // The workflow passes order_id; the entity trigger may also pass the full order in `data`
    let order = body.order || body.data;
    if (!order && body.order_id) {
      try {
        order = await base44.asServiceRole.entities.Order.get(body.order_id);
      } catch (e) {
        return Response.json({ skipped: true, reason: `Could not fetch order ${body.order_id}` });
      }
    }

    if (!order?.id) {
      return Response.json({ skipped: true, reason: 'No order data' });
    }

    if (!order.driver_id) {
      return Response.json({ skipped: true, reason: 'No driver assigned' });
    }

    // Look up the driver record.
    // order.driver_id may be: a Driver record id, a User id (most common — stored at
    // dispatch), or an email. Resolve robustly so notifications always reach the driver.
    let driver = null;
    try {
      driver = await base44.asServiceRole.entities.Driver.get(order.driver_id);
    } catch {
      // Not a Driver record id — try matching by the owning user id (created_by_id)
      const byUser = await base44.asServiceRole.entities.Driver.filter({ created_by_id: order.driver_id });
      if (byUser.length) {
        driver = byUser[0];
      } else {
        // Fall back to email match
        const byEmail = await base44.asServiceRole.entities.Driver.filter({ email: order.driver_id });
        if (byEmail.length) driver = byEmail[0];
      }
    }

    if (!driver?.email) {
      return Response.json({ skipped: true, reason: 'Driver email not found' });
    }

    // Look up the store for the pickup address
    let store = null;
    if (order.store_id) {
      try {
        store = await base44.asServiceRole.entities.Store.get(order.store_id);
      } catch {}
    }
    const storeAddress = store
      ? `${store.address}, ${store.city}, ${store.state} ${store.zip_code || ''}`.trim()
      : order.store_name;

    // Email the driver (registered app user)
    const subject = `📦 Order Ready for Pickup — ${order.order_number}`;
    const emailBody = `Hi ${driver.name || 'Driver'},

Order #${order.order_number} is now READY FOR PICKUP at ${order.store_name}.

Pickup at: ${storeAddress}
Delivery to: ${order.delivery_address}
Customer: ${order.customer_name}
Customer Phone: ${order.customer_phone || 'On file'}
Order Total: $${order.total?.toFixed(2)}

Open the Driver Portal and tap "Navigate to Store" for GPS directions to the store.

⚠️ Reminder: Verify the customer's government-issued ID at delivery.

— Alcohol Delivered`;

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: driver.email,
      subject,
      body: emailBody,
    }).catch((e) => console.error('SendEmail error:', e.message));

    // FCM push notification to driver
    const fcmTokens = await base44.asServiceRole.entities.FCMToken.filter({ driver_id: order.driver_id });
    if (fcmTokens.length > 0) {
      const tokens = fcmTokens.map(t => t.token);
      const fcmRes = await base44.asServiceRole.functions.invoke('sendFCMPush', {
        tokens,
        title: '📦 Order Ready for Pickup',
        body: `Order #${order.order_number} is ready at ${order.store_name} — tap to navigate`,
        data: { order_id: order.id, order_number: order.order_number, type: 'pickup_ready' },
      });
      console.log('FCM push result:', JSON.stringify(fcmRes));
    } else {
      console.log('No FCM tokens for driver — push skipped');
    }

    // Instant SMS pickup reminder so the driver heads to the store immediately
    const phone = normalizePhone(driver.phone || order.driver_id || '');
    if (phone) {
      const smsBody = `📦 Order #${order.order_number} is READY FOR PICKUP at ${order.store_name} (${storeAddress}). Deliver to ${order.delivery_address}. Open the driver app & tap "Navigate to Store". Remember to verify customer ID at delivery.`;
      const smsRes = await sendSms(phone, smsBody);
      if (smsRes.success) {
        console.log(`[notifyDriverPickupReady] SMS sent to ${driver.name} (${phone})`);
      } else {
        console.warn(`[notifyDriverPickupReady] SMS failed for ${driver.name}: ${smsRes.error}`);
      }
    }

    console.log(`Pickup-ready notification sent to driver ${driver.email} for order ${order.order_number}`);
    return Response.json({ success: true, driver: driver.email, order: order.order_number });
  } catch (error) {
    console.error('notifyDriverPickupReady error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});