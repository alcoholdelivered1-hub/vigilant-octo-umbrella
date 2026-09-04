import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import {
  resolveCloverCredentials,
  assertMerchantScopedToken,
  BEVERAGE_KING_STORE_ID,
} from '../../shared/cloverCredentials.ts';
import { inferCategory } from '../../shared/cloverInventoryMapping.ts';

// Beverage King's Clover merchant credentials must be established through the
// retailer's OAuth approval. Never use the shared platform environment token.
const AUTHORIZE_URL = '/admin/beverage-king-clover';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // Allow both manual admin invocation and scheduled (no-user) execution
    let user = null;
    try { user = await base44.auth.me(); } catch (_) { /* scheduled run — no user */ }
    if (user && user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const storeId = body.store_id || BEVERAGE_KING_STORE_ID;

    // Merchant-scoped credentials ONLY — never fall back to the shared env token
    // (CLOVER_API_TOKEN / CLOVER_MERCHANT_ID), which belongs to a different
    // merchant and produces 401 Unauthorized against Beverage King's merchant.
    const { apiToken, merchantId, tokenSource } =
      await resolveCloverCredentials(base44, storeId, { noEnvFallback: true });

    if (!apiToken || !merchantId) {
      return Response.json({
        error: 'Beverage King is not authorized with Clover. A merchant-specific OAuth token is required.',
        action: 'authorize',
        authorize_label: 'Authorize Beverage King with Clover',
        authorize_url: AUTHORIZE_URL,
        store_id: storeId,
        token_source: tokenSource,
        merchant_scoped_auth: false,
      }, { status: 401 });
    }

    // Verify the token actually authenticates for this merchant — refuses to
    // import inventory from any other merchant account.
    const auth = await assertMerchantScopedToken(apiToken, merchantId);
    if (!auth.ok) {
      return Response.json({
        error: "Beverage King's Clover token is missing or invalid. Re-authorize with Clover.",
        action: 'authorize',
        authorize_label: 'Authorize Beverage King with Clover',
        authorize_url: AUTHORIZE_URL,
        store_id: storeId,
        merchant_id: merchantId,
        merchant_scoped_auth: false,
        reason: auth.reason,
        clover_response_status: auth.clover_response_status ?? null,
      }, { status: 401 });
    }

    // Wrong-merchant guard: the stored credential may authenticate fine but be
    // scoped to a DIFFERENT merchant (e.g. the platform's "Alcohol Delivered LLC"
    // saved to Beverage King by setupBeverageKingPayouts). Never import another
    // merchant's catalog — require the merchant name to match the store name.
    const store = await base44.asServiceRole.entities.Store.get(storeId).catch(() => null);
    if (store?.name && auth.merchantName) {
      const storeTokens = store.name.toLowerCase().split(/\s+/)
        .map((t) => t.replace(/[^a-z0-9]/g, '')).filter((t) => t.length >= 3);
      const mLower = auth.merchantName.toLowerCase();
      const nameOk = storeTokens.length === 0 || storeTokens.some((t) => mLower.includes(t));
      if (!nameOk) {
        return Response.json({
          error: `Credential is scoped to "${auth.merchantName}" — NOT "${store.name}". Refusing to sync the wrong merchant's inventory.`,
          action: 'authorize',
          authorize_label: 'Authorize Beverage King with Clover',
          authorize_url: AUTHORIZE_URL,
          store_id: storeId,
          merchant_id: merchantId,
          merchant_scoped_auth: false,
          authorized_merchant_name: auth.merchantName,
        }, { status: 409 });
      }
    }

    const baseUrl = `https://api.clover.com/v3/merchants/${merchantId}`;
    const headers = {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    };

    // Helper that maps a 401 on the items endpoint back to the authorize action
    // so callers always get a consistent "re-authorize" signal.
    const authorizeResponse = (stage) => Response.json({
      error: `Clover returned 401 during ${stage}. Beverage King's token is invalid — re-authorize.`,
      action: 'authorize',
      authorize_label: 'Authorize Beverage King with Clover',
      authorize_url: AUTHORIZE_URL,
      store_id: storeId,
      merchant_id: merchantId,
      merchant_scoped_auth: false,
    }, { status: 401 });

    // Fetch all items with pagination
    let allItems = [];
    let offset = 0;
    const limit = 200;
    while (true) {
      const url = `${baseUrl}/items?limit=${limit}&offset=${offset}&expand=categories`;
      const resp = await fetch(url, { headers });
      if (resp.status === 401) return authorizeResponse('item fetch');
      if (!resp.ok) {
        const text = await resp.text();
        return Response.json({ error: `Clover API error: ${resp.status}`, details: text }, { status: 502 });
      }
      const data = await resp.json();
      const items = data.elements || [];
      allItems = allItems.concat(items);
      if (items.length < limit) break;
      offset += limit;
      if (offset > 5000) break;
    }

    // Fetch all stock counts in one bulk call
    const stockMap = {};
    try {
      const stockResp = await fetch(`${baseUrl}/item_stocks?limit=1000`, { headers });
      if (stockResp.status !== 401 && stockResp.ok) {
        const stockData = await stockResp.json();
        (stockData.elements || []).forEach(s => {
          if (s.item && s.item.id) stockMap[s.item.id] = s.quantity;
        });
      }
    } catch (e) {
      console.log('Stock endpoint unavailable, skipping stock quantities');
    }

    // Get the store's email so new products carry store_email (RLS: store owner edit access)
    let storeEmail = null;
    try {
      const store = await base44.asServiceRole.entities.Store.get(storeId);
      storeEmail = store.email || null;
    } catch (_) { /* store lookup best-effort */ }

    // Get existing products for this store
    const existingProducts = await base44.asServiceRole.entities.Product.filter({ store_id: storeId });
    const productByName = {};
    existingProducts.forEach(p => {
      if (p.name) productByName[p.name.toLowerCase().trim()] = p;
    });

    let created = 0;
    let updated = 0;
    let unchanged = 0;
    const updates = [];
    const creates = [];

    for (const item of allItems) {
      const name = item.name?.trim();
      if (!name) continue;

      const inStock = !item.hidden;
      const price = item.price ? item.price / 100 : 0;
      const stockQty = stockMap[item.id] !== undefined ? stockMap[item.id] : null;

      const existing = productByName[name.toLowerCase()];

      if (existing) {
        const needsUpdate =
          existing.price !== price ||
          existing.in_stock !== inStock ||
          (stockQty !== null && existing.stock_quantity !== stockQty);
        if (needsUpdate) {
          updates.push({
            id: existing.id,
            price,
            in_stock: inStock,
            ...(stockQty !== null ? { stock_quantity: stockQty } : {}),
          });
        } else {
          unchanged++;
        }
      } else {
        creates.push({
          name,
          price,
          category: inferCategory(item),
          store_id: storeId,
          ...(storeEmail ? { store_email: storeEmail } : {}),
          in_stock: inStock,
          ...(stockQty !== null ? { stock_quantity: stockQty } : {}),
        });
      }
    }

    if (creates.length > 0) {
      await base44.asServiceRole.entities.Product.bulkCreate(creates);
      created = creates.length;
    }
    if (updates.length > 0) {
      await base44.asServiceRole.entities.Product.bulkUpdate(updates);
      updated = updates.length;
    }

    return Response.json({
      success: true,
      store_id: storeId,
      merchant_id: merchantId,
      merchant_scoped_auth: true,
      environment: auth.environment,
      merchant_name: auth.merchantName,
      clover_items_fetched: allItems.length,
      created,
      updated,
      unchanged,
      total_products: existingProducts.length + created,
    });
  } catch (error) {
    console.error('syncCloverInventory error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});