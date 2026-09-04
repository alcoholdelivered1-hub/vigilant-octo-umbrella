/**
 * testCloverInventoryReadOnly
 * Admin-only, READ-ONLY. Verifies the Clover connection for a store and reports
 * merchant/store ID, environment, total item count, and field availability
 * (names, SKU/UPC, prices, categories, stock) — WITHOUT exposing tokens or
 * credentials anywhere in the response or logs.
 *
 * POST body: { store_id?: string }
 * Default store_id = BEVERAGE KING.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  BEVERAGE_KING_STORE_ID,
  resolveCloverCredentials,
  autoDiscoverMerchantId,
  findActiveCloverEnvironment,
} from '../../shared/cloverCredentials.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const storeId = body.store_id || BEVERAGE_KING_STORE_ID;

    const store = await base44.asServiceRole.entities.Store.get(storeId);

    // Resolve credentials from StorePosCredential / env secrets (never echoed).
    const { apiToken, merchantId: rawMerchantId, tokenSource } = await resolveCloverCredentials(base44, storeId);
    if (!apiToken) {
      return Response.json({
        success: false,
        connected: false,
        reason: 'No Clover API token configured for this store',
        token_source: tokenSource,
      });
    }

    const { merchantId, merchantAutoDiscovered } = await autoDiscoverMerchantId(apiToken, rawMerchantId);
    const { baseUrl, activeEnv } = await findActiveCloverEnvironment(apiToken, merchantId);

    if (!baseUrl) {
      return Response.json({
        success: false,
        connected: false,
        reason: 'Clover credentials did not authenticate against production or sandbox',
        token_source: tokenSource,
      });
    }

    const headers = { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json' };

    // READ-ONLY: fetch merchant info (no token in output).
    const merchantResp = await fetch(baseUrl, { headers });
    const merchantInfo = merchantResp.ok ? await merchantResp.json() : {};

    // READ-ONLY: paginate all items for total count + field analysis.
    let allItems = [];
    let offset = 0;
    const limit = 200;
    while (true) {
      const url = `${baseUrl}/items?limit=${limit}&offset=${offset}&expand=categories`;
      const resp = await fetch(url, { headers });
      if (!resp.ok) {
        return Response.json({
          success: false,
          connected: true,
          reason: `Clover /items returned ${resp.status}`,
        });
      }
      const data = await resp.json();
      const items = data.elements || [];
      allItems = allItems.concat(items);
      if (items.length < limit) break;
      offset += limit;
      if (offset > 30000) break; // hard safety cap
    }

    // READ-ONLY: stock availability.
    let stockAvailable = false;
    let stockCount = 0;
    try {
      const stockResp = await fetch(`${baseUrl}/item_stocks?limit=1000`, { headers });
      if (stockResp.ok) {
        stockAvailable = true;
        const stockData = await stockResp.json();
        stockCount = (stockData.elements || []).length;
      }
    } catch (_) { /* stock endpoint optional */ }

    // Field availability analysis (across all fetched items).
    const withName = allItems.filter(i => i.name && i.name.trim()).length;
    const withCode = allItems.filter(i => i.code && String(i.code).trim()).length;
    const withSku = allItems.filter(i => i.sku && String(i.sku).trim()).length;
    const withPrice = allItems.filter(i => i.price !== undefined && i.price !== null).length;
    const withCategories = allItems.filter(i => i.categories?.elements?.length > 0).length;
    const withUnitName = allItems.filter(i => i.unitName && String(i.unitName).trim()).length;
    const hiddenCount = allItems.filter(i => i.hidden === true).length;

    // Sanitized samples — only safe fields, never tokens/credentials.
    const samples = allItems.slice(0, 3).map(i => ({
      clover_item_id: i.id,
      name: i.name,
      code: i.code || null,
      sku: i.sku || null,
      price: i.price !== undefined ? i.price / 100 : null,
      price_type: i.priceType || null,
      unit_name: i.unitName || null,
      hidden: !!i.hidden,
      categories: (i.categories?.elements || []).map(c => c.name).filter(Boolean),
    }));

    return Response.json({
      success: true,
      connected: true,
      store: { id: storeId, name: store.name },
      clover: {
        merchant_id: merchantId,
        merchant_auto_discovered: merchantAutoDiscovered,
        environment: activeEnv,
        token_source: tokenSource,
        merchant_name: merchantInfo.name || null,
      },
      inventory: {
        total_items: allItems.length,
        items_with_name: withName,
        items_with_code: withCode,
        items_with_sku: withSku,
        items_with_price: withPrice,
        items_with_categories: withCategories,
        items_with_unit_name: withUnitName,
        hidden_items: hiddenCount,
      },
      stock: {
        endpoint_available: stockAvailable,
        stock_records: stockCount,
      },
      field_assessment: {
        provides_real_names: withName > 0,
        provides_sku_or_upc: withCode > 0 || withSku > 0,
        provides_prices: withPrice > 0,
        provides_categories: withCategories > 0,
        provides_stock_quantities: stockAvailable && stockCount > 0,
      },
      samples,
    });
  } catch (error) {
    // Never log credentials. Only the error message.
    console.error('[clover-test] error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}