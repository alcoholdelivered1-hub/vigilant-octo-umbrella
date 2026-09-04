/**
 * Bulk inventory upload for a SINGLE store (admin-only).
 *
 * Accepts either:
 *   - multipart/form-data:  file (CSV/XLSX) + store_id   (used by the Store Inventory Upload page)
 *   - application/json:     { store_id, rows: [...] }     (used for testing / programmatic calls)
 *
 * Behavior:
 *   - Validates every row; invalid rows are skipped and reported (never throw the whole batch).
 *   - Dedup key = `${store_id}|${sku}` when an SKU/UPC is present, otherwise falls back to
 *     `${store_id}|name|brand|pack_size`. This makes re-runs idempotent: a timeout mid-upload
 *     can be safely resumed by re-submitting the same file — already-created rows are updated,
 *     not duplicated.
 *   - Hard-scoped to the supplied store_id: existing products are fetched ONLY for that store,
 *     and every created/updated record is pinned to it. A row whose own store_id column
 *     disagrees with the forced store_id is rejected, so one store can never touch another's catalog.
 *   - Writes in batches of 500 via bulkCreate / bulkUpdate, with per-batch retry (3 attempts).
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import * as XLSX from 'npm:xlsx@0.18.5';

const CATEGORY_MAP = {
  'vodka': 'spirits', 'whiskey': 'spirits', 'bourbon': 'spirits', 'cognac': 'spirits',
  'brandy': 'spirits', 'tequila': 'spirits', 'rum': 'spirits', 'liqueur': 'spirits',
  'gin': 'spirits', 'spirit': 'spirits', 'spirits': 'spirits', 'scotch': 'spirits', 'schnapps': 'spirits',
  'beer': 'beer', 'cider': 'beer', 'seltzer': 'beer', 'rtd': 'beer', 'malt': 'beer', 'ale': 'beer', 'lager': 'beer',
  'wine': 'wine', 'sparkling': 'wine', 'champagne': 'wine', 'rose': 'wine',
  'mixer': 'mixers', 'mixers': 'mixers', 'soda': 'mixers', 'tonic': 'mixers', 'juice': 'mixers',
  'accessory': 'accessories', 'accessories': 'accessories', 'supplies': 'accessories',
};

const BATCH_SIZE = 500;
const MAX_RETRIES = 3;

function parseCSV(text) {
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
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
    headers.forEach((h, i) => { obj[h] = (values[i] || '').replace(/^"|"$/g, ''); });
    return obj;
  });
}

function parseXLSX(arrayBuffer) {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
  return rows.map(row => {
    const normalized = {};
    for (const [key, value] of Object.entries(row)) {
      const normalizedKey = key.trim().toLowerCase().replace(/\s+/g, '_');
      normalized[normalizedKey] = String(value ?? '').trim();
    }
    return normalized;
  });
}

function normalizeRow(row) {
  const name = (row.product_name || row.name || '').trim();
  const sku = (row.sku || row.upc || row.barcode || '').trim();
  const category = CATEGORY_MAP[(row.category || '').toLowerCase()] || 'spirits';
  const price = parseFloat(row.price || row.avg_price);
  const brand = (row.brand || '').trim();
  const packSize = (row.pack_size || 'Single').trim();
  const volume = (row.volume || row.size || '').trim();
  const abv = row.abv ? parseFloat(row.abv) : null;
  const stockQtyRaw = row.stock_quantity;
  const stockQty = stockQtyRaw !== '' && stockQtyRaw !== undefined ? parseInt(stockQtyRaw, 10) : null;
  const inStock = row.in_stock !== '' && row.in_stock !== undefined
    ? !['false', '0', 'no', 'out'].includes(row.in_stock.toString().toLowerCase())
    : (stockQty === null ? true : stockQty > 0);
  return { name, sku, category, price, brand, packSize, volume, abv, stockQty, inStock };
}

function dedupKey(storeId, p) {
  if (p.sku) return `sku|${storeId}|${p.sku}`;
  return `name|${storeId}|${p.name.toLowerCase()}|${p.brand.toLowerCase()}|${p.packSize.toLowerCase()}`;
}

// Retry a bulk operation up to MAX_RETRIES times. Returns count of failed batches.
async function bulkWithRetry(fn, items, label, batchErrors) {
  let failed = 0;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const slice = items.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    let attempt = 0;
    let ok = false;
    while (attempt < MAX_RETRIES) {
      try {
        await fn(slice);
        ok = true;
        break;
      } catch (e) {
        attempt++;
        console.error(`[inventory-upload] ${label} batch ${batchNum} attempt ${attempt} failed: ${e.message}`);
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, 1000 * attempt));
        } else {
          batchErrors.push(`${label} batch ${batchNum} (${slice.length} items): ${e.message}`);
          failed++;
        }
      }
    }
    void ok;
  }
  return failed;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    let rows = [];
    let forcedStoreId = null;

    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file');
      forcedStoreId = (formData.get('store_id') || '').toString();
      if (!file) return Response.json({ error: 'No file uploaded' }, { status: 400 });

      const filename = file.name.toLowerCase();
      const arrayBuffer = await file.arrayBuffer();
      if (filename.endsWith('.csv')) {
        rows = parseCSV(new TextDecoder('utf-8').decode(arrayBuffer));
      } else if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
        rows = parseXLSX(arrayBuffer);
      } else {
        return Response.json({ error: 'Only .csv and .xlsx files are supported' }, { status: 400 });
      }
    } else if (contentType.includes('application/json')) {
      const body = await req.json();
      rows = Array.isArray(body.rows) ? body.rows : [];
      forcedStoreId = body.store_id || '';
    } else {
      return Response.json({ error: 'Unsupported content type' }, { status: 400 });
    }

    if (!forcedStoreId) {
      return Response.json({ error: 'store_id is required (single-store scoping)' }, { status: 400 });
    }
    if (rows.length === 0) {
      return Response.json({ error: 'No product rows found in upload' }, { status: 400 });
    }

    console.log(`[inventory-upload] store=${forcedStoreId} rows=${rows.length}`);

    // Verify the store exists (and is active) before touching its catalog.
    let store;
    try {
      store = await base44.asServiceRole.entities.Store.get(forcedStoreId);
    } catch (e) {
      return Response.json({ error: `Store not found: ${forcedStoreId}` }, { status: 404 });
    }
    if (store.is_active === false) {
      return Response.json({ error: `Store "${store.name}" is inactive` }, { status: 400 });
    }

    // Fetch ALL existing products scoped to this store only (paginate, supports 11k+).
    const existingProducts = [];
    let skip = 0;
    while (true) {
      const batch = await base44.asServiceRole.entities.Product.filter(
        { store_id: forcedStoreId }, 'name', 500, skip
      );
      existingProducts.push(...batch);
      if (batch.length < 500) break;
      skip += 500;
      if (skip > 30000) break; // hard safety cap
    }
    console.log(`[inventory-upload] loaded ${existingProducts.length} existing products for store`);

    // Build dedup maps: sku key is primary, name-key is legacy fallback.
    const productBySku = {};
    const productByNameKey = {};
    for (const p of existingProducts) {
      if (p.sku) productBySku[`${forcedStoreId}|${p.sku}`] = p;
      const nk = `name|${forcedStoreId}|${(p.name || '').toLowerCase()}|${(p.brand || '').toLowerCase()}|${(p.pack_size || 'Single').toLowerCase()}`;
      if (!productByNameKey[nk]) productByNameKey[nk] = p;
    }

    const validationErrors = [];
    const creates = [];
    const updates = [];
    const seenInFile = new Set();
    let skippedUnchanged = 0;

    rows.forEach((rawRow, i) => {
      const rowNo = i + 2; // +1 header, +1 1-based
      const rowStoreId = (rawRow.store_id || '').toString().trim();

      // Cross-store guard: if the row declares its own store_id, it must match the forced store.
      if (rowStoreId && rowStoreId !== forcedStoreId) {
        validationErrors.push(`Row ${rowNo}: store_id "${rowStoreId}" does not match target store — skipped`);
        return;
      }

      const p = normalizeRow(rawRow);

      if (!p.name) {
        validationErrors.push(`Row ${rowNo}: missing product_name — skipped`);
        return;
      }
      if (!p.price || isNaN(p.price) || p.price <= 0) {
        validationErrors.push(`Row ${rowNo}: invalid price for "${p.name}" — skipped`);
        return;
      }
      if (p.abv !== null && (isNaN(p.abv) || p.abv < 0 || p.abv > 100)) {
        validationErrors.push(`Row ${rowNo}: invalid abv for "${p.name}" — skipped`);
        return;
      }

      const key = dedupKey(forcedStoreId, p);
      if (seenInFile.has(key)) {
        validationErrors.push(`Row ${rowNo}: duplicate within file ("${p.name}") — skipped`);
        return;
      }
      seenInFile.add(key);

      const existing = p.sku
        ? (productBySku[`${forcedStoreId}|${p.sku}`] || productByNameKey[`name|${forcedStoreId}|${p.name.toLowerCase()}|${p.brand.toLowerCase()}|${p.packSize.toLowerCase()}`])
        : productByNameKey[`name|${forcedStoreId}|${p.name.toLowerCase()}|${p.brand.toLowerCase()}|${p.packSize.toLowerCase()}`];

      if (existing) {
        const changes = { id: existing.id };
        if (existing.price !== p.price) changes.price = p.price;
        if (p.sku && existing.sku !== p.sku) changes.sku = p.sku;
        if (existing.pack_size !== p.packSize) changes.pack_size = p.packSize;
        if (p.volume && existing.volume !== p.volume) changes.volume = p.volume;
        if (p.abv !== null && existing.abv !== p.abv) changes.abv = p.abv;
        if (p.stockQty !== null && existing.stock_quantity !== p.stockQty) changes.stock_quantity = p.stockQty;
        if (existing.in_stock !== p.inStock) changes.in_stock = p.inStock;
        if (p.brand && existing.brand !== p.brand) changes.brand = p.brand;
        if (Object.keys(changes).length > 1) {
          updates.push(changes);
        } else {
          skippedUnchanged++;
        }
      } else {
        const newProduct = {
          name: p.name,
          ...(p.sku && { sku: p.sku }),
          brand: p.brand,
          category: p.category,
          price: p.price,
          pack_size: p.packSize,
          store_id: forcedStoreId,
          in_stock: p.inStock,
          ...(p.volume && { volume: p.volume }),
          ...(p.abv !== null && { abv: p.abv }),
          ...(p.stockQty !== null && { stock_quantity: p.stockQty }),
        };
        creates.push(newProduct);
      }
    });

    console.log(`[inventory-upload] creates=${creates.length} updates=${updates.length} unchanged=${skippedUnchanged} invalid=${validationErrors.length}`);

    const batchErrors = [];
    const failedCreateBatches = await bulkWithRetry(
      (slice) => base44.asServiceRole.entities.Product.bulkCreate(slice),
      creates, 'create', batchErrors
    );
    const failedUpdateBatches = await bulkWithRetry(
      (slice) => base44.asServiceRole.entities.Product.bulkUpdate(slice),
      updates, 'update', batchErrors
    );

    const createdCount = creates.length - (failedCreateBatches * BATCH_SIZE);
    const updatedCount = updates.length - (failedUpdateBatches * BATCH_SIZE);

    const summary = {
      total_rows: rows.length,
      store: { id: forcedStoreId, name: store.name },
      products: {
        created: Math.max(0, createdCount),
        updated: Math.max(0, updatedCount),
        unchanged: skippedUnchanged,
        invalid: validationErrors.length,
      },
      batches: {
        size: BATCH_SIZE,
        create_batches: Math.ceil(creates.length / BATCH_SIZE),
        update_batches: Math.ceil(updates.length / BATCH_SIZE),
        failed: failedCreateBatches + failedUpdateBatches,
        retried_ok: (failedCreateBatches + failedUpdateBatches) === 0,
      },
      resume_safe: true,
      errors: validationErrors.slice(0, 50),
      batch_errors: batchErrors,
    };
    console.log(`[inventory-upload] complete: ${JSON.stringify({ created: summary.products.created, updated: summary.products.updated, invalid: summary.products.invalid })}`);
    return Response.json({ success: true, summary });
  } catch (error) {
    console.error('[inventory-upload] fatal:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
}