import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

/**
 * Tags Stripe products with clover_item_id metadata by matching product names
 * between the Clover item catalog and the Stripe product catalog.
 *
 * This is the one-time setup step that links the two systems so that
 * the cloverInventoryWebhook can find the right Stripe product when
 * Clover pushes a price or stock update.
 *
 * Once tagged, future Clover inventory webhooks will automatically
 * update the correct Stripe product.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch (_) {}
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });
    }

    // Read Clover credentials from the StorePosCredential record (source of truth),
    // falling back to env secrets if no credential record exists.
    const BEVERAGE_KING_STORE_ID = '6a32d14d09b760f592dbf19e';
    const cred = (await base44.asServiceRole.entities.StorePosCredential.filter({ store_id: BEVERAGE_KING_STORE_ID }))[0];
    const apiToken = cred?.api_token || Deno.env.get('CLOVER_API_TOKEN');
    const merchantId = cred?.merchant_id || Deno.env.get('CLOVER_MERCHANT_ID');

    if (!apiToken || !merchantId) {
      return Response.json({
        error: 'Clover credentials not configured. Set CLOVER_API_TOKEN and CLOVER_MERCHANT_ID secrets.',
      }, { status: 500 });
    }

    // --- 1. Fetch all items from Clover ---
    const baseUrl = `https://api.clover.com/v3/merchants/${merchantId}/items`;
    let cloverItems = [];
    let offset = 0;
    const limit = 200;

    while (true) {
      const url = `${baseUrl}?limit=${limit}&offset=${offset}`;
      const resp = await fetch(url, {
        headers: { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
      });

      if (!resp.ok) {
        const text = await resp.text();
        if (resp.status === 401) {
          return Response.json({
            error: 'Clover API token is invalid or expired. Generate a new token in the Clover Developer Dashboard and update the CLOVER_API_TOKEN secret.',
            clover_status: 401,
          }, { status: 401 });
        }
        return Response.json({ error: `Clover API error: ${resp.status}`, details: text }, { status: 502 });
      }

      const data = await resp.json();
      const items = data.elements || [];
      cloverItems = cloverItems.concat(items);
      if (items.length < limit) break;
      offset += limit;
      if (offset > 2000) break;
    }

    console.log(`Fetched ${cloverItems.length} items from Clover`);

    // --- 2. Fetch all Stripe products ---
    let stripeProducts = [];
    let hasMore = true;
    let startingAfter = null;

    while (hasMore) {
      const params = { limit: 100, active: true, expand: ['data.default_price'] };
      if (startingAfter) params.starting_after = startingAfter;
      const batch = await stripe.products.list(params);
      stripeProducts = stripeProducts.concat(batch.data);
      hasMore = batch.has_more;
      if (batch.data.length > 0) startingAfter = batch.data[batch.data.length - 1].id;
      if (!hasMore || batch.data.length === 0) break;
    }

    console.log(`Fetched ${stripeProducts.length} active products from Stripe`);

    // --- 3. Match by normalized name and tag ---
    const normalize = (s) => (s || '').toLowerCase().trim().replace(/\s+/g, ' ');

    const cloverByName = {};
    cloverItems.forEach(item => {
      const name = normalize(item.name);
      if (name) cloverByName[name] = item;
    });

    let tagged = 0;
    let alreadyTagged = 0;
    let noMatch = 0;
    const results = [];

    for (const sp of stripeProducts) {
      const stripeName = normalize(sp.name);

      // Skip if already tagged
      if (sp.metadata?.clover_item_id) {
        alreadyTagged++;
        results.push({ stripe_id: sp.id, name: sp.name, status: 'already_tagged', clover_item_id: sp.metadata.clover_item_id });
        continue;
      }

      const match = cloverByName[stripeName];

      if (match) {
        // Tag the Stripe product with the Clover item ID
        await stripe.products.update(sp.id, {
          metadata: {
            ...sp.metadata,
            clover_item_id: match.id,
            current_stock: String(match.stockCount ?? ''),
          },
        });
        tagged++;
        results.push({ stripe_id: sp.id, name: sp.name, status: 'tagged', clover_item_id: match.id });
        console.log(`Tagged "${sp.name}" → clover_item_id=${match.id}`);
      } else {
        noMatch++;
        results.push({ stripe_id: sp.id, name: sp.name, status: 'no_clover_match' });
      }
    }

    return Response.json({
      success: true,
      clover_items_fetched: cloverItems.length,
      stripe_products_fetched: stripeProducts.length,
      tagged,
      already_tagged,
      no_match: noMatch,
      results,
    });
  } catch (error) {
    console.error('tagStripeProductsFromClover error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});