import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';
import { getCloverClient } from '../../shared/cloverConnection.ts';
import { assertAdmin } from '../../shared/authGuard.ts';

const orderNumber = 'SS-MS7OHVYB';
const storeId = '6a32d14d09b760f592dbf19e';
const singhEmail = 'bevking71603@gmail.com';
const adminEmail = 'alcohol.delivered1@gmail.com';

function header(headers, name) {
  return headers.find((item) => item.name?.toLowerCase() === name.toLowerCase())?.value || '';
}

function plainText(payload) {
  if (payload?.mimeType === 'text/plain' && payload.body?.data) {
    return atob(payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
  }
  for (const part of payload?.parts || []) {
    const text = plainText(part);
    if (text) return text;
  }
  return '';
}

async function alertAdmin(base44, subject, body) {
  await base44.asServiceRole.integrations.Core.SendEmail({
    from_name: 'Alcohol Delivered',
    to: adminEmail,
    subject,
    body,
  });
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const { authorized, response } = await assertAdmin(base44);
    if (!authorized) return response;
    const body = await req.json();
    const messageIds = body.data?.new_message_ids || [];
    if (messageIds.length === 0) return Response.json({ skipped: true, reason: 'No new Gmail messages' });
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
    const gmailHeaders = { Authorization: `Bearer ${accessToken}` };
    const results = [];

    for (const messageId of messageIds) {
      const messageResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
        { headers: gmailHeaders },
      );
      if (!messageResponse.ok) {
        console.error('Unable to fetch Gmail message', messageId, await messageResponse.text());
        continue;
      }

      const message = await messageResponse.json();
      const headers = message.payload?.headers || [];
      const from = header(headers, 'From').toLowerCase();
      const subject = header(headers, 'Subject');
      if (!from.includes(singhEmail)) continue;

      const orders = await base44.asServiceRole.entities.Order.filter({ order_number: orderNumber });
      const order = orders[0];
      if (!order) {
        await alertAdmin(base44, `Mr. Singh replied — order ${orderNumber} not found`, `Mr. Singh replied to the Stripe reconnect email, but Richard Campbell's order could not be found. Subject: ${subject}`);
        results.push({ message_id: messageId, recorded: false, clover_created: false, reason: 'Order not found' });
        continue;
      }

      const replyMarker = `[SINGH_REPLY:${messageId}]`;
      if ((order.notes || '').includes(replyMarker)) {
        results.push({ message_id: messageId, skipped: true, reason: 'Reply already processed' });
        continue;
      }

      const receivedAt = new Date().toISOString();
      const replyText = plainText(message.payload).trim().slice(0, 1000);
      await base44.asServiceRole.entities.Order.update(order.id, {
        notes: `${order.notes || ''}\n${replyMarker} Mr. Singh confirmed by email on ${receivedAt}. Subject: ${subject}. Reply: ${replyText || '(no plain text body)'}`.trim(),
      });

      const store = await base44.asServiceRole.entities.Store.get(storeId);
      let stripeReady = false;
      let stripeReason = 'Beverage King has not completed Stripe reconnection';
      if (store?.stripe_connect_account_id && store.stripe_connection_status === 'connected') {
        const stripeResponse = await fetch(`https://api.stripe.com/v1/accounts/${store.stripe_connect_account_id}`, {
          headers: {
            Authorization: `Bearer ${secrets.get('STRIPE_SECRET_KEY')}`,
            'Stripe-Version': '2025-10-29.clover',
          },
        });
        const account = await stripeResponse.json();
        stripeReady = stripeResponse.ok && account.details_submitted && account.charges_enabled && account.payouts_enabled;
        stripeReason = stripeReady ? 'Stripe verified' : 'Stripe account is connected but verification, charges, or payouts are incomplete';
      }

      let cloverClient = null;
      try {
        cloverClient = await getCloverClient(base44, storeId);
      } catch (cloverError) {
        console.warn('Beverage King Clover is not ready:', cloverError.message);
      }
      const cloverReady = Boolean(cloverClient && /beverage king/i.test(cloverClient.merchantName || ''));
      const cloverOrigin = cloverClient?.origin;
      const merchantId = cloverClient?.merchantId;
      const cloverHeaders = cloverClient?.headers;

      if (!stripeReady || !cloverReady) {
        const cloverReason = cloverClient
          ? `Clover credentials belong to ${cloverClient.merchantName || 'another merchant'}, not Beverage King`
          : 'Beverage King Clover authorization is not connected or has expired';
        await alertAdmin(
          base44,
          `Mr. Singh replied — ${orderNumber} is waiting`,
          `Mr. Singh's confirmation was recorded for Richard Campbell's paid order ${orderNumber}.\n\nClover order was not created.\nStripe: ${stripeReason}.\nClover: ${cloverReason}.\n\nNo additional charge was attempted.`,
        );
        results.push({ message_id: messageId, recorded: true, clover_created: false, stripe_ready: stripeReady, clover_ready: cloverReady });
        continue;
      }

      const latestOrder = await base44.asServiceRole.entities.Order.get(order.id);
      if ((latestOrder.notes || '').includes('[CLOVER_ORDER:')) {
        results.push({ message_id: messageId, recorded: true, clover_created: false, reason: 'Clover order already exists' });
        continue;
      }

      // A saved legacy item can now refer to a different product or price.
      // Never submit a stale cart to the retailer's POS automatically.
      const changedItems = [];
      for (const item of latestOrder.items || []) {
        const product = await base44.asServiceRole.entities.Product.get(item.product_id).catch(() => null);
        if (!product || product.store_id !== storeId ||
            product.name?.trim().toLowerCase() !== item.product_name?.trim().toLowerCase() ||
            !Number.isFinite(Number(item.price)) || Number(product.price) !== Number(item.price) ||
            product.in_stock === false) {
          changedItems.push(item.product_name || item.product_id);
        }
      }
      if (changedItems.length) {
        console.warn(`Order ${orderNumber} requires retailer item and price confirmation before Clover submission`);
        results.push({ message_id: messageId, recorded: true, clover_created: false, reason: 'Saved items and prices need retailer confirmation', changed_items: changedItems });
        continue;
      }

      await base44.asServiceRole.entities.Order.update(order.id, {
        notes: `${latestOrder.notes || ''}\n[CLOVER_SUBMISSION_PENDING] ${receivedAt}`.trim(),
      });

      const createResponse = await fetch(`${cloverOrigin}/v3/merchants/${merchantId}/orders`, {
        method: 'POST',
        headers: cloverHeaders,
        body: JSON.stringify({ title: `Alcohol Delivered ${orderNumber}`, note: 'Paid externally. Do not charge again. Verify inventory before fulfillment.' }),
      });
      const cloverOrder = await createResponse.json();
      if (!createResponse.ok) throw new Error(cloverOrder.message || 'Clover order creation failed');

      const lines = [
        ...(order.items || []).flatMap((item) => Array.from({ length: Math.max(1, Math.round(item.quantity || 1)) }, () => ({ name: item.product_name, price: Math.round(item.price * 100) }))),
        { name: 'Delivery Fee', price: Math.round((order.delivery_fee || 0) * 100) },
        { name: 'Service Fee', price: Math.round((order.service_fee || 0) * 100) },
        { name: 'Tax', price: Math.round((order.tax || 0) * 100) },
        { name: 'Driver Tip', price: Math.round((order.tip || 0) * 100) },
      ].filter((line) => line.price > 0);

      for (const line of lines) {
        const lineResponse = await fetch(`${cloverOrigin}/v3/merchants/${merchantId}/orders/${cloverOrder.id}/line_items`, {
          method: 'POST', headers: cloverHeaders, body: JSON.stringify(line),
        });
        if (!lineResponse.ok) throw new Error(`Clover line item failed: ${await lineResponse.text()}`);
      }

      const completedOrder = await base44.asServiceRole.entities.Order.get(order.id);
      await base44.asServiceRole.entities.Order.update(order.id, {
        notes: `${completedOrder.notes || ''}\n[CLOVER_ORDER:${cloverOrder.id}] Created for retailer fulfillment; no Clover payment created.`.trim(),
      });
      await alertAdmin(base44, `Richard's order sent to Beverage King Clover`, `Mr. Singh's confirmation was recorded and order ${orderNumber} was created in Beverage King's Clover account. No second payment was created.`);
      results.push({ message_id: messageId, recorded: true, clover_created: true, clover_order_id: cloverOrder.id });
    }

    return Response.json({ success: true, results });
  } catch (error) {
    console.error('processSinghStripeReply error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}