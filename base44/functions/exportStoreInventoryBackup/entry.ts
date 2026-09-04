/**
 * exportStoreInventoryBackup
 * Admin-only. Exports ALL products for a given store to a CSV file uploaded to
 * durable storage and returns a permanent download URL. Used as a recoverable
 * backup before any inventory replacement (e.g. Clover staging promotion).
 *
 * POST body: { store_id?: string }
 * Default store_id = BEVERAGE KING.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { BEVERAGE_KING_STORE_ID } from '../../shared/cloverCredentials.ts';

const CSV_COLUMNS = [
  'id', 'name', 'sku', 'brand', 'category', 'price', 'pack_size', 'volume',
  'abv', 'stock_quantity', 'in_stock', 'store_id', 'created_date', 'updated_date'
];

function csvEscape(val) {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const storeId = body.store_id || BEVERAGE_KING_STORE_ID;

    let store;
    try {
      store = await base44.asServiceRole.entities.Store.get(storeId);
    } catch (e) {
      return Response.json({ error: `Store not found: ${storeId}` }, { status: 404 });
    }

    // Fetch ALL products scoped to this store (paginate).
    const all = [];
    let skip = 0;
    while (true) {
      const batch = await base44.asServiceRole.entities.Product.filter(
        { store_id: storeId }, 'name', 500, skip
      );
      all.push(...batch);
      if (batch.length < 500) break;
      skip += 500;
      if (skip > 50000) break;
    }
    console.log(`[backup] store=${storeId} products=${all.length}`);

    const rows = [CSV_COLUMNS.join(',')];
    for (const p of all) {
      rows.push(CSV_COLUMNS.map(c => csvEscape(p[c])).join(','));
    }
    const csv = rows.join('\n');
    const stamp = new Date().toISOString().slice(0, 10);
    const fileName = `inventory_backup_${store.name.replace(/[^a-z0-9]/gi, '_')}_${stamp}.csv`;

    const fileObj = new File([csv], fileName, { type: 'text/csv' });
    const uploadRes = await base44.asServiceRole.integrations.Core.UploadFile({ file: fileObj });
    const fileUrl = uploadRes?.file_url;

    return Response.json({
      success: true,
      store: { id: storeId, name: store.name },
      products_exported: all.length,
      backup_file_url: fileUrl,
      backup_file_name: fileName,
    });
  } catch (error) {
    console.error('[backup] fatal:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}