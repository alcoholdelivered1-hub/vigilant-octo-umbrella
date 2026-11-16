import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';
import { assertAdmin } from '../../shared/authGuard.ts';

const JUSTIN_DRIVER_ID = '6a7b78a1fba348547e219d78';
const JUSTIN_EMAIL = 'jpbsandiego@yahoo.com';
const JUSTIN_NAME = 'Justin Bess';
const JUSTIN_PHONE = '+18705151216';
const BK_STORE_ID = '6a32d14d09b760f592dbf19e';

export default async function(req) {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

    const base44 = createClientFromRequest(req);
    const access = await assertAdmin(base44);
    if (!access.authorized) return access.response;

    const { order_id } = await req.json();
    if (!order_id) return Response.json({ error: 'order_id is required' }, { status: 400 });

    // Alert only after the retailer has accepted and prepared the paid order.
    const order = await base44.entities.Order.get(order_id).catch(() => null);
    if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });
    if (order.stripe_payment_status !== 'paid') {
      return Response.json({ skipped: true, reason: `Order payment status is ${order.stripe_payment_status}, not paid` });
    }

    if (order.status !== 'pickup_ready' || order.id_verified_at_checkout !== true || order.is_in_legal_zone !== true) {
      return Response.json({ skipped: true, reason: 'Awaiting retailer pickup readiness and compliance clearance' });
    }
    if (order.driver_id && order.driver_id !== JUSTIN_DRIVER_ID) {
      return Response.json({ skipped: true, reason: 'Order belongs to another driver' });
    }

    // 2. Fetch the store for pickup address
    const store = await base44.entities.Store.get(order.store_id).catch(() => null);
    if (!store) return Response.json({ error: 'Store not found' }, { status: 404 });

    const pickupAddress = `${store.address}, ${store.city}, ${store.state} ${store.zip_code}`;
    const deliveryAddress = order.delivery_address || '';

    // 3. Build Google Maps directions link (store → delivery address)
    const mapsLink = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(pickupAddress)}&destination=${encodeURIComponent(deliveryAddress)}&travelmode=driving`;

    // Do not dispatch a driver whose production background check is incomplete.
    const driver = await base44.entities.Driver.get(JUSTIN_DRIVER_ID);
    if (!driver?.is_active || !driver.training_completed || driver.background_check_status !== 'clear' || !driver.background_check_id || driver.background_check_id.startsWith('simulated_')) {
      return Response.json({ skipped: true, reason: 'Driver qualification is not complete' });
    }
    // 4. Assign Justin as the driver (if not already assigned)
    if (!order.driver_id) {
      await base44.entities.Order.update(order.id, {
        driver_id: JUSTIN_DRIVER_ID,
        driver_email: JUSTIN_EMAIL,
        driver_name: JUSTIN_NAME,
      });
    }

    // 5. Send SMS via Twilio (most reliable — Justin has no FCM tokens yet)
    let smsResult = null;
    const twilioSid = secrets.get('TWILIO_ACCOUNT_SID');
    const twilioToken = secrets.get('TWILIO_AUTH_TOKEN');
    const twilioFrom = secrets.get('TWILIO_FROM_NUMBER');
    if (twilioSid && twilioToken && twilioFrom) {
      try {
        const smsBody = `🚚 Pickup ready at ${store.name} (${pickupAddress}). Deliver to: ${deliveryAddress}. Directions: ${mapsLink} — Order #${order.order_number}, $${(order.total || 0).toFixed(2)}. Customer: ${order.customer_name} ${order.customer_phone || ''}`;
        const smsRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
          method: 'POST',
          headers: {
            Authorization: 'Basic ' + btoa(`${twilioSid}:${twilioToken}`),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ To: JUSTIN_PHONE, From: twilioFrom, Body: smsBody }),
        });
        const smsData = await smsRes.json();
        smsResult = { sent: smsRes.ok, sid: smsData.sid, error: !smsRes.ok ? smsData.message : null };
      } catch (smsError) {
        smsResult = { sent: false, error: smsError.message };
      }
    }

    // 6. Send email with full details
    let emailResult = null;
    try {
      const itemLines = (order.items || [])
        .map(i => `  • ${i.product_name} x${i.quantity} — $${(i.subtotal || 0).toFixed(2)}`)
        .join('\n');

      await base44.asServiceRole.integrations.Core.SendEmail({
        to: JUSTIN_EMAIL,
        subject: `🚚 Pickup Ready — Order #${order.order_number} at ${store.name}`,
        body: `Hi Justin,

An order is filled and ready for pickup at ${store.name}.

PICKUP LOCATION:
${store.name}
${store.address}
${store.city}, ${store.state} ${store.zip_code}
Store Phone: ${store.phone || 'N/A'}

DELIVER TO:
${deliveryAddress}
Customer: ${order.customer_name}
Customer Phone: ${order.customer_phone || 'N/A'}

ORDER DETAILS:
Order #: ${order.order_number}
${itemLines}

Total: $${(order.total || 0).toFixed(2)}

DIRECTIONS (store → delivery):
${mapsLink}

⚠️ Reminder: You must verify the customer's government-issued ID at delivery.

— Alcohol Delivered`,
      });
      emailResult = { sent: true };
    } catch (emailError) {
      emailResult = { sent: false, error: emailError.message };
    }

    // 7. Send FCM push (for when Justin registers push on his device)
    let pushResult = null;
    try {
      const fcmTokens = await base44.entities.FCMToken.filter({ user_email: JUSTIN_EMAIL });
      if (fcmTokens.length > 0) {
        const tokens = [...new Set(fcmTokens.map(t => t.token).filter(Boolean))];
        if (tokens.length > 0) {
          pushResult = await base44.asServiceRole.functions.invoke('sendFCMPush', {
            tokens,
            title: `🚚 Pickup Ready — ${store.name}`,
            body: `Order #${order.order_number}. Deliver to ${deliveryAddress}. Tap for directions.`,
            data: {
              order_id: order.id,
              order_number: order.order_number,
              store_name: store.name,
              pickup_address: pickupAddress,
              delivery_address: deliveryAddress,
              maps_link: mapsLink,
              type: 'pickup_ready',
            },
          });
        }
      }
    } catch (pushError) {
      pushResult = { error: pushError.message };
    }

    console.log(`Justin alerted for order ${order.order_number}: SMS=${smsResult?.sent}, email=${emailResult?.sent}`);

    return Response.json({
      success: true,
      order_number: order.order_number,
      driver_assigned: !order.driver_id,
      driver: JUSTIN_NAME,
      sms: smsResult,
      email: emailResult,
      push: pushResult,
      maps_link: mapsLink,
    });
  } catch (error) {
    console.error('alertJustinPickup error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}