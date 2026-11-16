import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';
import { encryptToken, getCloverClient } from '../../shared/cloverConnection.ts';

const storeId = '6a32d14d09b760f592dbf19e';
const expectedMerchantId = 'YJSBZTD0WJ201';

function categoryFor(name = '') {
  const value = name.toLowerCase();
  if (/beer|lager|ale|ipa|seltzer|cider/.test(value)) return 'beer';
  if (/wine|champagne|prosecco|merlot|cabernet|chardonnay/.test(value)) return 'wine';
  if (/mixer|soda|juice|tonic|water/.test(value)) return 'mixers';
  if (/glass|opener|corkscrew|bag|ice/.test(value)) return 'accessories';
  return 'spirits';
}

export default async function(req) {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const isStoreOwner = user.email?.toLowerCase() === 'bevking71603@gmail.com';
    if (user.role !== 'admin' && !isStoreOwner) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const { action, merchantId, apiToken } = await req.json();

    // Manual token entry and credential clearing remain admin-only fallbacks.
    if ((action === 'connect' || action === 'clear') && user.role !== 'admin') {
      return Response.json({ error: 'Admin access required for this action.' }, { status: 403 });
    }

    if (action === 'clear') {
      await base44.asServiceRole.entities.CloverConnection.deleteMany({ store_id: storeId });
      return Response.json({ success: true, message: 'Stored Clover credential cleared.' });
    }

    if (action === 'connect') {
      if (merchantId !== expectedMerchantId) return Response.json({ error: `Merchant ID must be ${expectedMerchantId}.` }, { status: 400 });
      // Allow the admin to pass an API token in the request, or fall back to the
      // stored CLOVER_API_TOKEN secret so the connection can be established
      // without the credential transiting the request body.
      const resolvedToken = apiToken?.trim() || secrets.get('CLOVER_API_TOKEN') || '';
      if (!resolvedToken) return Response.json({ error: 'Clover API token is required.' }, { status: 400 });
      const merchantResponse = await fetch(`https://api.clover.com/v3/merchants/${merchantId}`, {
        headers: { Authorization: `Bearer ${resolvedToken}`, Accept: 'application/json' },
      });
      const merchant = await merchantResponse.json();
      if (!merchantResponse.ok) return Response.json({ error: merchant.message || 'Clover rejected this API token.' }, { status: 400 });
      if (!/beverage king/i.test(merchant.name || '')) return Response.json({ error: `This token belongs to ${merchant.name || 'another merchant'}, not Beverage King.` }, { status: 400 });
      const encrypted = await encryptToken(resolvedToken);
      const refresh = await encryptToken(resolvedToken);
      const data = {
        store_id: storeId, merchant_id: merchantId, merchant_name: merchant.name,
        encrypted_access_token: encrypted.encrypted, access_token_iv: encrypted.iv,
        encrypted_refresh_token: refresh.encrypted, refresh_token_iv: refresh.iv,
        status: 'connected', connected_at: new Date().toISOString(),
      };
      const existing = await base44.asServiceRole.entities.CloverConnection.filter({ store_id: storeId });
      if (existing[0]) await base44.asServiceRole.entities.CloverConnection.update(existing[0].id, data);
      else await base44.asServiceRole.entities.CloverConnection.create(data);
      return Response.json({ success: true, message: `Connected to ${merchant.name}.` });
    }

    if (action === 'sync') {
      const clover = await getCloverClient(base44, storeId);
      if (clover.merchantId !== expectedMerchantId || !/beverage king/i.test(clover.merchantName || '')) {
        return Response.json({ error: 'The stored Clover credential is not for Beverage King.' }, { status: 400 });
      }

      // Read every Clover catalog page. Stop if Clover returns a short page or
      // ignores the offset, so a malformed response cannot loop forever.
      const items = [];
      const seenItemIds = new Set();
      for (let offset = 0; offset < 50000; offset += 1000) {
        const response = await fetch(
          `${clover.origin}/v3/merchants/${clover.merchantId}/items?limit=1000&offset=${offset}`,
          { headers: clover.headers },
        );
        const catalog = await response.json();
        if (!response.ok) return Response.json({ error: catalog.message || 'Unable to read the Clover catalog.' }, { status: 400 });
        const page = Array.isArray(catalog.elements) ? catalog.elements : [];
        const before = items.length;
        for (const item of page) {
          if (!item?.id || seenItemIds.has(item.id)) continue;
          seenItemIds.add(item.id);
          items.push(item);
        }
        if (page.length < 1000 || items.length === before) break;
      }
      if (!items.length) return Response.json({ error: 'Clover returned no accessible inventory items.' }, { status: 400 });

      // Base44 entity reads cap at 5,000, so page through all existing records.
      const existing = [];
      for (let skip = 0; ; skip += 5000) {
        const page = await base44.asServiceRole.entities.Product.filter({ store_id: storeId }, 'name', 5000, skip);
        existing.push(...page);
        if (page.length < 5000) break;
      }

      const byExternalId = new Map(existing.filter((product) => product.external_id).map((product) => [product.external_id, product]));
      const byName = new Map(existing.map((product) => [product.name.toLowerCase(), product]));
      const syncTime = new Date().toISOString();
      const matchedIds = new Set();
      const creates = [];
      const updates = [];

      for (const item of items) {
        if (!item.name) continue;
        const price = Number(item.price || 0) / 100;
        const product = {
          name: item.name,
          category: categoryFor(item.name),
          price,
          store_id: storeId,
          in_stock: price > 0 && item.available !== false && item.hidden !== true,
          external_id: item.id,
          sku: item.sku || '',
          upc: item.code || item.upc || '',
          inventory_source: 'clover',
          last_synced_at: syncTime,
        };
        const match = byExternalId.get(item.id) || byName.get(item.name.toLowerCase());
        if (match) {
          matchedIds.add(match.id);
          updates.push({ id: match.id, ...product });
        } else {
          creates.push(product);
        }
      }

      // Anything not returned by Beverage King's current Clover catalog is not
      // orderable. This prevents the old generic catalog from being sold.
      const stale = existing
        .filter((product) => !matchedIds.has(product.id) && product.in_stock !== false)
        .map((product) => ({ id: product.id, in_stock: false }));

      for (let index = 0; index < creates.length; index += 500) {
        await base44.asServiceRole.entities.Product.bulkCreate(creates.slice(index, index + 500));
      }
      for (let index = 0; index < updates.length; index += 500) {
        await base44.asServiceRole.entities.Product.bulkUpdate(updates.slice(index, index + 500));
      }
      for (let index = 0; index < stale.length; index += 500) {
        await base44.asServiceRole.entities.Product.bulkUpdate(stale.slice(index, index + 500));
      }

      return Response.json({
        success: true,
        message: `Synced ${creates.length + updates.length} verified Clover items and hid ${stale.length} stale items.`,
        created: creates.length,
        updated: updates.length,
        deactivated: stale.length,
      });
    }

    return Response.json({ error: 'Unknown action.' }, { status: 400 });
  } catch (error) {
    console.error('Beverage King Clover management error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}