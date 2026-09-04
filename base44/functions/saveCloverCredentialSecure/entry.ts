/**
 * saveCloverCredentialSecure
 * Admin-only. Securely accepts a fresh merchant-scoped Clover API token for a
 * store, runs READ-ONLY verification against Clover (merchant lookup, first 10
 * inventory items, recent orders, granted permissions, merchant-name match),
 * and persists the credential with is_configured = true ONLY when verification
 * passes. The token is never logged, never returned in the response, and never
 * exposed to the frontend beyond this single HTTPS call.
 *
 * POST body: { store_id, merchant_id, api_token, environment? }
 *
 * Never creates an order, charges a card, refunds, alerts a driver, or sends
 * email. Never echoes the token back.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { verifyCloverMerchantAccess } from '../../shared/cloverCredentials.ts';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const store_id = (body.store_id || '').trim();
    const merchant_id = String(body.merchant_id || '').trim();
    const api_token = String(body.api_token || '').trim();
    const environment = (body.environment || 'production').trim();

    if (!store_id || !merchant_id || !api_token) {
      return Response.json({ error: 'store_id, merchant_id, and api_token are required' }, { status: 400 });
    }

    const store = await base44.asServiceRole.entities.Store.get(store_id);
    if (!store) {
      return Response.json({ error: 'Store not found' }, { status: 404 });
    }

    // Read-only verification — no writes, no order creation.
    const verify = await verifyCloverMerchantAccess(api_token, merchant_id, store.name);

    if (!verify.ok) {
      // Do NOT persist an unverified token — preserve any existing credential.
      return Response.json({
        success: false,
        verified: false,
        is_configured: false,
        merchant_name: verify.merchantName,
        merchant_id,
        environment: verify.environment,
        inventory_read: verify.inventoryRead,
        inventory_count: verify.inventoryCount,
        orders_read: verify.ordersRead,
        orders_count: verify.ordersCount,
        orders_write: verify.ordersWrite,
        name_match: verify.nameMatch,
        permissions: verify.permissions,
        reason: verify.reason,
      }, { status: 422 });
    }

    // Verification passed — persist the token (server-side only).
    const cred = (await base44.asServiceRole.entities.StorePosCredential.filter({ store_id }))[0];
    const payload = {
      store_id,
      store_name: store.name,
      store_email: store.email,
      pos_system: 'clover',
      merchant_id,
      api_token,
      // Preserve a server-managed OAuth refresh token, migrating records that
      // predate the dedicated field. Never return it to the client.
      refresh_token: cred?.refresh_token || cred?.api_secret || '',
      api_secret: '',
      app_id: cred?.app_id || (Deno.env.get('CLOVER_APP_ID') || '').trim(),
      environment: verify.environment || environment,
      is_configured: true,
      notes: `Verified by admin manual entry — merchant: ${verify.merchantName}, env: ${verify.environment}, items: ${verify.inventoryCount}, orders: ${verify.ordersCount}, perms: ${verify.permissions.join(', ')}`,
    };

    if (cred) {
      await base44.asServiceRole.entities.StorePosCredential.update(cred.id, payload);
    } else {
      await base44.asServiceRole.entities.StorePosCredential.create(payload);
    }

    // Return verification results — NEVER the token.
    return Response.json({
      success: true,
      verified: true,
      is_configured: true,
      token_source: 'retailer credential (admin manual entry)',
      merchant_name: verify.merchantName,
      merchant_id,
      environment: verify.environment,
      inventory_read: verify.inventoryRead,
      inventory_count: verify.inventoryCount,
      orders_read: verify.ordersRead,
      orders_count: verify.ordersCount,
      orders_write: verify.ordersWrite,
      name_match: verify.nameMatch,
      permissions: verify.permissions,
      reason: verify.reason,
    });
  } catch (error) {
    // Never log the token — only the error message.
    console.error('saveCloverCredentialSecure error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}