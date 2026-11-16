import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { encryptToken, getCityHiveConnection, fetchCityHiveProducts, mapCityHiveProduct } from '../../shared/cityHiveConnection.ts';
import { assertStoreAccess } from '../../shared/authGuard.ts';

export default async function(req) {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { store_id, action } = body;

    if (!store_id) return Response.json({ error: 'store_id is required' }, { status: 400 });

    // Storing a CityHive token and replacing a store's catalog are privileged actions:
    // only an admin or a contact on that specific store may call this endpoint.
    const access = await assertStoreAccess(base44, store_id);
    if (!access.authorized) return access.response;

    // --- Save connection (store the API token) ---
    if (action === 'connect') {
      const { api_token, merchant_name } = body;
      if (typeof api_token !== 'string' || api_token.length < 10 || api_token.length > 4096) {
        return Response.json({ error: 'A valid CityHive API token is required' }, { status: 400 });
      }

      // Remove any existing connection for this store
      const existing = await base44.asServiceRole.entities.CityHiveConnection.filter({ store_id });
      for (const conn of existing) {
        await base44.asServiceRole.entities.CityHiveConnection.delete(conn.id);
      }

      const encrypted = await encryptToken(api_token);
      const connection = await base44.asServiceRole.entities.CityHiveConnection.create({
        store_id,
        merchant_name: merchant_name || '',
        encrypted_api_token: encrypted.encrypted,
        api_token_iv: encrypted.iv,
        status: 'connected',
        connected_at: new Date().toISOString(),
      });

      return Response.json({ success: true, connection_id: connection.id, status: 'connected' });
    }

    // --- Check connection status ---
    if (action === 'status') {
      const connections = await base44.asServiceRole.entities.CityHiveConnection.filter({ store_id });
      const conn = connections[0];
      if (!conn || conn.status !== 'connected') {
        return Response.json({ status: 'disconnected' });
      }
      return Response.json({
        status: 'connected',
        connection_id: conn.id,
        merchant_name: conn.merchant_name || '',
        last_synced_at: conn.last_synced_at || null,
        last_sync_count: conn.last_sync_count ?? null,
        last_sync_error: conn.last_sync_error || null,
      });
    }

    // --- Disconnect ---
    if (action === 'disconnect') {
      const existing = await base44.asServiceRole.entities.CityHiveConnection.filter({ store_id });
      for (const conn of existing) {
        await base44.asServiceRole.entities.CityHiveConnection.update(conn.id, { status: 'disconnected' });
      }
      return Response.json({ success: true, status: 'disconnected' });
    }

    // --- Sync inventory ---
    if (action === 'sync' || !action) {
      const { connection, apiToken } = await getCityHiveConnection(base44, store_id);

      let products;
      try {
        products = await fetchCityHiveProducts(apiToken);
      } catch (error) {
        await base44.asServiceRole.entities.CityHiveConnection.update(connection.id, {
          last_synced_at: new Date().toISOString(),
          last_sync_error: error.message,
        });
        return Response.json({ error: error.message }, { status: 502 });
      }

      if (!Array.isArray(products) || products.length === 0) {
        await base44.asServiceRole.entities.CityHiveConnection.update(connection.id, {
          last_synced_at: new Date().toISOString(),
          last_sync_count: 0,
          last_sync_error: null,
        });
        return Response.json({ success: true, synced: 0, message: 'No products found in CityHive inventory' });
      }

      // Fetch existing products for this store to update by external_id
      const existingProducts = await base44.asServiceRole.entities.Product.filter({ store_id });
      const productMap = new Map();
      for (const p of existingProducts) {
        if (p.external_id) productMap.set(p.external_id, p);
      }

      const toCreate = [];
      const toUpdate = [];
      for (const item of products) {
        const mapped = mapCityHiveProduct(item, store_id);
        if (!mapped.external_id) continue;
        const existing = productMap.get(mapped.external_id);
        if (existing) {
          toUpdate.push({ id: existing.id, ...mapped });
        } else {
          toCreate.push(mapped);
        }
      }

      // Bulk operations
      let created = 0;
      let updated = 0;
      if (toCreate.length > 0) {
        const batches = [];
        for (let i = 0; i < toCreate.length; i += 100) {
          batches.push(toCreate.slice(i, i + 100));
        }
        for (const batch of batches) {
          const result = await base44.asServiceRole.entities.Product.bulkCreate(batch);
          created += batch.length;
        }
      }
      if (toUpdate.length > 0) {
        const batches = [];
        for (let i = 0; i < toUpdate.length; i += 100) {
          batches.push(toUpdate.slice(i, i + 100));
        }
        for (const batch of batches) {
          await base44.asServiceRole.entities.Product.bulkUpdate(batch);
          updated += batch.length;
        }
      }

      await base44.asServiceRole.entities.CityHiveConnection.update(connection.id, {
        last_synced_at: new Date().toISOString(),
        last_sync_count: created + updated,
        last_sync_error: null,
      });

      return Response.json({
        success: true,
        synced: created + updated,
        created,
        updated,
        total_products: products.length,
      });
    }

    return Response.json({ error: 'Invalid action. Use: connect, disconnect, or sync' }, { status: 400 });
  } catch (error) {
    console.error('CityHive sync error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}