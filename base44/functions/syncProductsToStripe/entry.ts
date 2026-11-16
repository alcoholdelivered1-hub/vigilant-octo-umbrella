import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { secrets } from 'base44:runtime';

const STRIPE_API = 'https://api.stripe.com/v1';
const STRIPE_VERSION = '2025-10-29.clover';
const BATCH_SIZE = 6;
const PAGE_SIZE = 100;

const TARGET_STORE_NAMES = ['BEVERAGE KING', 'Woodlands Fine Wine & Spirits'];

function stripeHeaders(idempotencyKey) {
  const headers = {
    'Authorization': `Bearer ${secrets.get('STRIPE_SECRET_KEY')}`,
    'Stripe-Version': STRIPE_VERSION,
  };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  return headers;
}

async function createStripeProduct(product, storeName) {
  const params = new URLSearchParams();
  params.set('name', product.name);
  params.set('active', String(!!product.in_stock));
  params.set('description', `${product.category || 'uncategorized'} - ${storeName}`);
  if (product.image_url) params.set('images[0]', product.image_url);
  params.set('metadata[base44_app_id]', process.env.BASE44_APP_ID || '');
  params.set('metadata[store_name]', storeName);
  params.set('metadata[product_id]', product.id);
  if (product.upc) params.set('metadata[upc]', product.upc);
  if (product.sku) params.set('metadata[sku]', product.sku);

  const res = await fetch(`${STRIPE_API}/products`, {
    method: 'POST',
    headers: { ...stripeHeaders(crypto.randomUUID()), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Stripe product create failed for "${product.name}": ${err.error?.message || res.status}`);
  }
  return res.json();
}

async function createStripePrice(stripeProductId, product) {
  const amountCents = Math.round((product.price || 0) * 100);
  const params = new URLSearchParams();
  params.set('product', stripeProductId);
  params.set('unit_amount', String(amountCents));
  params.set('currency', 'usd');
  params.set('metadata[base44_app_id]', process.env.BASE44_APP_ID || '');

  const res = await fetch(`${STRIPE_API}/prices`, {
    method: 'POST',
    headers: { ...stripeHeaders(crypto.randomUUID()), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Stripe price create failed for product ${stripeProductId}: ${err.error?.message || res.status}`);
  }
  return res.json();
}

async function syncProduct(product, storeName, base44) {
  const stripeProduct = await createStripeProduct(product, storeName);
  const stripePrice = await createStripePrice(stripeProduct.id, product);
  await base44.entities.Product.update(product.id, {
    external_id: stripeProduct.id,
    sku: stripePrice.id,
  });
  return { productId: stripeProduct.id, priceId: stripePrice.id };
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const storeName = body.store_name;
    const limit = Math.min(body.limit || 0, 500);

    const stores = await base44.entities.Store.filter({}, { limit: 100 });
    let targetStores = stores.items.filter(s => TARGET_STORE_NAMES.some(n => (s.name || '').toLowerCase().includes(n.toLowerCase())));
    if (storeName) {
      targetStores = targetStores.filter(s => (s.name || '').toLowerCase().includes(storeName.toLowerCase()));
    }

    const results = [];
    for (const store of targetStores) {
      let cursor = undefined;
      let synced = 0;
      let failed = 0;
      let batch = [];

      while (true) {
        const options = { limit: PAGE_SIZE, sort: 'name' };
        if (cursor) options.cursor = cursor;
        const page = await base44.entities.Product.filter({ store_id: store.id }, options);
        const items = page.items || [];
        if (items.length === 0) break;

        for (const product of items) {
          if (limit && synced >= limit) break;
          batch.push(product);
          if (batch.length >= BATCH_SIZE) {
            const settled = await Promise.allSettled(batch.map(p => syncProduct(p, store.name, base44)));
            for (const s of settled) {
              if (s.status === 'fulfilled') synced++;
              else { failed++; console.error('Sync error:', s.reason?.message); }
            }
            batch = [];
          }
        }

        if (limit && synced >= limit) break;
        if (!page.has_more) break;
        cursor = page.next_cursor;
      }

      if (batch.length > 0) {
        const settled = await Promise.allSettled(batch.map(p => syncProduct(p, store.name, base44)));
        for (const s of settled) {
          if (s.status === 'fulfilled') synced++;
          else { failed++; console.error('Sync error:', s.reason?.message); }
        }
      }

      results.push({ store: store.name, storeId: store.id, synced, failed });
    }

    return Response.json({ results, totalSynced: results.reduce((a, r) => a + r.synced, 0) });
  } catch (error) {
    console.error('syncProductsToStripe error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}