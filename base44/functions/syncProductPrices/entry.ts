import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { assertAdmin } from '../../shared/authGuard.ts';

// Category mapping from CSV categories to our Product entity enum values
const CATEGORY_MAP = {
  'vodka': 'spirits',
  'whiskey': 'spirits',
  'bourbon': 'spirits',
  'cognac': 'spirits',
  'brandy': 'spirits',
  'tequila': 'spirits',
  'rum': 'spirits',
  'liqueur': 'spirits',
  'beer': 'beer',
  'cider': 'beer',
  'seltzer': 'beer',
  'rtd': 'beer',
  'wine': 'wine',
  'sparkling': 'wine',
  'champagne': 'wine',
};

function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = values[i] || ''; });
    return obj;
  });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { authorized, response } = await assertAdmin(base44);
    if (!authorized) return response;

    const csvUrl = Deno.env.get('PRODUCTS_CSV_URL');
    if (!csvUrl) {
      return Response.json({ error: 'PRODUCTS_CSV_URL secret is not set. Please add it in dashboard settings.' }, { status: 400 });
    }

    // Fetch the CSV
    const csvResponse = await fetch(csvUrl);
    if (!csvResponse.ok) {
      return Response.json({ error: `Failed to fetch CSV: ${csvResponse.status} ${csvResponse.statusText}` }, { status: 500 });
    }
    const csvText = await csvResponse.text();
    const csvRows = parseCSV(csvText);

    // Get all stores in Jefferson County
    const stores = await base44.asServiceRole.entities.Store.filter({ county: 'Jefferson', is_active: true });
    if (!stores.length) {
      return Response.json({ error: 'No active stores found in Jefferson County' }, { status: 404 });
    }

    let updated = 0;
    let created = 0;
    let skipped = 0;

    for (const store of stores) {
      // Get existing products for this store
      const existingProducts = await base44.asServiceRole.entities.Product.filter({ store_id: store.id });

      for (const row of csvRows) {
        const productName = row.product_name;
        const brand = row.brand;
        const price = parseFloat(row.avg_price);
        const volume = row.size;
        const categoryRaw = (row.category || '').toLowerCase();
        const category = CATEGORY_MAP[categoryRaw] || 'spirits';

        if (!productName || isNaN(price)) { skipped++; continue; }

        // Find existing product by name match (case-insensitive)
        const existing = existingProducts.find(p =>
          p.name.toLowerCase() === productName.toLowerCase()
        );

        if (existing) {
          // Update price if changed
          if (existing.price !== price || existing.volume !== volume) {
            await base44.asServiceRole.entities.Product.update(existing.id, {
              price,
              volume,
              brand,
              category,
            });
            updated++;
          }
        } else {
          // Create new product for this store
          await base44.asServiceRole.entities.Product.create({
            name: productName,
            brand,
            category,
            price,
            volume,
            store_id: store.id,
            in_stock: true,
          });
          created++;
        }
      }
    }

    const summary = {
      message: 'Product price sync completed',
      stores_synced: stores.length,
      products_updated: updated,
      products_created: created,
      products_skipped: skipped,
      csv_rows: csvRows.length,
      synced_at: new Date().toISOString(),
    };

    console.log('Sync complete:', JSON.stringify(summary));
    return Response.json(summary);

  } catch (error) {
    console.error('Sync error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});