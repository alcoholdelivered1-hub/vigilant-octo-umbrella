import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import {
  getLiquorBeeConfig,
  liquorbeeCall,
  extractProducts,
  mapLiquorBeeProduct,
  normalizeStatusLabel,
  readField,
} from '../../shared/liquorbee.ts';

// LiquorBee POS (Partner API) integration layer. Router only: no checkout or UI wiring yet.

const json = (body, status) => Response.json(body, { status });
const ok = (data) => json({ ok: true, status: 200, data, error: null }, 200);
const fail = (status, error) => json({ ok: false, status, data: null, error }, status);

function text(value, max = 200) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function positiveInt(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function merchantIdFrom(payload) {
  return text(payload.merchantId) || text(payload.merchant_id) || text(payload.MerchantId);
}

function requestedId(payload, ...keys) {
  for (const key of keys) {
    const value = text(payload[key]);
    if (value) return value;
  }
  return '';
}

async function loadStore(base44, storeId) {
  if (!storeId) return null;
  return base44.entities.Store.get(storeId).catch((error) => (error.status === 404 ? null : Promise.reject(error)));
}

async function loadOrder(base44, orderId) {
  if (!orderId) return null;
  return base44.entities.Order.get(orderId).catch((error) => (error.status === 404 ? null : Promise.reject(error)));
}

async function resolveMerchantId(base44, payload, store) {
  return merchantIdFrom(payload) || text(store?.liquorbee_merchant_id);
}

async function loadStoreProducts(base44, storeId) {
  const found = new Map();
  let cursor;
  for (let page = 0; page < 20; page += 1) {
    const result = await base44.entities.Product.filter({ store_id: storeId }, { limit: 500, cursor });
    const rows = Array.isArray(result) ? result : result.items || [];
    for (const row of rows) {
      if (row.external_id) found.set(String(row.external_id), row);
    }
    if (Array.isArray(result) || !result.has_more || !result.next_cursor) break;
    cursor = result.next_cursor;
  }
  return found;
}

async function runBatches(rows, size, operation) {
  for (let index = 0; index < rows.length; index += size) {
    await operation(rows.slice(index, index + size));
  }
}

// ---------- A) Pull the LiquorBee catalog into Product rows ----------

async function syncProducts(base44, config, payload) {
  const storeId = text(payload.storeId) || text(payload.store_id);
  if (!storeId) return fail(400, 'storeId is required');

  const store = await loadStore(base44, storeId);
  if (!store) return fail(404, 'Store not found');

  const merchantId = await resolveMerchantId(base44, payload, store);
  if (!merchantId) return fail(400, 'No LiquorBee merchant ID: set Store.liquorbee_merchant_id or pass merchantId');

  const feed = await liquorbeeCall(config, { path: '/api/partner/products', merchantId });
  if (!feed.ok) return json(feed, 200);

  const { items, pagination } = extractProducts(feed.data);
  const existing = await loadStoreProducts(base44, storeId);
  const toCreate = [];
  const toUpdate = [];
  const skippedSamples = [];
  let skipped = 0;

  for (const item of items) {
    const mapped = mapLiquorBeeProduct(item, storeId);
    if (!mapped.record) {
      skipped += 1;
      if (skippedSamples.length < 10) skippedSamples.push(mapped.error);
      continue;
    }

    const row = existing.get(mapped.record.external_id);
    if (!row) {
      toCreate.push(mapped.record);
      continue;
    }

    // Upsert by store_id + external_id: rewrites the display name and category so rows
    // synced before the naming fix are corrected. Price and stock handling is unchanged.
    const { category, name, ...rest } = mapped.record;
    toUpdate.push({ id: row.id, ...rest, name, category });
  }

  await runBatches(toCreate, 100, (batch) => base44.entities.Product.bulkCreate(batch));
  await runBatches(toUpdate, 100, (batch) => base44.entities.Product.bulkUpdate(batch));

  const feedIds = new Set(items.map((item) => String(readField(item, 'itemId', 'ItemId', 'id', 'Id') || '')).filter(Boolean));
  const missingFromFeed = [...existing.values()].filter(
    (row) => row.inventory_source === 'liquor_bee' && !feedIds.has(String(row.external_id))
  ).length;

  const data = {
    store_id: storeId,
    merchant_id: merchantId,
    created: toCreate.length,
    updated: toUpdate.length,
    skipped,
    total: items.length,
    missing_from_feed: missingFromFeed,
    skipped_samples: skippedSamples,
    pagination,
  };

  return json({ ok: true, status: 200, data, error: null, created: data.created, updated: data.updated, skipped, total: data.total }, 200);
}

// ---------- B) Push an app order to LiquorBee ----------

async function buildOrderLines(base44, order) {
  const items = Array.isArray(order.items) ? order.items : [];
  const productIds = [...new Set(items.map((item) => text(item.product_id)).filter(Boolean))];

  const products = new Map();
  if (productIds.length > 0) {
    const result = await base44.entities.Product.filter({ id: { $in: productIds } }, { limit: 200 });
    const rows = Array.isArray(result) ? result : result.items || [];
    for (const row of rows) products.set(row.id, row);
  }

  const lines = [];
  const skipped = [];
  for (const item of items) {
    const product = item.product_id ? products.get(item.product_id) : null;
    const externalId = text(product?.external_id);
    if (!externalId) {
      skipped.push({
        product_name: text(item.product_name) || text(item.product_id) || 'Unknown item',
        reason: 'no LiquorBee item id',
      });
      continue;
    }
    lines.push({
      ItemId: externalId,
      SkuNumber: text(product?.sku),
      Name: text(item.product_name) || text(product?.name),
      SellingPrice: Number(item.price) || 0,
      Quantity: Number(item.quantity) || 0,
      QuantityShipped: 0,
      Deposit: 0,
    });
  }

  return { lines, skipped };
}

function buildOrderPayload(order, store, lines) {
  const nameParts = String(order.customer_name || '').trim().split(/\s+/).filter(Boolean);
  const firstName = nameParts.shift() || '';
  const lastName = nameParts.join(' ');
  const saleDate = order.created_date ? new Date(order.created_date) : new Date();

  return {
    OrderId: order.order_number || order.id,
    Status: 'OPEN',
    SaleDate: saleDate.toISOString(),
    TenderAmount: Number(order.total) || 0,
    TaxAmount: Number(order.tax) || 0,
    Email: order.customer_email || '',
    Addresses: [
      {
        AddressType: 'Billing',
        AddressFirstName: firstName,
        AddressLastName: lastName,
        Address1: order.delivery_address || '',
        City: store?.city || '',
        State: store?.state || 'AR',
        Zip: store?.zip_code || '',
        Phone: order.customer_phone || '',
      },
    ],
    Items: lines,
  };
}

function externalOrderId(data) {
  if (!data || typeof data !== 'object') return '';
  const nested = readField(data, 'order', 'Order');
  const source = nested && typeof nested === 'object' ? nested : data;
  return text(readField(source, 'orderId', 'OrderId', 'externalOrderId', 'ExternalOrderId', 'id', 'Id'));
}

async function submitOrder(base44, config, payload) {
  // Raw pass-through when the caller already prepared a LiquorBee order body.
  if (payload.body && typeof payload.body === 'object') {
    const merchantId = merchantIdFrom(payload);
    if (!merchantId) return fail(400, 'merchantId is required');
    return json(await liquorbeeCall(config, { path: '/api/partner/orders', method: 'POST', merchantId, body: payload.body }), 200);
  }

  const orderId = text(payload.orderId);
  if (!orderId) return fail(400, 'orderId is required');

  const order = await loadOrder(base44, orderId);
  if (!order) return fail(404, 'Order not found');

  const store = await loadStore(base44, order.store_id);
  const merchantId = await resolveMerchantId(base44, payload, store);
  if (!merchantId) return fail(400, 'No LiquorBee merchant ID for this order\'s store');

  const { lines, skipped } = await buildOrderLines(base44, order);
  if (lines.length === 0) {
    const error = `No order lines carry a LiquorBee item id (${skipped.length} skipped)`;
    await base44.entities.Order.update(order.id, { liquorbee_last_error: error });
    return json({ ok: false, status: 422, data: { skipped_lines: skipped }, error }, 200);
  }

  const orderBody = buildOrderPayload(order, store, lines);
  const result = await liquorbeeCall(config, { path: '/api/partner/orders', method: 'POST', merchantId, body: orderBody });
  const now = new Date().toISOString();

  if (result.ok) {
    const savedId = externalOrderId(result.data) || orderBody.OrderId;
    await base44.entities.Order.update(order.id, {
      liquorbee_order_id: savedId,
      liquorbee_status: 'Open',
      liquorbee_synced_at: now,
      liquorbee_last_error: null,
    });
    return json({
      ok: true,
      status: result.status,
      data: { order_id: order.id, liquorbee_order_id: savedId, skipped_lines: skipped, response: result.data },
      error: null,
    }, 200);
  }

  // 409: LiquorBee already has this order, so update its lines instead of duplicating it.
  if (result.status === 409) {
    const existingId = text(order.liquorbee_order_id) || orderBody.OrderId;
    const patched = await liquorbeeCall(config, {
      path: `/api/partner/orders/${encodeURIComponent(existingId)}`,
      method: 'PATCH',
      merchantId,
      body: { Items: orderBody.Items },
    });

    if (patched.ok) {
      await base44.entities.Order.update(order.id, {
        liquorbee_order_id: existingId,
        liquorbee_status: 'Open',
        liquorbee_synced_at: now,
        liquorbee_last_error: null,
      });
    } else {
      await base44.entities.Order.update(order.id, {
        liquorbee_last_error: patched.error || 'LiquorBee order update failed',
      });
    }

    return json({
      ok: patched.ok,
      status: patched.status,
      data: { order_id: order.id, liquorbee_order_id: existingId, conflict: true, skipped_lines: skipped, response: patched.data },
      error: patched.ok ? null : patched.error,
    }, 200);
  }

  const error = result.error || 'LiquorBee order submission failed';
  await base44.entities.Order.update(order.id, { liquorbee_last_error: error });
  return json({ ok: false, status: result.status, data: { order_id: order.id, skipped_lines: skipped, response: result.data }, error }, 200);
}

// ---------- C) Mirror LiquorBee's status onto the order ----------

async function syncOrderStatus(base44, config, payload) {
  const orderId = text(payload.orderId);
  if (!orderId) return fail(400, 'orderId is required');

  const order = await loadOrder(base44, orderId);
  if (!order) return fail(404, 'Order not found');

  const liquorbeeOrderId = text(order.liquorbee_order_id) || requestedId(payload, 'liquorbeeOrderId', 'externalOrderId');
  if (!liquorbeeOrderId) return fail(400, 'Order has no LiquorBee order id');

  const store = await loadStore(base44, order.store_id);
  const merchantId = await resolveMerchantId(base44, payload, store);
  if (!merchantId) return fail(400, 'No LiquorBee merchant ID for this order\'s store');

  const result = await liquorbeeCall(config, {
    path: `/api/partner/orders/${encodeURIComponent(liquorbeeOrderId)}`,
    merchantId,
  });
  if (!result.ok) return json(result, 200);

  const nested = readField(result.data, 'order', 'Order');
  const source = nested && typeof nested === 'object' ? nested : result.data || {};

  const updates = {
    liquorbee_is_stale: Boolean(readField(source, 'isStale', 'IsStale')),
    liquorbee_pos_modified: Boolean(readField(source, 'posModified', 'PosModified')),
    liquorbee_synced_at: new Date().toISOString(),
  };
  const status = normalizeStatusLabel(readField(source, 'status', 'Status'));
  if (status) updates.liquorbee_status = status;

  // Only the liquorbee_* mirror is written; the app's own delivery status is untouched.
  await base44.entities.Order.update(order.id, updates);

  return ok({ order_id: order.id, liquorbee_order_id: liquorbeeOrderId, ...updates });
}

export default async function (req) {
  try {
    if (req.method !== 'POST') return fail(405, 'Method not allowed');

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((error) => (error.status === 401 ? null : Promise.reject(error)));
    if (!user) return fail(401, 'Unauthorized');
    if (user.role !== 'admin') return fail(403, 'Forbidden');

    const body = await req.json().catch(() => ({}));
    const action = text(body?.action, 60);
    const payload = body?.payload && typeof body.payload === 'object' ? body.payload : {};
    if (!action) return fail(400, 'action is required');

    const resolved = getLiquorBeeConfig();
    if (!resolved.ok) return json({ ok: false, status: 503, data: null, error: resolved.error }, 503);
    const config = resolved.config;

    if (action === 'health') {
      return json(await liquorbeeCall(config, { path: '/api/partner/health', auth: false }), 200);
    }

    if (action === 'merchants') {
      return json(await liquorbeeCall(config, { path: '/api/partner/merchants', merchantId: merchantIdFrom(payload) }), 200);
    }

    if (action === 'products') {
      const query = {};
      const page = positiveInt(payload.page);
      const pageSize = positiveInt(payload.pageSize);
      if (page) query.page = page;
      if (pageSize) query.pageSize = pageSize;
      return json(await liquorbeeCall(config, {
        path: '/api/partner/products',
        merchantId: merchantIdFrom(payload),
        query,
      }), 200);
    }

    if (action === 'getOrders') {
      const query = {};
      const page = positiveInt(payload.page);
      const pageSize = positiveInt(payload.pageSize);
      if (page) query.page = page;
      if (pageSize) query.pageSize = pageSize;
      if (payload.status !== undefined && payload.status !== null && payload.status !== '') query.status = payload.status;
      return json(await liquorbeeCall(config, {
        path: '/api/partner/orders',
        merchantId: merchantIdFrom(payload),
        query,
      }), 200);
    }

    if (action === 'getOrder') {
      const orderId = requestedId(payload, 'orderId', 'liquorbeeOrderId');
      if (!orderId) return fail(400, 'orderId is required');
      return json(await liquorbeeCall(config, {
        path: `/api/partner/orders/${encodeURIComponent(orderId)}`,
        merchantId: merchantIdFrom(payload),
      }), 200);
    }

    if (action === 'updateOrder') {
      const orderId = requestedId(payload, 'liquorbeeOrderId', 'orderId');
      if (!orderId) return fail(400, 'orderId is required');
      const merchantId = merchantIdFrom(payload);
      if (!merchantId) return fail(400, 'merchantId is required');
      const updateBody = payload.body && typeof payload.body === 'object'
        ? payload.body
        : Array.isArray(payload.items) ? { Items: payload.items } : undefined;
      if (!updateBody) return fail(400, 'body or items is required');
      return json(await liquorbeeCall(config, {
        path: `/api/partner/orders/${encodeURIComponent(orderId)}`,
        method: 'PATCH',
        merchantId,
        body: updateBody,
      }), 200);
    }

    if (action === 'cancelOrder') {
      const orderId = requestedId(payload, 'liquorbeeOrderId', 'orderId');
      if (!orderId) return fail(400, 'orderId is required');
      const merchantId = merchantIdFrom(payload);
      if (!merchantId) return fail(400, 'merchantId is required');
      return json(await liquorbeeCall(config, {
        path: `/api/partner/orders/${encodeURIComponent(orderId)}`,
        method: 'DELETE',
        merchantId,
      }), 200);
    }

    if (action === 'syncProducts') return await syncProducts(base44, config, payload);
    if (action === 'submitOrder') return await submitOrder(base44, config, payload);
    if (action === 'syncOrderStatus') return await syncOrderStatus(base44, config, payload);

    return fail(400, `Unknown action: ${action}`);
  } catch (error) {
    console.error('LiquorBee API error:', error.message);
    return json({ ok: false, status: 500, data: null, error: error.message }, 500);
  }
}