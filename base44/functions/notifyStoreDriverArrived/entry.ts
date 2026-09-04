import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

function buildRawEmail(to, subject, html, fromName) {
  const fromHeader = `${fromName} <alcohol.delivered1@gmail.com>`;
  const message = [
    `From: ${fromHeader}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=UTF-8`,
    ``,
    html,
  ].join('\r\n');
  return btoa(unescape(encodeURIComponent(message)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { order_id } = await req.json();
    if (!order_id) {
      return Response.json({ error: 'order_id is required' }, { status: 400 });
    }

    const order = await base44.asServiceRole.entities.Order.get(order_id);
    if (!order) {
      return Response.json({ error: 'Order not found' }, { status: 404 });
    }

    // Only the assigned driver can trigger arrival notification
    if (order.driver_id !== user.id) {
      return Response.json({ error: 'Only the assigned driver can notify arrival' }, { status: 403 });
    }

    if (!order.store_id) {
      return Response.json({ skipped: true, reason: 'No store_id on order' });
    }

    const stores = await base44.asServiceRole.entities.Store.filter({ id: order.store_id });
    const store = stores[0];

    if (!store) {
      return Response.json({ skipped: true, reason: 'Store not found' });
    }

    const driverName = order.driver_name || user.full_name || 'Your driver';

    // Email notification to the store
    if (store.email) {
      try {
        // Use Gmail to send — store emails may not be registered app users
      const { accessToken: gmailToken } = await base44.asServiceRole.connectors.getConnection('gmail');
      const htmlBody = `
            <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; background: #f9fafb; border-radius: 12px;">
              <h2 style="color: #1e3a8a; margin-bottom: 4px;">🚗 Your Driver Has Arrived!</h2>
              <p style="color: #6b7280; font-size: 14px; margin-bottom: 20px;">${driverName} is at your store to pick up order <strong>#${order.order_number}</strong>. Please have the order ready for handoff.</p>
              <div style="background: white; border-radius: 10px; padding: 16px; margin-bottom: 16px; border: 1px solid #e5e7eb;">
                <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
                  <tr><td style="padding: 6px 0; color: #6b7280; width: 140px;">Order #</td><td style="padding: 6px 0; font-weight: 600;">${order.order_number}</td></tr>
                  <tr><td style="padding: 6px 0; color: #6b7280;">Driver</td><td style="padding: 6px 0;">${driverName}</td></tr>
                  <tr><td style="padding: 6px 0; color: #6b7280;">Customer</td><td style="padding: 6px 0;">${order.customer_name}</td></tr>
                  <tr><td style="padding: 6px 0; color: #6b7280;">Deliver To</td><td style="padding: 6px 0;">${order.delivery_address}</td></tr>
                </table>
              </div>
              <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0;">Please hand the sealed order to the driver so they can begin delivery.</p>
            </div>`;
        const raw = buildRawEmail(store.email, `🚗 Driver Arrived for Order #${order.order_number}`, htmlBody, 'Alcohol Delivered — Driver Arrival');
        const gmailRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${gmailToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ raw }),
        });
        if (!gmailRes.ok) {
          const errBody = await gmailRes.text();
          throw new Error(`Gmail API error: ${gmailRes.status} — ${errBody}`);
        }
        console.log(`[driverArrived] Email sent to store ${store.email} for order ${order.order_number}`);
      } catch (emailErr) {
        console.error(`[driverArrived] Email failed:`, emailErr.message);
      }
    }

    // FCM push notification to store owner devices
    try {
      const fcmTokens = await base44.asServiceRole.entities.FCMToken.filter({ store_id: order.store_id });
      if (fcmTokens.length > 0) {
        await base44.asServiceRole.functions.invoke('sendFCMPush', {
          tokens: fcmTokens.map((t) => t.token),
          title: '🚗 Driver Has Arrived',
          body: `${driverName} is here for order #${order.order_number}. Please have it ready!`,
          data: {
            order_id: order.id,
            order_number: order.order_number,
            type: 'driver_arrived',
          },
        });
        console.log(`[driverArrived] Push sent to store (${fcmTokens.length} tokens)`);
      } else {
        console.log(`[driverArrived] No FCM tokens for store — push skipped`);
      }
    } catch (pushErr) {
      console.error(`[driverArrived] Push failed:`, pushErr.message);
    }

    // SMS notification if store has notification_phone
    if (store.notification_phone) {
      console.log(`[driverArrived] SMS to ${store.notification_phone} — (SMS gateway not configured, logged only)`);
    }

    return Response.json({
      success: true,
      order_number: order.order_number,
      store: store.name,
      notified_via: {
        email: !!store.email,
        push: true,
      },
    });
  } catch (error) {
    console.error('[driverArrived] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});