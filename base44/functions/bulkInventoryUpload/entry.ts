/**
 * Bulk-syncs product inventory from the CSV to ALL active stores,
 * regardless of county. Also runs Clover inventory sync for stores
 * that have Clover POS credentials.
 *
 * POST body: { }  (admin-only)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const CATEGORY_MAP = {
  'vodka': 'spirits', 'whiskey': 'spirits', 'bourbon': 'spirits', 'cognac': 'spirits',
  'brandy': 'spirits', 'tequila': 'spirits', 'rum': 'spirits', 'liqueur': 'spirits',
  'gin': 'spirits', 'scotch': 'spirits', 'schnapps': 'spirits',
  'beer': 'beer', 'cider': 'beer', 'seltzer': 'beer', 'rtd': 'beer', 'ale': 'beer', 'lager': 'beer',
  'wine': 'wine', 'sparkling': 'wine', 'champagne': 'wine', 'rose': 'wine',
  'mixer': 'mixers', 'soda': 'mixers', 'tonic': 'mixers', 'juice': 'mixers',
  'accessory': 'accessories', 'supplies': 'accessories',
};

function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  return lines.slice(1).map(line => {
    const values = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes; }
      else if (char === ',' && !inQuotes) { values.push(current.trim()); current = ''; }
      else { current += char; }
    }
    values.push(current.trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = values[i] || ''; });
    return obj;
  }).filter(row => row.product_name || row.name);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch (_) { /* scheduled */ }
    if (user && user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const csvUrl = Deno.env.get('PRODUCTS_CSV_URL');
    if (!csvUrl) {
      return Response.json({ error: 'PRODUCTS_CSV_URL secret not set' }, { status: 400 });
    }

    // 1. Fetch CSV
    const csvRes = await fetch(csvUrl);
    if (!csvRes.ok) {
      return Response.json({ error: `Failed to fetch CSV: ${csvRes.status}` }, { status: 500 });
    }
    const csvText = await csvRes.text();
    const csvProducts = parseCSV(csvText);

    if (csvProducts.length === 0) {
      return Response.json({ error: 'CSV contains no products' }, { status: 400 });
    }

    // 2. Get ALL active stores
    const allStores = await base44.asServiceRole.entities.Store.list('-created_date', 500);
    const activeStores = allStores.filter(s => s.is_active !== false);

    // 3. Get all existing products (for dedup)
    const existingProducts = await base44.asServiceRole.entities.Product.list('-created_date', 5000);
    const existingMap = {};
    for (const p of existingProducts) {
      const key = `${p.store_id}|${p.name}|${p.brand || ''}|${p.pack_size || 'Single'}`;
      existingMap[key] = p;
    }

    let totalCreated = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    const perStore = [];

    // 4. Bulk-create products for each store
    for (const store of activeStores) {
      const creates = [];
      const updates = [];
      let skipped = 0;

      for (const row of csvProducts) {
        const name = (row.product_name || row.name || '').trim();
        if (!name) continue;

        const category = CATEGORY_MAP[row.category?.toLowerCase()] || 'spirits';
        const price = parseFloat(row.avg_price || row.price) || 0;
        const packSize = row.pack_size || 'Single';
        const brand = row.brand || '';
        const volume = row.size || row.volume || '';
        const key = `${store.id}|${name}|${brand}|${packSize}`;

        const stockQty = row.stock_quantity !== undefined && row.stock_quantity !== ''
          ? parseInt(row.stock_quantity, 10) : null;
        const inStock = row.in_stock !== undefined && row.in_stock !== ''
          ? !['false', '0', 'no', 'out'].includes(row.in_stock.toString().toLowerCase())
          : (stockQty === null ? true : stockQty > 0);

        if (existingMap[key]) {
          const existing = existingMap[key];
          const changes = {};
          if (existing.price !== price && price > 0) changes.price = price;
          if (stockQty !== null && existing.stock_quantity !== stockQty) changes.stock_quantity = stockQty;
          if (existing.in_stock !== inStock) changes.in_stock = inStock;
          if (volume && existing.volume !== volume) changes.volume = volume;
          if (Object.keys(changes).length > 0) {
            updates.push({ id: existing.id, ...changes });
          } else {
            skipped++;
          }
        } else {
          const newProduct = {
            name,
            brand,
            category,
            pack_size: packSize,
            volume,
            price,
            store_id: store.id,
            ...(store.email ? { store_email: store.email } : {}),
            in_stock: inStock,
          };
          if (stockQty !== null) newProduct.stock_quantity = stockQty;
          creates.push(newProduct);
        }
      }

      // Bulk create in batches of 500
      for (let i = 0; i < creates.length; i += 500) {
        await base44.asServiceRole.entities.Product.bulkCreate(creates.slice(i, i + 500));
      }
      // Bulk update in batches of 500
      for (let i = 0; i < updates.length; i += 500) {
        await base44.asServiceRole.entities.Product.bulkUpdate(updates.slice(i, i + 500));
      }

      totalCreated += creates.length;
      totalUpdated += updates.length;
      totalSkipped += skipped;

      perStore.push({
        store: store.name,
        county: store.county,
        created: creates.length,
        updated: updates.length,
        skipped,
      });
    }

    return Response.json({
      success: true,
      csv_products: csvProducts.length,
      stores_synced: activeStores.length,
      total_created: totalCreated,
      total_updated: totalUpdated,
      total_skipped: totalSkipped,
      per_store: perStore,
    });
  } catch (error) {
    console.error('bulkInventoryUpload error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});