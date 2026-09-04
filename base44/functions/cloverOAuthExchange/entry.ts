import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { verifyCloverMerchantAccess } from '../../shared/cloverCredentials.ts';

const BEVERAGE_KING_STORE_ID = '6a32d14d09b760f592dbf19e';
// The platform's own Clover app client_id. Tokens minted through THIS app are
// scoped to the platform merchant ("Alcohol Delivered LLC") — they can never be
// scoped to Beverage King's merchant. Beverage King must authorize its OWN
// Clover app. (Retailers connecting their own merchant via the platform app is
// fine — only Beverage King is restricted because it must route to its own POS.)
const PLATFORM_CLOVER_APP_ID = '0669dc706397718d01b810c1eb52a7f4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { code } = body;

    // Resolve the App ID: the retailer page sends it in the body (it must match
    // the client_id used in the authorize URL); fall back to the platform secret
    // from env if absent.
    let app_id = (body.app_id || Deno.env.get('CLOVER_APP_ID') || '').trim();

    // Resolve the App Secret: admins may pass it in the body (legacy path);
    // otherwise use the platform secret from env so the retailer self-serve
    // flow never receives or transmits the client secret.
    let app_secret = body.app_secret;
    if (!app_secret) {
      app_secret = (Deno.env.get('CLOVER_APP_SECRET') || '').trim();
    }

    // Authorize + scope the target store. Admins may target any store; a store
    // owner may only connect their own store (matched by email), and any
    // store_id in the body is ignored to prevent cross-store token writes.
    let sid = body.store_id || BEVERAGE_KING_STORE_ID;
    if (user.role !== 'admin') {
      const owned = await base44.asServiceRole.entities.Store.filter({ email: user.email });
      if (!owned.length) {
        return Response.json({ error: 'Forbidden: no store linked to your account' }, { status: 403 });
      }
      sid = owned[0].id;
    }

    if (!app_id || !app_secret || !code) {
      return Response.json({ error: 'Missing app_id, app_secret, or code' }, { status: 400 });
    }

    // Exchange the authorization code for an access token using the v2 OAuth flow.
    // Clover apps created after Oct 2023 require the v2 flow; the legacy v1 flow
    // (GET /oauth/token) returns 401 for these apps.
    const tokenResp = await fetch('https://api.clover.com/oauth/v2/token', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ client_id: app_id, client_secret: app_secret, code }),
    });

    if (!tokenResp.ok) {
      const errText = await tokenResp.text();
      console.error('Clover OAuth v2 exchange failed:', tokenResp.status, errText);
      return Response.json({
        error: `Clover OAuth v2 exchange failed (${tokenResp.status})`,
        details: errText,
      }, { status: 502 });
    }

    const tokenData = await tokenResp.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token || '';

    if (!accessToken) {
      return Response.json({ error: 'No access_token in Clover response', details: tokenData }, { status: 502 });
    }

    const isBeverageKing = sid === BEVERAGE_KING_STORE_ID;

    // Beverage King must NEVER be connected with the platform's own Clover app —
    // tokens from that app are scoped to "Alcohol Delivered LLC", which is the
    // exact bug blocking go-live. Reject it up front with a clear instruction.
    if (isBeverageKing && app_id === PLATFORM_CLOVER_APP_ID) {
      return Response.json({
        error: 'Wrong Clover app — this is the platform\'s app (Alcohol Delivered LLC), which can only connect to the platform merchant.',
        reason: 'beverage_king_requires_own_app',
        fix: 'Beverage King must create its own app in the Clover Developer Dashboard (under the Beverage King merchant), enable INVENTORY + ORDERS permissions, then authorize using THAT app\'s Client ID. Enter that Client ID in Step 1 and re-authorize.',
      }, { status: 400 });
    }

    // Save the OAuth access token + app credentials directly to this store's
    // StorePosCredential record. Trust the merchant_id Clover returns from the
    // OAuth flow — that IS the merchant the user just authorized, so it is by
    // definition correct. (The previous hardcoded sandbox-UUID guard rejected
    // valid production re-authorizations, which is why Beverage King OAuth kept
    // failing.)
    // The v2 token response does NOT include merchant_id — it arrives in the
    // OAuth redirect query (?merchant_id=...), which the frontend relays here.
    // (Legacy v1 responses included merchant_id in the token JSON; kept as fallback.)
    let returnedMerchantId = body.merchant_id || tokenData.merchant_id || '';

    // If Clover didn't hand us a merchant_id, discover the merchant this token
    // is actually scoped to via /merchants/current (prod, then sandbox).
    if (!returnedMerchantId) {
      for (const base of ['https://api.clover.com/v3/merchants/current', 'https://sandbox.dev.clover.com/v3/merchants/current']) {
        try {
          const r = await fetch(base, { headers: { Authorization: `Bearer ${accessToken}` } });
          if (r.ok) {
            const m = await r.json();
            if (m?.id) { returnedMerchantId = m.id; break; }
          }
        } catch (_) { /* try next environment */ }
      }
    }

    if (!returnedMerchantId) {
      return Response.json({
        error: 'Clover did not return a merchant_id — cannot save credential without a target merchant',
      }, { status: 400 });
    }

    const cred = (await base44.asServiceRole.entities.StorePosCredential.filter({ store_id: sid }))[0];
    let store = null;
    try { store = await base44.asServiceRole.entities.Store.get(sid); } catch (_) { /* optional */ }

    // NOTE: we intentionally do NOT compare against any previously stored
    // merchant_id here. The stored credential may be poisoned with the
    // platform's merchant (Alcohol Delivered LLC) — which is exactly what this
    // re-authorization is fixing. Merchant correctness is enforced below by
    // verifying the token and matching the merchant NAME to the store name.

    // Read-only verification of the freshly exchanged token BEFORE marking the
    // store configured. Confirms the token authenticates for the returned
    // merchant, can read inventory + orders, and the merchant name matches the
    // store. is_configured is set true ONLY when this verification passes.
    const expectedName = store?.name || (isBeverageKing ? 'BEVERAGE KING' : (cred?.store_name || ''));
    const verify = await verifyCloverMerchantAccess(accessToken, returnedMerchantId, expectedName);

    // FINAL GUARD for Beverage King: refuse to save a token whose merchant name
    // doesn't match Beverage King (e.g. "Alcohol Delivered LLC"). The error tells
    // the operator exactly which merchant authorized so they can re-do OAuth
    // logged into the correct Clover account.
    if (isBeverageKing && !verify.nameMatch) {
      return Response.json({
        error: `Wrong Clover merchant authorized: "${verify.merchantName || 'unknown'}" — expected "Beverage King". Credential NOT saved.`,
        reason: 'wrong_merchant',
        authorized_merchant_name: verify.merchantName || null,
        authorized_merchant_id: returnedMerchantId,
        fix: 'Sign out of Clover, then re-run Step 1 and log in as the BEVERAGE KING merchant (use Beverage King\'s own Clover app Client ID). After "Allow", the merchant name must be Beverage King.',
      }, { status: 409 });
    }

    // SECURITY: the Clover App Secret (client secret) is used only to exchange
    // the authorization code for an access token. It is NEVER persisted —
    // persisting it would expose the platform's app secret to any retailer via
    // the StorePosCredential entity (whose RLS lets a store owner read their own
    // credential record). Only the merchant's access token + app id are stored.
    const payload = {
      store_id: sid,
      store_name: store?.name || (isBeverageKing ? 'BEVERAGE KING' : (cred?.store_name || '')),
      store_email: store?.email || (isBeverageKing ? 'bevking71603@gmail.com' : (cred?.store_email || '')),
      pos_system: 'clover',
      merchant_id: returnedMerchantId,
      api_token: accessToken,
      // Keep the v2 refresh token separate from retailer-editable API secrets.
      refresh_token: refreshToken,
      app_id,
      environment: verify.environment || 'production',
      is_configured: verify.ok,
      notes: verify.ok
        ? `Verified via OAuth — merchant: ${verify.merchantName}, env: ${verify.environment}, items: ${verify.inventoryCount}, orders: ${verify.ordersCount}, perms: ${verify.permissions.join(', ')}`
        : `OAuth token saved but NOT verified — ${verify.reason}`,
    };

    if (cred) {
      await base44.asServiceRole.entities.StorePosCredential.update(cred.id, payload);
    } else {
      await base44.asServiceRole.entities.StorePosCredential.create(payload);
    }

    return Response.json({
      success: true,
      verified: verify.ok,
      is_configured: verify.ok,
      access_token_preview: accessToken.substring(0, 8) + '...' + accessToken.substring(accessToken.length - 4),
      merchant_id: payload.merchant_id,
      merchant_name: verify.merchantName,
      environment: verify.environment,
      inventory_read: verify.inventoryRead,
      inventory_count: verify.inventoryCount,
      orders_read: verify.ordersRead,
      orders_count: verify.ordersCount,
      orders_write: verify.ordersWrite,
      name_match: verify.nameMatch,
      permissions: verify.permissions,
      verification_reason: verify.reason,
    });
  } catch (error) {
    console.error('cloverOAuthExchange error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});