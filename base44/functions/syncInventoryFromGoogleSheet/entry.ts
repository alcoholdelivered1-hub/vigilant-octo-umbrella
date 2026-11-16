import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Extracts the spreadsheet ID from a Google Sheets URL or accepts a raw ID.
 * Supports formats:
 *   https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit#gid=SHEET_GID
 *   https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
 *   SPREADSHEET_ID (raw)
 */
function parseSheetUrl(input) {
  if (!input) return { spreadsheetId: null, sheetName: null };
  const trimmed = input.trim();

  // Raw ID (no slashes or URL)
  if (!trimmed.includes('/')) {
    return { spreadsheetId: trimmed, sheetName: null };
  }

  // Extract spreadsheet ID
  const idMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  const spreadsheetId = idMatch ? idMatch[1] : null;

  // Extract gid (sheet tab id) if present
  const gidMatch = trimmed.match(/[?&#]gid=([0-9]+)/);
  const gid = gidMatch ? gidMatch[1] : null;

  return { spreadsheetId, sheetName: gid };
}

/**
 * Fetches all rows from a Google Sheet using the Sheets API v4.
 * Returns an array of objects keyed by the header row (lowercased, snake_case).
 */
async function fetchSheetData(accessToken, spreadsheetId, sheetName) {
  // If sheetName is a gid (numeric), we need to resolve the actual sheet title.
  let range = 'A:Z';
  let title = sheetName;

  if (sheetName && /^\d+$/.test(sheetName)) {
    // Resolve gid -> sheet title via spreadsheet metadata
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!metaRes.ok) {
      const err = await metaRes.json().catch(() => ({}));
      throw new Error(`Cannot access spreadsheet: ${err.error?.message || metaRes.statusText}`);
    }
    const meta = await metaRes.json();
    const match = meta.sheets?.find(s => String(s.properties?.sheetId) === String(sheetName));
    if (match) title = match.properties?.title;
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
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { spreadsheet_url, sheet_name, dry_run } = body;
    if (!spreadsheet_url) {
      return Response.json({ error: 'spreadsheet_url is required' }, { status: 400 });
    }

    const { spreadsheetId, sheetName: parsedSheet } = parseSheetUrl(spreadsheet_url);
    if (!spreadsheetId) {
      return Response.json({ error: 'Could not extract a valid spreadsheet ID from the URL' }, { status: 400 });
    }

    // Get the Google Sheets OAuth token (shared connector)
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');
    if (!accessToken) {
      return Response.json({ error: 'Google Sheets connector not authorized' }, { status: 500 });
    }

    const rows = await fetchSheetData(accessToken, spreadsheetId, sheet_name || parsedSheet);
    console.log(`Fetched ${rows.length} rows from Google Sheet ${spreadsheetId}`);

    if (!rows.length) {
      return Response.json({ success: true, summary: { rows_read: 0, products_updated: 0, products_not_found: 0, errors: [] } });
    }

    // Load existing stores and products for matching
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

    // Index products by store_id + name + brand for fast lookup
    const productIndex = {};
    for (const p of products) {
      const key = `${p.store_id}|${(p.name || '').toLowerCase()}|${(p.brand || '').toLowerCase()}`;
      productIndex[key] = p;
    }

    let updated = 0;
    let notFound = 0;
    const errors = [];

    for (const row of rows) {
      try {
        // Resolve store
        let store = null;
        if (row.store_id && storeById[row.store_id]) {
          store = storeById[row.store_id];
        } else if (row.store_name) {
          store = storeByName[row.store_name.toLowerCase()];
        }
        if (!store) {
          notFound++;
          errors.push(`Row skipped — store "${row.store_name || row.store_id}" not found`);
          continue;
        }

        if (!row.product_name) {
          notFound++;
          errors.push(`Row skipped — no product_name for store "${store.name}"`);
          continue;
        }

        const key = `${store.id}|${row.product_name.toLowerCase()}|${(row.brand || '').toLowerCase()}`;
        const existing = productIndex[key];
        if (!existing) {
          notFound++;
          continue;
        }

        // Build update payload — only price, stock_quantity, in_stock, volume, abv
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

        if (row.volume && existing.volume !== row.volume) changes.volume = row.volume;
        if (row.abv) {
          const abv = parseFloat(row.abv);
          if (!isNaN(abv) && existing.abv !== abv) changes.abv = abv;
        }

        if (Object.keys(changes).length > 0) {
          if (!dry_run) {
            await base44.asServiceRole.entities.Product.update(existing.id, changes);
          }
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
      dry_run: !!dry_run,
      errors: errors.slice(0, 25),
    };
    console.log('Google Sheet sync complete:', JSON.stringify(summary));
    return Response.json({ success: true, summary });
  } catch (error) {
    console.error('Google Sheet sync error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});