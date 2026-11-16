import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import * as XLSX from 'npm:xlsx@0.18.5';
import { retailerInventoryUpload } from '../../shared/retailerInventoryUpload.ts';

const CATEGORY_MAP = {
  'vodka': 'spirits', 'whiskey': 'spirits', 'bourbon': 'spirits', 'cognac': 'spirits',
  'brandy': 'spirits', 'tequila': 'spirits', 'rum': 'spirits', 'liqueur': 'spirits',
  'gin': 'spirits', 'spirit': 'spirits', 'spirits': 'spirits',
  'beer': 'beer', 'cider': 'beer', 'seltzer': 'beer', 'rtd': 'beer', 'malt': 'beer',
  'wine': 'wine', 'sparkling': 'wine', 'champagne': 'wine', 'rose': 'wine',
  'mixer': 'mixers', 'mixers': 'mixers', 'soda': 'mixers',
  'accessory': 'accessories', 'accessories': 'accessories',
};

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
  }).filter(row => row.store_id || row.store_name || row.product_name);
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
  }).filter(row => row.store_id || row.store_name || row.product_name);
}

async function extractCSVFromZip(arrayBuffer) {
  // Simple ZIP parser — reads first .csv file found
  const bytes = new Uint8Array(arrayBuffer);
  const decoder = new TextDecoder('utf-8');
  const csvFiles = [];

  let i = 0;
  while (i < bytes.length - 4) {
    // Local file header signature: 0x04034b50
    if (bytes[i] === 0x50 && bytes[i+1] === 0x4b && bytes[i+2] === 0x03 && bytes[i+3] === 0x04) {
      const compression = bytes[i+8] | (bytes[i+9] << 8);
      const compressedSize = bytes[i+18] | (bytes[i+19] << 8) | (bytes[i+20] << 16) | (bytes[i+21] << 24);
      const filenameLen = bytes[i+26] | (bytes[i+27] << 8);
      const extraLen = bytes[i+28] | (bytes[i+29] << 8);
      const filename = decoder.decode(bytes.slice(i+30, i+30+filenameLen));
      const dataStart = i + 30 + filenameLen + extraLen;

      if (filename.toLowerCase().endsWith('.csv') && compression === 0) {
        const fileData = bytes.slice(dataStart, dataStart + compressedSize);
        csvFiles.push({ filename, text: decoder.decode(fileData) });
      }
      i = dataStart + compressedSize;
    } else {
      i++;
    }
  }
  return csvFiles;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user && req.headers.get('content-type')?.includes('application/json')) {
      if (req.method !== 'POST') return Response.json({ error:'Method not allowed' },{ status:405 });
      return Response.json(await retailerInventoryUpload(base44,user,await req.json()));
    }
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    if (!req.headers.get('content-type')?.includes('multipart/form-data')) return Response.json({ error: 'Upload a CSV or Excel file using the inventory form.' }, { status: 400 });
    const formData = await req.formData();
    const file = formData.get('file');
    if (!file) {
      return Response.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Optional: force all rows into a specific store (single-store upload mode)
    const forcedStoreId = formData.get('store_id') || null;
    if (file.size > 50 * 1024 * 1024) return Response.json({ error: 'File must be under 50 MB.' }, { status: 400 });
    if (forcedStoreId) {
      const targetStore = await base44.asServiceRole.entities.Store.get(String(forcedStoreId));
      if (!targetStore) return Response.json({ error: 'Store not found.' }, { status: 404 });
      if (targetStore.id === '6a3bed91eb84bc989a04e479') return Response.json({ error: 'Colonial uses authorized POS pricing and stock. Submit its POS export in retailer setup for review before connecting the authoritative feed.' }, { status: 409 });
    }

    const filename = file.name.toLowerCase();
    const arrayBuffer = await file.arrayBuffer();
    let allRows = [];

    if (filename.endsWith('.zip')) {
      const csvFiles = await extractCSVFromZip(arrayBuffer);
      if (!csvFiles.length) {
        return Response.json({ error: 'No CSV files found inside the ZIP' }, { status: 400 });
      }
      allRows = csvFiles.flatMap(f => parseCSV(f.text));
    } else if (filename.endsWith('.csv')) {
      const csvText = new TextDecoder('utf-8').decode(arrayBuffer);
      allRows = parseCSV(csvText);
    } else if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
      allRows = parseXLSX(arrayBuffer);
    } else {
      return Response.json({ error: 'Only .csv, .xlsx, and .zip files are supported' }, { status: 400 });
    }
    console.log(`Parsed ${allRows.length} total rows`);

    // Group rows by store
    const storeMap = {};
    for (const row of allRows) {
      const storeKey = forcedStoreId || row.store_id || row.store_name;
      if (!storeKey) continue;
      if (!storeMap[storeKey]) storeMap[storeKey] = { info: row, products: [] };
      if (row.product_name) storeMap[storeKey].products.push(row);
    }

    // Load existing stores and products
    const [existingStores, existingProducts] = await Promise.all([
      base44.asServiceRole.entities.Store.list('name', 500),
      base44.asServiceRole.entities.Product.list('name', 5000),
    ]);

    const storeByLicense = {};
    const storeByName = {};
    for (const s of existingStores) {
      if (s.license_number) storeByLicense[s.license_number] = s;
      storeByName[s.name?.toLowerCase()] = s;
    }

    const productByKey = {};
    for (const p of existingProducts) {
      const key = `${p.store_id}|${(p.name || '').toLowerCase()}|${(p.brand || '').toLowerCase()}`;
      productByKey[key] = p;
    }

    let storesCreated = 0, storesUpdated = 0;
    let productsCreated = 0, productsUpdated = 0, productsSkipped = 0;
    const errors = [];

    for (const [storeKey, { info, products }] of Object.entries(storeMap)) {
      let storeId;
      try {
        // If a specific store was forced (single-store upload mode), skip store create/update
        if (forcedStoreId) {
          storeId = forcedStoreId;
          storesUpdated++;
        } else {
          // Find or create store
          const existingStore = storeByLicense[info.license_number] || storeByName[info.store_name?.toLowerCase()];

          const storeData = {
            name: info.store_name || storeKey,
            ...(info.license_number && { license_number: info.license_number }),
            ...(info.address && { address: info.address }),
            ...(info.city && { city: info.city }),
            ...(info.county && { county: info.county }),
            state: info.state || 'AR',
            ...(info.zip_code && { zip_code: info.zip_code }),
            ...(info.phone && { phone: info.phone }),
            ...(info.email && { email: info.email }),
            ...(info.latitude && { latitude: parseFloat(info.latitude) }),
            ...(info.longitude && { longitude: parseFloat(info.longitude) }),
            ...(info.operating_hours_start && { operating_hours_start: info.operating_hours_start }),
            ...(info.operating_hours_end && { operating_hours_end: info.operating_hours_end }),
            is_active: true,
          };

          if (existingStore) {
            await base44.asServiceRole.entities.Store.update(existingStore.id, storeData);
            storeId = existingStore.id;
            storesUpdated++;
          } else {
            const created = await base44.asServiceRole.entities.Store.create(storeData);
            storeId = created.id;
            storesCreated++;
          }
        }
      } catch (e) {
        errors.push(`Store "${storeKey}": ${e.message}`);
        continue;
      }

      if (storeId === '6a3bed91eb84bc989a04e479') {
        errors.push('Colonial inventory is POS-authoritative; spreadsheet updates were not applied.');
        productsSkipped += products.length;
        continue;
      }
      // Sync products for this store
      for (const row of products) {
        try {
          const category = CATEGORY_MAP[row.category?.toLowerCase()] || 'spirits';
          const price = parseFloat(row.price || row.avg_price) || 0;
          const stockQty = row.stock_quantity !== '' && row.stock_quantity !== undefined ? parseInt(row.stock_quantity, 10) : null;
          const inStock = row.in_stock !== '' && row.in_stock !== undefined
            ? !['false', '0', 'no', 'out'].includes(row.in_stock.toLowerCase())
            : (stockQty === null ? true : stockQty > 0);

          const key = `${storeId}|${row.product_name.toLowerCase()}|${(row.brand || '').toLowerCase()}`;

          if (productByKey[key]) {
            const existing = productByKey[key];
            if (existing.inventory_source === 'clover') { productsSkipped++; continue; }
            const changes = { inventory_source: 'csv', last_synced_at: new Date().toISOString() };
            if (existing.price !== price) changes.price = price;
            if (stockQty !== null && existing.stock_quantity !== stockQty) changes.stock_quantity = stockQty;
            if (existing.in_stock !== inStock) changes.in_stock = inStock;
            if (row.volume && existing.volume !== row.volume) changes.volume = row.volume;
            if (Object.keys(changes).length > 0) {
              await base44.asServiceRole.entities.Product.update(existing.id, changes);
              productsUpdated++;
            } else {
              productsSkipped++;
            }
          } else {
            const newProduct = {
              name: row.product_name,
              brand: row.brand || '',
              category,
              price,
              store_id: storeId,
              in_stock: inStock,
              ...(row.volume && { volume: row.volume }),
              ...(row.abv && { abv: parseFloat(row.abv) }),
              ...(stockQty !== null && { stock_quantity: stockQty }),
            };
            newProduct.inventory_source = 'csv';
            newProduct.last_synced_at = new Date().toISOString();
            const createdProduct = await base44.asServiceRole.entities.Product.create(newProduct);
            productByKey[key] = createdProduct;
            productsCreated++;
          }
        } catch (e) {
          errors.push(`Product "${row.product_name}" in store "${storeKey}": ${e.message}`);
        }
      }
    }

    const summary = {
      stores: { created: storesCreated, updated: storesUpdated },
      products: { created: productsCreated, updated: productsUpdated, skipped: productsSkipped },
      errors: errors.slice(0, 20), // cap error list
      total_rows: allRows.length,
    };
    console.log('Sync complete:', JSON.stringify(summary));
    return Response.json({ success: true, summary });

  } catch (error) {
    console.error('Upload sync error:', error.message);
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}