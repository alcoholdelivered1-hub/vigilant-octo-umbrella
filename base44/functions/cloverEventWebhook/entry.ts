import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';

/**
 * Clover Event Notification Webhook
 *
 * Registers as a single webhook URL in the Clover Developer dashboard.
 * Handles three notification categories:
 *   1. Inventory changes (stock count updates)
 *   2. Price changes (item price edits)
 *   3. Payment events (new orders / payments on the POS)
 *
 * Clover posts notifications in this shape:
 *   { "appId": "...", "merchants": { "MERCHANT_ID": [ { "objectId": "...", "type": "UPDATE", "ts": ... } ] } }
 *
 * Clover only sends the object ID — we fetch full details from the API and
 * determine whether the object is an ITEM (inventory/price) or an ORDER (payment).
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    if (!body.merchants || typeof body.merchants !== 'object') {
      return Response.json({ received: true, ignored: true, reason: 'Unrecognized payload format' });
    }

    const results = [];
    for (const [merchantId, events] of Object.entries(body.merchants)) {
      if (!Array.isArray(events)) continue;

      const cred = (await base44.asServiceRole.entities.StorePosCredential.filter({ merchant_id: merchantId }))[0];
      const apiToken = cred?.api_token || secrets.get('CLOVER_API_TOKEN');

      if (!apiToken) {
        results.push({ merchant_id: merchantId, error: 'No Clover API token configured for this merchant' });
        continue;
      }

      for (const event of events) {
        if (event.type === 'DELETE') {
          results.push({ object_id: event.objectId, action: 'deleted (skipped)' });
          continue;
        }
        const result = await processCloverEvent(base44, merchantId, apiToken, event.objectId, cred);
        results.push(result);
      }
    }

    // Always 200 to Clover so it doesn't retry excessively
    return Response.json({ received: true, results });
  } catch (error) {
    console.error('Clover event webhook error:', error.message);
    return Response.json({ received: true, error: error.message });
  }
}

async function processCloverEvent(base44, merchantId, apiToken, objectId, cred) {
  const baseUrl = `https://api.clover.com/v3/merchants/${merchantId}`;
  const headers = { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' };

  // Try as an ITEM (inventory / price change)
  const itemResp = await fetch(`${baseUrl}/items/${objectId}?expand=categories`, { headers });
  if (itemResp.ok) {
    const item = await itemResp.json();
    let stock = null;
    try {
      const stockResp = await fetch(`${baseUrl}/item_stocks/${objectId}`, { headers });
      if (stockResp.ok) stock = (await stockResp.json()).quantity ?? null;
    } catch (_) { /* stock endpoint optional */ }
    await notifyInventoryOrPriceChange(base44, cred, item, stock);
    return { object_id: objectId, category: 'inventory', name: item.name, stock };
  }

  // Try as an ORDER (payment event)
  const orderResp = await fetch(`${baseUrl}/orders/${objectId}?expand=lineItems,payments`, { headers });
  if (orderResp.ok) {
    const order = await orderResp.json();
    await notifyPaymentEvent(base44, cred, order);
    return { object_id: objectId, category: 'payment', total: order.total };
  }

  return { object_id: objectId, error: 'Object not found as item or order' };
}

async function notifyInventoryOrPriceChange(base44, cred, item, stock) {
  const storeName = cred?.store_name || 'Your store';
  const storeEmail = cred?.store_email;
  const adminEmail = secrets.get('STORE_MANAGER_EMAIL');
  const priceUsd = item.price != null ? `$${(item.price / 100).toFixed(2)}` : 'N/A';
  const stockLabel = stock != null ? `${stock} units` : 'not tracked';

  const subject = `📦 Clover Update — ${item.name || 'Item'} (${storeName})`;
  const bodyText =
    `A Clover inventory/price change was detected for ${storeName}:\n\n` +
    `Item: ${item.name || '(unnamed)'}\n` +
    `Code/SKU: ${item.sku || item.code || 'N/A'}\n` +
    `Price: ${priceUsd}\n` +
    `Stock: ${stockLabel}\n\n` +
    `This is an automated notification from your Alcohol Delivered platform.`;

  await sendNotifications(base44, storeEmail, adminEmail, subject, bodyText);
}

async function notifyPaymentEvent(base44, cred, order) {
  const storeName = cred?.store_name || 'Your store';
  const storeEmail = cred?.store_email;
  const adminEmail = secrets.get('STORE_MANAGER_EMAIL');
  const totalUsd = order.total != null ? `$${(order.total / 100).toFixed(2)}` : 'N/A';
  const paymentStatus = order.payments?.[0]?.result || 'unknown';

  const lineItems = (order.lineItems?.items || [])
    .map((li) => `  • ${li.name || 'Item'} x${li.quantity || 1}`)
    .join('\n');

  const subject = `💰 Clover Payment — ${totalUsd} (${storeName})`;
  const bodyText =
    `A new Clover payment was recorded for ${storeName}:\n\n` +
    `Order ID: ${order.id || 'N/A'}\n` +
    `Total: ${totalUsd}\n` +
    `Payment Status: ${paymentStatus}\n` +
    (lineItems ? `Items:\n${lineItems}\n` : '') +
    `\nThis is an automated notification from your Alcohol Delivered platform.`;

  await sendNotifications(base44, storeEmail, adminEmail, subject, bodyText);
}

async function sendNotifications(base44, storeEmail, adminEmail, subject, body) {
  const recipients = [storeEmail, adminEmail].filter(Boolean);
  for (const to of recipients) {
    try {
      await base44.asServiceRole.integrations.Core.SendEmail({ to, subject, body });
    } catch (err) {
      console.error(`Failed to email ${to}:`, err.message);
    }
  }
}