import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

/**
 * Clover Inventory → Stripe Product Sync Webhook
 *
 * Handles TWO payload formats:
 *
 * 1. Real Clover webhook notification:
 *    {
 *      "appId": "...",
 *      "merchants": {
 *        "MERCHANT_ID": [
 *          { "objectId": "ITEM_ID", "type": "UPDATE", "ts": 1537970958000 }
 *        ]
 *      }
 *    }
 *    Clover only sends the item ID — we fetch full item details from the API.
 *
 * 2. Manual test payload (simplified):
 *    { "type": "inventory.item.updated", "data": { "id": "ABC", "name": "...", "price": 799, "stock": 24 } }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // --- Parse real Clover webhook notification ---
    if (body.merchants && typeof body.merchants === 'object') {
      const results = [];
      for (const [merchantId, events] of Object.entries(body.merchants)) {
        if (!Array.isArray(events)) continue;

        // Look up Clover credentials for this merchant
        const cred = (await base44.asServiceRole.entities.StorePosCredential.filter({ merchant_id: merchantId }))[0];
        const apiToken = cred?.api_token || Deno.env.get('CLOVER_API_TOKEN');

        if (!apiToken) {
          console.error(`No API token found for merchant ${merchantId}`);
          results.push({ merchant_id: merchantId, error: 'No API token configured' });
          continue;
        }

        for (const event of events) {
          if (event.type === 'DELETE') {
            results.push({ object_id: event.objectId, action: 'deleted (skipped)' });
            continue;
          }
          // Fetch full item details from Clover, then sync to Stripe
          const syncResult = await fetchAndSyncItem(base44, merchantId, apiToken, event.objectId);
          results.push(syncResult);
        }
      }
      // Clover requires a 200 OK response
      return Response.json({ received: true, results });
    }

    // --- Manual test payload (simplified format for testing) ---
    const eventType = body.type;
    const cloverItem = body.data;

    if (eventType !== 'inventory.item.updated' && eventType !== 'inventory.stock.updated') {
      return Response.json({ received: true, ignored: true, reason: `Unhandled event type: ${eventType}` });
    }

    if (!cloverItem?.id) {
      return Response.json({ error: 'Missing Clover item ID in payload' }, { status: 400 });
    }

    const result = await syncItemToStripe(cloverItem.id, cloverItem.name, cloverItem.price, cloverItem.stock);
    return Response.json({ received: true, ...result });
  } catch (error) {
    console.error('Clover inventory webhook error:', error.message);
    // Return 200 even on error so Clover doesn't retry excessively
    return Response.json({ received: true, error: error.message });
  }
});

/**
 * Fetch full item details (name, price, stock) from Clover API, then sync to Stripe.
 */
async function fetchAndSyncItem(base44, merchantId, apiToken, itemId) {
  try {
    const baseUrl = `https://api.clover.com/v3/merchants/${merchantId}`;
    const headers = {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    };

    // Fetch item details
    const itemResp = await fetch(`${baseUrl}/items/${itemId}?expand=categories`, { headers });
    if (!itemResp.ok) {
      return { object_id: itemId, error: `Clover item fetch failed: ${itemResp.status}` };
    }
    const item = await itemResp.json();

    // Fetch stock count for this item
    let stock = null;
    try {
      const stockResp = await fetch(`${baseUrl}/item_stocks/${itemId}`, { headers });
      if (stockResp.ok) {
        const stockData = await stockResp.json();
        stock = stockData.quantity ?? null;
      }
    } catch (_) { /* stock endpoint optional */ }

    return await syncItemToStripe(itemId, item.name, item.price, stock);
  } catch (err) {
    return { object_id: itemId, error: err.message };
  }
}

/**
 * Sync a single Clover item's price + stock to the matching Stripe product.
 */
async function syncItemToStripe(itemId, itemName, priceCents, stock) {
  console.log(`Clover inventory update: ${itemName || '(unnamed)'} (${itemId})`);

  // Find the matching Stripe product by Clover item ID stored in metadata
  let stripeProduct = null;
  try {
    const searchResult = await stripe.products.search({
      query: `metadata['clover_item_id']:'${itemId}'`,
      limit: 1,
    });
    stripeProduct = searchResult.data[0] || null;
  } catch (searchErr) {
    console.error('Stripe product search failed:', searchErr.message);
  }

  if (!stripeProduct) {
    return { object_id: itemId, synced: false, reason: 'No Stripe product mapped to this Clover item' };
  }

  let priceUpdated = false;
  let stockUpdated = false;

  // --- Sync Pricing ---
  if (priceCents != null) {
    const currentPriceCents = stripeProduct.default_price?.unit_amount ?? null;
    if (priceCents !== currentPriceCents) {
      const newPrice = await stripe.prices.create({
        product: stripeProduct.id,
        unit_amount: priceCents,
        currency: 'usd',
      });
      await stripe.products.update(stripeProduct.id, { default_price: newPrice.id });
      priceUpdated = true;
    }
  }

  // --- Sync Stock / Availability ---
  if (stock != null) {
    const isAvailable = stock > 0;
    if (stripeProduct.active !== isAvailable) {
      await stripe.products.update(stripeProduct.id, {
        active: isAvailable,
        metadata: {
          ...stripeProduct.metadata,
          current_stock: String(stock),
        },
      });
      stockUpdated = true;
    }
  }

  return {
    object_id: itemId,
    synced: true,
    stripe_product_id: stripeProduct.id,
    price_updated: priceUpdated,
    stock_updated: stockUpdated,
  };
}