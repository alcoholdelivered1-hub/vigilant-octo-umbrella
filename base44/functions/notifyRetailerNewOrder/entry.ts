import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { sendFCMToTokens } from '../../shared/fcmUtils.ts';
import { sendSms, normalizePhone } from '../../shared/twilioSms.ts';

function buildRawEmail(to, subject, body, fromName) {
  const fromHeader = `${fromName} <alcohol.delivered1@gmail.com>`;
  const message = [
    `From: ${fromHeader}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=UTF-8`,
    ``,
    body,
  ].join('\r\n');
  return btoa(unescape(encodeURIComponent(message)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    // Must be an automation event payload or called by admin
    if (!payload.event) {
      const user = await base44.auth.me().catch(() => null);
      if (user?.role !== 'admin') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const { event, data: order } = payload;

    if (!order || event?.type !== 'create') {
      return Response.json({ skipped: true, reason: 'Not a create event or missing order data' });
    }

    if (!order.store_id) {
      return Response.json({ skipped: true, reason: 'No store_id on order' });
    }

    // Fetch the store to get contact info
    const stores = await base44.asServiceRole.entities.Store.filter({ id: order.store_id });
    const store = stores[0];

    if (!store || !store.email) {
      console.log(`Store ${order.store_id} has no email configured — skipping retailer notification`);
      return Response.json({ skipped: true, reason: 'Store has no email address' });
    }

    const itemLines = (order.items || [])
      .map(i => `  • ${i.product_name} x${i.quantity} — $${(i.subtotal || i.price * i.quantity || 0).toFixed(2)}`)
      .join('\n');

    const subject = `🛒 New Order #${order.order_number} — Action Required`;

    const body = `Hello ${store.name} Team,

A new order has just been placed and is waiting for your confirmation.

─────────────────────────────
ORDER DETAILS
─────────────────────────────
Order #:        ${order.order_number}
Customer:       ${order.customer_name}
Phone:          ${order.customer_phone || 'N/A'}
Delivery To:    ${order.delivery_address}

ITEMS:
${itemLines || '  (No items listed)'}

─────────────────────────────
Subtotal:       $${(order.subtotal || 0).toFixed(2)}
Delivery Fee:   $${(order.delivery_fee || 0).toFixed(2)}
Tax:            $${(order.tax || 0).toFixed(2)}
TOTAL:          $${(order.total || 0).toFixed(2)}
─────────────────────────────

⚡ PLEASE CONFIRM AND BEGIN PREPARING THIS ORDER AS SOON AS POSSIBLE.

A driver will be dispatched to your location for pickup. Please have the order sealed and ready.

If you have questions, log in to the Alcohol Delivered Partner Portal or reply to this email.

— Alcohol Delivered Operations Team
alcohol-delivered.biz`;

    // Use Gmail to send — store emails may not be registered app users
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
    const raw = buildRawEmail(store.email, subject, body, 'Alcohol Delivered — Orders');
    const gmailRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw }),
    });
    if (!gmailRes.ok) {
      const errBody = await gmailRes.text();
      throw new Error(`Gmail API error: ${gmailRes.status} — ${errBody}`);
    }

    // FCM push notification to store owner — look up tokens by the store's
    // contact email (works for any device the store owner has logged into),
    // falling back to store_id-linked tokens.
    let fcmTokens = [];
    const byEmail = await base44.asServiceRole.entities.FCMToken.filter({ user_email: store.email });
    fcmTokens.push(...byEmail.map((t) => t.token));
    if (fcmTokens.length === 0) {
      const byStore = await base44.asServiceRole.entities.FCMToken.filter({ store_id: order.store_id });
      fcmTokens.push(...byStore.map((t) => t.token));
    }

    if (fcmTokens.length > 0) {
      try {
        const fcmResults = await sendFCMToTokens(
          fcmTokens,
          `🛒 New Order #${order.order_number}`,
          `${order.customer_name} · $${(order.total || 0).toFixed(2)} · ${(order.items || []).length} item(s)`,
          { order_id: order.id || '', order_number: order.order_number || '', type: 'new_order' }
        );
        const delivered = fcmResults.filter((r) => r.success).length;
        console.log(`Store push: ${delivered}/${fcmTokens.length} device(s) notified for ${store.name}`);
      } catch (err) {
        console.error(`Store push failed for ${store.name}: ${err.message}`);
      }
    } else {
      console.log(`No FCM tokens for ${store.email} — push skipped`);
    }

    // SMS alert to the store's notification phone (if configured) so staff can
    // start fulfilling immediately without checking email or the portal.
    if (store.notification_phone) {
      const smsTo = normalizePhone(store.notification_phone);
      if (smsTo) {
        const itemCount = (order.items || []).length;
        const smsBody = `Alcohol Delivered: New order #${order.order_number} from ${order.customer_name} — $${(order.total || 0).toFixed(2)} (${itemCount} item${itemCount === 1 ? '' : 's'}). Please confirm and begin preparing in the Partner Portal.`;
        try {
          const smsResult = await sendSms(smsTo, smsBody);
          if (smsResult.success) {
            console.log(`SMS alert sent to ${store.name} at ${smsTo} for order ${order.order_number}`);
          } else {
            console.error(`SMS alert failed for ${store.name}: ${smsResult.error}`);
          }
        } catch (err) {
          console.error(`SMS alert exception for ${store.name}: ${err.message}`);
        }
      } else {
        console.log(`Invalid notification_phone for ${store.name}: ${store.notification_phone} — SMS skipped`);
      }
    } else {
      console.log(`No notification_phone on ${store.name} — SMS skipped`);
    }

    console.log(`Retailer notification sent to ${store.email} for order ${order.order_number}`);
    return Response.json({ success: true, store: store.name, recipient: store.email });

  } catch (error) {
    console.error('Error sending retailer notification:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});