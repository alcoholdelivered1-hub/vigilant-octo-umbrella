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

async function sendGmail(accessToken, to, subject, html, fromName) {
  const raw = buildRawEmail(to, subject, html, fromName);
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Gmail API error: ${res.status} — ${errBody}`);
  }
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

    // Only the assigned driver can trigger the customer arrival notification
    if (order.driver_id !== user.id) {
      return Response.json({ error: 'Only the assigned driver can notify arrival' }, { status: 403 });
    }

    const driverName = order.driver_name || user.full_name || 'Your driver';
    const customerEmail = order.customer_email;
    const customerName = order.customer_name || 'there';

    if (!customerEmail) {
      return Response.json({ skipped: true, reason: 'No customer email on order' });
    }

    // Email notification to the customer (via Gmail — customers may not be registered app users)
    try {
      const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
      const htmlBody = `
          <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; background: #f9fafb; border-radius: 12px;">
            <h2 style="color: #1e3a5f; margin-bottom: 4px;">🚗 ${driverName} is at your door!</h2>
            <p style="color: #6b7280; font-size: 14px; margin-bottom: 20px;">Your delivery for order <strong>#${order.order_number}</strong> is here. Please come out to meet your driver.</p>
            <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 10px; padding: 16px; margin-bottom: 16px;">
              <p style="margin: 0; font-size: 14px; color: #92400e; font-weight: 600;">⚠️ Please have your valid government-issued ID ready</p>
              <p style="margin: 6px 0 0; font-size: 13px; color: #92400e;">Arkansas law requires ID verification at delivery. The driver will check that you are 21+ and the person who placed the order.</p>
            </div>
            <div style="background: white; border-radius: 10px; padding: 16px; margin-bottom: 16px; border: 1px solid #e5e7eb;">
              <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
                <tr><td style="padding: 6px 0; color: #6b7280; width: 140px;">Order #</td><td style="padding: 6px 0; font-weight: 600;">${order.order_number}</td></tr>
                <tr><td style="padding: 6px 0; color: #6b7280;">Driver</td><td style="padding: 6px 0;">${driverName}</td></tr>
                <tr><td style="padding: 6px 0; color: #6b7280;">Deliver To</td><td style="padding: 6px 0;">${order.delivery_address}</td></tr>
              </table>
            </div>
            <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0;">Please meet the driver in person. Unattended deliveries are not permitted.</p>
          </div>`;
      await sendGmail(accessToken, customerEmail, `🚗 Your driver has arrived — have your ID ready!`, htmlBody, 'Alcohol Delivered');
      console.log(`[customerArrived] Email sent to ${customerEmail} for order ${order.order_number}`);
    } catch (emailErr) {
      console.error(`[customerArrived] Email failed:`, emailErr.message);
    }

    // FCM push notification to the customer's devices
    try {
      const fcmTokens = await base44.asServiceRole.entities.FCMToken.filter({ user_email: customerEmail });
      if (fcmTokens.length > 0) {
        await base44.asServiceRole.functions.invoke('sendFCMPush', {
          tokens: fcmTokens.map((t) => t.token),
          title: '🚗 Your driver has arrived!',
          body: `${driverName} is at your door for order #${order.order_number}. Please have your ID ready for verification.`,
          data: {
            order_id: order.id,
            order_number: order.order_number,
            type: 'driver_arrived_customer',
          },
        });
        console.log(`[customerArrived] Push sent to customer (${fcmTokens.length} tokens)`);
      } else {
        console.log(`[customerArrived] No FCM tokens for customer — push skipped`);
      }
    } catch (pushErr) {
      console.error(`[customerArrived] Push failed:`, pushErr.message);
    }

    return Response.json({
      success: true,
      order_number: order.order_number,
      customer: customerName,
      notified_via: {
        email: true,
        push: true,
      },
    });
  } catch (error) {
    console.error('[customerArrived] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});