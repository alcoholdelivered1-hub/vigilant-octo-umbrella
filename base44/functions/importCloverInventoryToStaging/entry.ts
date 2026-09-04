/**
 * importCloverInventoryToStaging
 * Admin-only. Pulls Beverage King's real inventory from Clover (READ from POS) and
 * loads it into the SEPARATE CloverInventoryStaging entity — never the live Product
 * catalog. Batched (500), validated, store-isolated, deduped by clover_item_id,
 * per-batch retry, full progress report. Idempotent/resumable: re-running updates
 * existing staged rows instead of duplicating, so a timeout can be safely resumed.
 *
 * Clover credentials come exclusively from backend secrets / StorePosCredential —
 * never placed in the response or logs.
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
import { inferCategory } from '../../shared/cloverInventoryMapping.ts';

const BATCH_SIZE = 500;
const MAX_RETRIES = 3;

async function bulkWithRetry(fn, items, label, batchErrors) {
  let failed = 0;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const slice = items.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    let attempt = 0;
    while (attempt < MAX_RETRIES) {
      try {
        await fn(slice);
        break;
      } catch (e) {
        attempt++;
        console.error(`[clover-staging] ${label} batch ${batchNum} attempt ${attempt} failed: ${e.message}`);
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, 1000 * attempt));
        } else {
          batchErrors.push(`${label} batch ${batchNum} (${slice.length} items): ${e.message}`);
          failed++;
        }
      }
    }
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

    const body = await req.json().catch(() => ({}));
    const storeId = body.store_id || BEVERAGE_KING_STORE_ID;
    const store = await base44.asServiceRole.entities.Store.get(storeId);

    // Credentials from secrets only — never echoed.
    const { apiToken, merchantId: rawMerchantId, tokenSource } = await resolveCloverCredentials(base44, storeId);
    if (!apiToken) {
      return Response.json({ success: false, reason: 'No Clover API token configured', token_source: tokenSource });
    }
    const { merchantId } = await autoDiscoverMerchantId(apiToken, rawMerchantId);
    const { baseUrl, activeEnv } = await findActiveCloverEnvironment(apiToken, merchantId);
    if (!baseUrl) {
      return Response.json({ success: false, reason: 'Clover credentials did not authenticate' });
    }
    const headers = { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json' };

    // Pull all items from Clover (read-only on POS).
    let allItems = [];
    let offset = 0;
    while (true) {
      const url = `${baseUrl}/items?limit=200&offset=${offset}&expand=categories`;
      const resp = await fetch(url, { headers });
      if (!resp.ok) {
        return Response.json({ success: false, reason: `Clover /items returned ${resp.status}` });
      }
      const items = (await resp.json()).elements || [];
      allItems = allItems.concat(items);
      if (items.length < 200) break;
      offset += 200;
      if (offset > 30000) break;
    }
    console.log(`[clover-staging] fetched ${allItems.length} items from Clover ${activeEnv}`);

    // Stock map.
    const stockMap = {};
    try {
      const stockResp = await fetch(`${baseUrl}/item_stocks?limit=1000`, { headers });
      if (stockResp.ok) {
        (await stockResp.json()).elements.forEach(s => {
          if (s.item?.id) stockMap[s.item.id] = s.quantity;
        });
      }
    } catch (_) { /* optional */ }

    // Existing staged records for THIS store only (store isolation + dedup source).
    const existingStaged = [];
    let skip = 0;
    while (true) {
      const batch = await base44.asServiceRole.entities.CloverInventoryStaging.filter(
        { store_id: storeId }, 'name', 500, skip
      );
      existingStaged.push(...batch);
      if (batch.length < 500) break;
      skip += 500;
      if (skip > 30000) break;
    }
    const stagedByCloverId = {};
    for (const s of existingStaged) stagedByCloverId[`${storeId}|${s.clover_item_id}`] = s;
    console.log(`[clover-staging] ${existingStaged.length} existing staged rows`);

    const now = new Date().toISOString();
    const validationErrors = [];
    const creates = [];
    const updates = [];
    const seenInRun = new Set();
    let skippedUnchanged = 0;

    for (const item of allItems) {
      const cloverId = item.id;
      const name = (item.name || '').trim();
      if (!cloverId) { validationErrors.push('Item missing clover id — skipped'); continue; }
      if (!name) { validationErrors.push(`Clover item ${cloverId}: missing name — skipped`); continue; }

      const key = `${storeId}|${cloverId}`;
      if (seenInRun.has(key)) { validationErrors.push(`Duplicate Clover item ${cloverId} in feed — skipped`); continue; }
      seenInRun.add(key);

      const sku = (item.sku && String(item.sku).trim()) || (item.code && String(item.code).trim()) || '';
      const price = item.price !== undefined && item.price !== null ? item.price / 100 : null;
      if (price === null || price < 0) { validationErrors.push(`Clover item ${cloverId} ("${name}"): invalid price — skipped`); continue; }

      const stockQty = stockMap[cloverId] !== undefined ? stockMap[cloverId] : null;
      const cloverCats = (item.categories?.elements || []).map(c => c.name).filter(Boolean).join(', ');
      const hidden = !!item.hidden;

      const existing = stagedByCloverId[key];
      const stagedFields = {
        name,
        sku: sku || null,
        code: item.code || null,
        brand: '',
        category: inferCategory(item),
        clover_categories: cloverCats || null,
        price,
        price_type: item.priceType || null,
        unit_name: item.unitName || null,
        pack_size: 'Single',
        stock_quantity: stockQty,
        in_stock: !hidden,
        hidden,
        imported_at: now,
      };

      if (existing) {
        const changes = { id: existing.id };
        for (const [k, v] of Object.entries(stagedFields)) {
          if (existing[k] !== v) changes[k] = v;
        }
        if (Object.keys(changes).length > 1) updates.push(changes);
        else skippedUnchanged++;
      } else {
        creates.push({ clover_item_id: cloverId, store_id: storeId, store_name: store.name, ...stagedFields });
      }
    }

    console.log(`[clover-staging] creates=${creates.length} updates=${updates.length} unchanged=${skippedUnchanged} invalid=${validationErrors.length}`);

    const batchErrors = [];
    const failedCreate = await bulkWithRetry(
      (slice) => base44.asServiceRole.entities.CloverInventoryStaging.bulkCreate(slice),
      creates, 'create', batchErrors
    );
    const failedUpdate = await bulkWithRetry(
      (slice) => base44.asServiceRole.entities.CloverInventoryStaging.bulkUpdate(slice),
      updates, 'update', batchErrors
    );

    return Response.json({
      success: true,
      store: { id: storeId, name: store.name },
      clover: { merchant_id: merchantId, environment: activeEnv, items_fetched: allItems.length },
      staging: {
        created: Math.max(0, creates.length - failedCreate * BATCH_SIZE),
        updated: Math.max(0, updates.length - failedUpdate * BATCH_SIZE),
        unchanged: skippedUnchanged,
        invalid: validationErrors.length,
        total_staged_now: existingStaged.length + creates.length,
      },
      batches: {
        size: BATCH_SIZE,
        create_batches: Math.ceil(creates.length / BATCH_SIZE),
        update_batches: Math.ceil(updates.length / BATCH_SIZE),
        failed: failedCreate + failedUpdate,
      },
      resume_safe: true,
      errors: validationErrors.slice(0, 50),
      batch_errors: batchErrors,
      live_catalog_untouched: true,
    });
  } catch (error) {
    console.error('[clover-staging] fatal:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}