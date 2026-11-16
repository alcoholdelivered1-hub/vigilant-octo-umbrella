import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { secrets } from 'base44:runtime';
import { assertAdmin } from '../../shared/authGuard.ts';
import { getCityHiveConnection, fetchCityHiveProducts, mapCityHiveProduct } from '../../shared/cityHiveConnection.ts';
import { getCloverClient } from '../../shared/cloverConnection.ts';

const BEVERAGE_KING_STORE_ID = '6a32d14d09b760f592dbf19e';

const CATEGORY_MAP = {
  'vodka': 'spirits', 'whiskey': 'spirits', 'bourbon': 'spirits', 'cognac': 'spirits',
  'brandy': 'spirits', 'tequila': 'spirits', 'rum': 'spirits', 'liqueur': 'spirits',
  'gin': 'spirits', 'spirit': 'spirits', 'spirits': 'spirits',
  'beer': 'beer', 'cider': 'beer', 'seltzer': 'beer', 'rtd': 'beer', 'malt': 'beer',
  'wine': 'wine', 'sparkling': 'wine', 'champagne': 'wine', 'rose': 'wine',
  'mixer': 'mixers', 'mixers': 'mixers', 'soda': 'mixers',
  'accessory': 'accessories', 'accessories': 'accessories',
};

async function syncCityHiveStore(base44, storeId) {
  const { connection, apiToken } = await getCityHiveConnection(base44, storeId);
  const products = await fetchCityHiveProducts(apiToken);

  if (!Array.isArray(products) || products.length === 0) {
    await base44.asServiceRole.entities.CityHiveConnection.update(connection.id, {
      last_synced_at: new Date().toISOString(),
      last_sync_count: 0,
      last_sync_error: null,
    });
    return { created: 0, updated: 0, skipped: 0 };
  }

  const existingProducts = await base44.asServiceRole.entities.Product.filter({ store_id: storeId }, '-updated_date', 5000);
  const productMap = new Map();
  for (const p of existingProducts) {
    if (p.external_id) productMap.set(p.external_id, p);
  }

  const toCreate = [];
  const toUpdate = [];
  for (const item of products) {
    const mapped = mapCityHiveProduct(item, storeId);
    if (!mapped.external_id) continue;
    const existing = productMap.get(mapped.external_id);
    if (existing) toUpdate.push({ id: existing.id, ...mapped });
    else toCreate.push(mapped);
  }

  let created = 0, updated = 0;
  for (let i = 0; i < toCreate.length; i += 100) {
    await base44.asServiceRole.entities.Product.bulkCreate(toCreate.slice(i, i + 100));
    created += Math.min(100, toCreate.length - i);
  }
  for (let i = 0; i < toUpdate.length; i += 100) {
    await base44.asServiceRole.entities.Product.bulkUpdate(toUpdate.slice(i, i + 100));
    updated += Math.min(100, toUpdate.length - i);
  }

  await base44.asServiceRole.entities.CityHiveConnection.update(connection.id, {
    last_synced_at: new Date().toISOString(),
    last_sync_count: created + updated,
    last_sync_error: null,
  });

  return { created, updated, skipped: 0 };
}

async function syncLiquorBeeStore(base44, storeId) {
  const apiBase = (secrets.get('LIQUOR_BEE_API_URL') || '').replace(/\/+$/, '');
  const token = secrets.get('LIQUOR_BEE_API_KEY');
  if (!apiBase || !token) throw new Error('Liquor Bee API credentials not configured');

  const productsRes = await fetch(`${apiBase}/products?limit=5000`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(30000),
  });
  if (!productsRes.ok) {
    const errText = await productsRes.text().catch(() => '');
    throw new Error(`Liquor Bee API ${productsRes.status}: ${errText.slice(0, 200)}`);
  }

  const data = await productsRes.json();
  const items = Array.isArray(data) ? data : (data.products || data.items || data.data || []);
  if (!Array.isArray(items) || items.length === 0) return { created: 0, updated: 0, skipped: 0 };

  const existing = await base44.asServiceRole.entities.Product.filter({ store_id: storeId }, '-updated_date', 5000);
  const existingMap = {};
  for (const p of existing) {
    const key = `${p.name?.toLowerCase()}|${(p.brand || '').toLowerCase()}`;
    existingMap[key] = p;
  }

  let created = 0, updated = 0, skipped = 0;
  for (const item of items) {
    const name = item.name || item.product_name || item.title || item.description;
    if (!name) { skipped++; continue; }
    const brand = item.brand || item.vendor || item.supplier || '';
    const category = CATEGORY_MAP[(item.category || item.type || '').toLowerCase()] || 'spirits';
    const price = parseFloat(item.price || item.retail_price || item.unit_price || 0) || 0;
    const stockQty = item.stock_quantity !== undefined && item.stock_quantity !== null
      ? parseInt(item.stock_quantity, 10) : null;
    const inStock = item.in_stock !== undefined
      ? Boolean(item.in_stock)
      : (stockQty === null ? true : stockQty > 0);
    const volume = item.size || item.volume || item.package_size || '';
    const upc = item.upc || item.barcode || item.sku || '';
    const key = `${name.toLowerCase()}|${brand.toLowerCase()}`;

    if (existingMap[key]) {
      const changes = { inventory_source: 'liquor_bee', last_synced_at: new Date().toISOString() };
      if (existingMap[key].price !== price) changes.price = price;
      if (stockQty !== null && existingMap[key].stock_quantity !== stockQty) changes.stock_quantity = stockQty;
      if (existingMap[key].in_stock !== inStock) changes.in_stock = inStock;
      if (volume && existingMap[key].volume !== volume) changes.volume = volume;
      if (upc && existingMap[key].upc !== upc) changes.upc = upc;
      if (Object.keys(changes).length > 1) {
        await base44.asServiceRole.entities.Product.update(existingMap[key].id, changes);
        updated++;
      } else { skipped++; }
    } else {
      const newProduct = {
        name, brand, category, price, store_id: storeId,
        in_stock: inStock, inventory_source: 'liquor_bee',
        last_synced_at: new Date().toISOString(),
      };
      if (volume) newProduct.volume = volume;
      if (upc) newProduct.upc = upc;
      if (item.id) newProduct.external_id = String(item.id);
      if (item.sku) newProduct.sku = item.sku;
      if (stockQty !== null) newProduct.stock_quantity = stockQty;
      await base44.asServiceRole.entities.Product.create(newProduct);
      created++;
    }
  }

  return { created, updated, skipped };
}

async function syncCloverStore(base44, storeId) {
  const cloverClient = await getCloverClient(base44, storeId);
  const { merchantId, headers } = cloverClient;

  const res = await fetch(`https://api.clover.com/v3/merchants/${merchantId}/items?limit=1000`, {
    headers,
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Clover API ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const items = data.items || [];
  if (items.length === 0) return { created: 0, updated: 0, skipped: 0 };

  const existing = await base44.asServiceRole.entities.Product.filter({ store_id: storeId }, '-updated_date', 5000);
  const existingMap = {};
  for (const p of existing) {
    if (p.external_id) existingMap[p.external_id] = p;
  }

  let created = 0, updated = 0, skipped = 0;
  for (const item of items) {
    const name = item.name || item.alternateName || 'Unknown Product';
    if (!name) { skipped++; continue; }
    const price = (item.price || 0) / 100;
    const externalId = String(item.id || '');
    const inStock = !item.hidden;
    const sku = item.sku || item.code || '';

    if (existingMap[externalId]) {
      const changes = { inventory_source: 'clover', last_synced_at: new Date().toISOString() };
      if (existingMap[externalId].price !== price) changes.price = price;
      if (existingMap[externalId].in_stock !== inStock) changes.in_stock = inStock;
      if (sku && existingMap[externalId].sku !== sku) changes.sku = sku;
      if (Object.keys(changes).length > 1) {
        await base44.asServiceRole.entities.Product.update(existingMap[externalId].id, changes);
        updated++;
      } else { skipped++; }
    } else {
      const newProduct = {
        name, category: 'spirits', price, store_id: storeId,
        in_stock: inStock, external_id: externalId,
        inventory_source: 'clover',
        last_synced_at: new Date().toISOString(),
      };
      if (sku) newProduct.sku = sku;
      await base44.asServiceRole.entities.Product.create(newProduct);
      created++;
    }
  }

  return { created, updated, skipped };
}

export default async function(req) {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const base44 = createClientFromRequest(req);
    const { authorized, response } = await assertAdmin(base44);
    if (!authorized) return response;

    const body = await req.json().catch(() => ({}));
    const targetStoreId = body.store_id;

    const stores = await base44.asServiceRole.entities.Store.filter({ is_active: true }, 'name', 500);
    const [cityHiveConnections, cloverConnections] = await Promise.all([
      base44.asServiceRole.entities.CityHiveConnection.filter({ status: 'connected' }),
      base44.asServiceRole.entities.CloverConnection.filter({ status: 'connected' }),
    ]);

    const cityHiveByStore = {};
    for (const c of cityHiveConnections) cityHiveByStore[c.store_id] = c;
    const cloverByStore = {};
    for (const c of cloverConnections) cloverByStore[c.store_id] = c;

    const results = [];

    for (const store of stores) {
      if (targetStoreId && store.id !== targetStoreId) continue;

      const result = {
        store_id: store.id,
        store_name: store.name,
        city: store.city,
        sync_source: null,
        status: 'skipped',
        synced: 0,
        error: null,
      };

      try {
        if (cityHiveByStore[store.id]) {
          result.sync_source = 'cityhive';
          const r = await syncCityHiveStore(base44, store.id);
          result.status = 'synced';
          result.synced = r.created + r.updated;
        } else if (cloverByStore[store.id]) {
          result.sync_source = 'clover';
          const r = await syncCloverStore(base44, store.id);
          result.status = 'synced';
          result.synced = r.created + r.updated;
        } else if (store.id === BEVERAGE_KING_STORE_ID) {
          result.sync_source = 'liquor_bee';
          const r = await syncLiquorBeeStore(base44, store.id);
          result.status = 'synced';
          result.synced = r.created + r.updated;
        } else {
          result.status = 'no_connection';
        }
      } catch (e) {
        result.status = 'error';
        result.error = e.message;
      }

      results.push(result);
    }

    const summary = {
      total_stores: results.length,
      synced: results.filter(r => r.status === 'synced').length,
      errors: results.filter(r => r.status === 'error').length,
      no_connection: results.filter(r => r.status === 'no_connection').length,
      results,
    };

    console.log('Master inventory sync complete:', summary);
    return Response.json({ success: true, summary });
  } catch (error) {
    console.error('Master inventory sync error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}