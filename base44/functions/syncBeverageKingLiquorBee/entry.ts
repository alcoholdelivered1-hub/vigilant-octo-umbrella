import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { secrets } from 'base44:runtime';
import { assertAdmin } from '../../shared/authGuard.ts';

const storeId = '6a32d14d09b760f592dbf19e';

const CATEGORY_MAP = {
  'vodka': 'spirits', 'whiskey': 'spirits', 'bourbon': 'spirits', 'cognac': 'spirits',
  'brandy': 'spirits', 'tequila': 'spirits', 'rum': 'spirits', 'liqueur': 'spirits',
  'gin': 'spirits', 'spirit': 'spirits', 'spirits': 'spirits',
  'beer': 'beer', 'cider': 'beer', 'seltzer': 'beer', 'rtd': 'beer', 'malt': 'beer',
  'wine': 'wine', 'sparkling': 'wine', 'champagne': 'wine', 'rose': 'wine',
  'mixer': 'mixers', 'mixers': 'mixers', 'soda': 'mixers',
  'accessory': 'accessories', 'accessories': 'accessories',
};

export default async function(req) {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const base44 = createClientFromRequest(req);
    const { authorized, response } = await assertAdmin(base44);
    if (!authorized) return response;

    const apiBase = (secrets.get('LIQUOR_BEE_API_URL') || '').replace(/\/+$/, '');
    if (!apiBase) {
      return Response.json({ error: 'LIQUOR_BEE_API_URL secret is not configured.' }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'sync';
    const token = secrets.get('LIQUOR_BEE_API_KEY');
    if (!token) {
      return Response.json({ error: 'LIQUOR_BEE_API_KEY secret is not configured.' }, { status: 500 });
    }

    if (action === 'test') {
      const testRes = await fetch(`${apiBase}/products?limit=1`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(10000),
      });
      return Response.json({
        url: `${apiBase}/products`,
        status: testRes.status,
        ok: testRes.ok,
        content_type: testRes.headers.get('content-type'),
      });
    }

    // Fetch all products from Liquor Bee
    const productsRes = await fetch(`${apiBase}/products?limit=5000`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(30000),
    });

    if (!productsRes.ok) {
      const errText = await productsRes.text().catch(() => '');
      return Response.json({
        error: `Liquor Bee API returned ${productsRes.status}: ${errText.slice(0, 200)}`,
      }, { status: 502 });
    }

    const contentType = productsRes.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const raw = await productsRes.text().catch(() => '');
      return Response.json({
        error: `Liquor Bee API did not return JSON (content-type: ${contentType}). Raw response: ${raw.slice(0, 300)}`,
      }, { status: 502 });
    }

    const data = await productsRes.json();
    const items = Array.isArray(data) ? data : (data.products || data.items || data.data || []);
    if (!Array.isArray(items) || items.length === 0) {
      return Response.json({ error: 'Liquor Bee API returned no products. Confirm the API URL and API key.' }, { status: 404 });
    }

    // Load existing products for this store
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
        if (existingMap[key].external_id !== (item.id || '')) changes.external_id = item.id || existingMap[key].external_id;
        if (Object.keys(changes).length > 1) {
          await base44.asServiceRole.entities.Product.update(existingMap[key].id, changes);
          updated++;
        } else { skipped++; }
      } else {
        const newProduct = {
          name,
          brand,
          category,
          price,
          store_id: storeId,
          in_stock: inStock,
          inventory_source: 'liquor_bee',
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

    const summary = { source: 'liquor_bee', api_base: apiBase, items_received: items.length, created, updated, skipped };
    console.log('Liquor Bee sync complete:', summary);
    return Response.json({ success: true, message: `Synced ${created + updated} products from Liquor Bee (${created} new, ${updated} updated, ${skipped} skipped).`, summary });
  } catch (error) {
    console.error('Liquor Bee sync error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}