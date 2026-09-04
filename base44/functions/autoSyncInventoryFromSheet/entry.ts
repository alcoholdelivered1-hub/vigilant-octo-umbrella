import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

/**
 * Automatically syncs product prices and stock from a Google Sheet.
 * Triggered by a scheduled automation — no user auth context.
 * Reads the spreadsheet URL from the InventorySyncConfig entity.
 */

function parseSheetUrl(input) {
  if (!input) return { spreadsheetId: null, sheetName: null };
  const trimmed = input.trim();
  if (!trimmed.includes('/')) return { spreadsheetId: trimmed, sheetName: null };
  const idMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  const spreadsheetId = idMatch ? idMatch[1] : null;
  const gidMatch = trimmed.match(/[?&#]gid=([0-9]+)/);
  const gid = gidMatch ? gidMatch[1] : null;
  return { spreadsheetId, sheetName: gid };
}

async function fetchSheetData(accessToken, spreadsheetId, sheetName) {
  let range = 'A:Z';
  let title = sheetName;

  if (sheetName && /^\d+$/.test(sheetName)) {
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (metaRes.ok) {
      const meta = await metaRes.json();
      const match = meta.sheets?.find(s => String(s.properties?.sheetId) === String(sheetName));
      if (match) title = match.properties?.title;
    }
  }

  if (title) range = `'${title}'!A:Z`;

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Google Sheets API error: ${err.error?.message || res.statusText}`);
  }
  const json = await res.json();
  const rows = json.values || [];
  if (rows.length < 2) return [];

  const headers = rows[0].map(h => String(h || '').trim().toLowerCase().replace(/\s+/g, '_'));
  return rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (row[i] !== undefined ? String(row[i]) : '').trim(); });
    return obj;
  }).filter(r => r.store_name || r.store_id || r.product_name);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Load the active sync config (no user auth — this runs on a schedule)
    const configs = await base44.asServiceRole.entities.InventorySyncConfig.filter(
      { is_active: true },
      '-created_date',
      1
    );

    if (!configs.length) {
      return Response.json({ success: true, message: 'No active InventorySyncConfig — skipping.' });
    }

    const config = configs[0];
    if (!config.spreadsheet_url) {
      return Response.json({ success: false, error: 'Config has no spreadsheet_url' });
    }

    const { spreadsheetId, sheetName: parsedSheet } = parseSheetUrl(config.spreadsheet_url);
    if (!spreadsheetId) {
      return Response.json({ success: false, error: 'Could not parse spreadsheet ID from config URL' });
    }

    // Get the Google Sheets OAuth token (shared connector)
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');
    if (!accessToken) {
      return Response.json({ success: false, error: 'Google Sheets connector not authorized' });
    }

    const rows = await fetchSheetData(accessToken, spreadsheetId, config.sheet_name || parsedSheet);
    console.log(`[autoSync] Fetched ${rows.length} rows from sheet`);

    if (!rows.length) {
      await base44.asServiceRole.entities.InventorySyncConfig.update(config.id, {
        last_synced_at: new Date().toISOString(),
        last_sync_status: 'success',
        last_sync_summary: 'No rows found in sheet.',
      });
      return Response.json({ success: true, summary: { rows_read: 0, products_updated: 0, products_not_found: 0 } });
    }

    // Load stores and products for matching
    const [stores, products] = await Promise.all([
      base44.asServiceRole.entities.Store.list('name', 500),
      base44.asServiceRole.entities.Product.list('name', 10000),
    ]);

    const storeByName = {};
    const storeById = {};
    for (const s of stores) {
      if (s.name) storeByName[s.name.toLowerCase()] = s;
      storeById[s.id] = s;
    }

    // Index products by store_id + name + brand + pack_size
    const productIndex = {};
    for (const p of products) {
      const key = `${p.store_id}|${(p.name || '').toLowerCase()}|${(p.brand || '').toLowerCase()}|${(p.pack_size || 'Single').toLowerCase()}`;
      productIndex[key] = p;
    }

    let updated = 0;
    let notFound = 0;
    const errors = [];

    for (const row of rows) {
      try {
        let store = null;
        if (row.store_id && storeById[row.store_id]) {
          store = storeById[row.store_id];
        } else if (row.store_name) {
          store = storeByName[row.store_name.toLowerCase()];
        }
        if (!store) {
          notFound++;
          errors.push(`Store "${row.store_name || row.store_id}" not found`);
          continue;
        }

        if (!row.product_name) {
          notFound++;
          continue;
        }

        const packSize = (row.pack_size || 'Single').toLowerCase();
        const key = `${store.id}|${row.product_name.toLowerCase()}|${(row.brand || '').toLowerCase()}|${packSize}`;
        const existing = productIndex[key];

        if (!existing) {
          notFound++;
          continue;
        }

        const changes = {};
        const price = parseFloat(row.price);
        if (!isNaN(price) && existing.price !== price) changes.price = price;

        if (row.stock_quantity !== '' && row.stock_quantity !== undefined) {
          const qty = parseInt(row.stock_quantity, 10);
          if (!isNaN(qty) && existing.stock_quantity !== qty) changes.stock_quantity = qty;
        }

        if (row.in_stock !== '' && row.in_stock !== undefined) {
          const inStock = !['false', '0', 'no', 'out'].includes(row.in_stock.toLowerCase());
          if (existing.in_stock !== inStock) changes.in_stock = inStock;
        }

        if (row.pack_size && existing.pack_size !== row.pack_size) changes.pack_size = row.pack_size;
        if (row.volume && existing.volume !== row.volume) changes.volume = row.volume;
        if (row.abv) {
          const abv = parseFloat(row.abv);
          if (!isNaN(abv) && existing.abv !== abv) changes.abv = abv;
        }

        if (Object.keys(changes).length > 0) {
          await base44.asServiceRole.entities.Product.update(existing.id, changes);
          updated++;
        }
      } catch (e) {
        errors.push(`Row error: ${e.message}`);
      }
    }

    const summary = {
      rows_read: rows.length,
      products_updated: updated,
      products_not_found: notFound,
      errors: errors.slice(0, 10),
    };

    await base44.asServiceRole.entities.InventorySyncConfig.update(config.id, {
      last_synced_at: new Date().toISOString(),
      last_sync_status: 'success',
      last_sync_summary: `${updated} updated, ${notFound} skipped, ${rows.length} rows read.`,
    });

    console.log('[autoSync] Complete:', JSON.stringify(summary));
    return Response.json({ success: true, summary });
  } catch (error) {
    console.error('[autoSync] Error:', error.message);

    // Try to record the failure on the config
    try {
      const base44 = createClientFromRequest(req);
      const configs = await base44.asServiceRole.entities.InventorySyncConfig.filter({ is_active: true }, '-created_date', 1);
      if (configs[0]) {
        await base44.asServiceRole.entities.InventorySyncConfig.update(configs[0].id, {
          last_synced_at: new Date().toISOString(),
          last_sync_status: 'error',
          last_sync_summary: error.message,
        });
      }
    } catch {}

    return Response.json({ error: error.message }, { status: 500 });
  }
});