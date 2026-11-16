import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { assertAdmin } from '../../shared/authGuard.ts';

// Category mapping from CSV categories to our entity enum
const CATEGORY_MAP = {
  'vodka': 'spirits', 'whiskey': 'spirits', 'bourbon': 'spirits', 'cognac': 'spirits',
  'brandy': 'spirits', 'tequila': 'spirits', 'rum': 'spirits', 'liqueur': 'spirits',
  'beer': 'beer', 'cider': 'beer', 'seltzer': 'beer', 'rtd': 'beer',
  'wine': 'wine', 'sparkling': 'wine', 'champagne': 'wine',
};

function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  return lines.slice(1).map(line => {
    // Handle commas inside quoted fields
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
  }).filter(row => row.product_name);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { authorized, response } = await assertAdmin(base44);
    if (!authorized) return response;

    const csvUrl = Deno.env.get('PRODUCTS_CSV_URL');
    if (!csvUrl) {
      return Response.json({ error: 'PRODUCTS_CSV_URL secret not set' }, { status: 400 });
    }

    // Validate that the secret is actually a URL (not a stray password or token)
    let parsedUrl;
    try {
      parsedUrl = new URL(csvUrl);
    } catch {
      return Response.json({ error: 'PRODUCTS_CSV_URL is not a valid URL. Please update it in Settings → Environment Variables to point to your product CSV file.' }, { status: 400 });
    }
    if (!parsedUrl.protocol.startsWith('http')) {
      return Response.json({ error: 'PRODUCTS_CSV_URL must be an http or https URL.' }, { status: 400 });
    }

    // 1. Fetch CSV
    const csvRes = await fetch(csvUrl);
    if (!csvRes.ok) {
      return Response.json({ error: `Failed to fetch CSV: ${csvRes.status}` }, { status: 500 });
    }
    const csvText = await csvRes.text();
    const products = parseCSV(csvText);

    // 2. Get all stores in Jefferson County
    const stores = await base44.asServiceRole.entities.Store.filter({ county: 'Jefferson', is_active: true });
    if (!stores.length) {
      return Response.json({ error: 'No active stores found' }, { status: 404 });
    }

    // 3. Get existing products for all stores
    const existingProducts = await base44.asServiceRole.entities.Product.list();

    // Build a lookup: "store_id|product_name|brand" -> product record
    const existingMap = {};
    for (const p of existingProducts) {
      const key = `${p.store_id}|${p.name}|${p.brand}`;
      existingMap[key] = p;
    }

    let created = 0, updated = 0, skipped = 0;

    for (const store of stores) {
      for (const row of products) {
        const category = CATEGORY_MAP[row.category?.toLowerCase()] || 'spirits';
        const price = parseFloat(row.avg_price) || 0;
        const key = `${store.id}|${row.product_name}|${row.brand}`;

        const stockQty = row.stock_quantity !== undefined && row.stock_quantity !== ''
          ? parseInt(row.stock_quantity, 10)
          : null;
        const inStock = row.in_stock !== undefined && row.in_stock !== ''
          ? !['false', '0', 'no', 'out'].includes(row.in_stock.toString().toLowerCase())
          : (stockQty === null ? true : stockQty > 0);

        if (existingMap[key]) {
          const existing = existingMap[key];
          const changes = {};
          if (existing.price !== price) changes.price = price;
          if (stockQty !== null && existing.stock_quantity !== stockQty) changes.stock_quantity = stockQty;
          if (existing.in_stock !== inStock) changes.in_stock = inStock;
          if (existing.volume !== row.size && row.size) changes.volume = row.size;
          if (Object.keys(changes).length > 0) {
            await base44.asServiceRole.entities.Product.update(existing.id, changes);
            updated++;
          } else {
            skipped++;
          }
        } else {
          const newProduct = {
            name: row.product_name,
            brand: row.brand,
            category,
            volume: row.size,
            price,
            store_id: store.id,
            in_stock: inStock,
          };
          if (stockQty !== null) newProduct.stock_quantity = stockQty;
          await base44.asServiceRole.entities.Product.create(newProduct);
          created++;
        }
      }
    }

    const summary = { stores: stores.length, products_in_csv: products.length, created, updated, skipped };
    console.log('Sync complete:', summary);
    return Response.json({ success: true, summary });

  } catch (error) {
    console.error('Sync error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});