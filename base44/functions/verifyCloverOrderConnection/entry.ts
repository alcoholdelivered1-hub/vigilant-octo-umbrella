/**
 * verifyCloverOrderConnection
 * Admin-only, READ-ONLY. Confirms whether a merchant-specific Clover token is
 * configured for a store and actually authenticates against the store's own
 * merchant ID (not the platform account). Does NOT touch inventory or orders.
 *
 * POST body: { store_id?: string }  (defaults to Beverage King)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  BEVERAGE_KING_STORE_ID,
  resolveCloverCredentials,
  assertMerchantScopedToken,
} from '../../shared/cloverCredentials.ts';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    let storeId = body.store_id || BEVERAGE_KING_STORE_ID;
    // Store owners may verify only their own store; admins may target any.
    if (user.role !== 'admin') {
      const owned = await base44.asServiceRole.entities.Store.filter({ email: user.email });
      if (!owned.length) {
        return Response.json({ error: 'Forbidden: no store linked to your account' }, { status: 403 });
      }
      storeId = owned[0].id;
    }
    const store = await base44.asServiceRole.entities.Store.get(storeId);

    // Merchant-scoped verify: never fall back to the shared CLOVER_API_TOKEN env secret.
    const { apiToken, merchantId, tokenSource, credToken, credMerchantId } =
      await resolveCloverCredentials(base44, storeId, { noEnvFallback: true });

    if (!apiToken) {
      return Response.json({
        success: false,
        connected: false,
        ready_to_push: false,
        store: { id: storeId, name: store.name },
        configured_merchant_id: credMerchantId || null,
        token_source: tokenSource,
        reason: 'No merchant-scoped Clover token on file — re-authorize via cloverOAuthExchange (env fallback disabled).',
      });
    }

    // The merchant we WANT orders routed to = the store's configured merchant_id.
    const targetMerchantId = credMerchantId || merchantId;

    const check = await assertMerchantScopedToken(apiToken, targetMerchantId);

    // Wrong-merchant guard: the stored token may authenticate fine but belong to
    // a DIFFERENT merchant (e.g. the platform's "Alcohol Delivered LLC" saved to
    // Beverage King by mistake). If the authenticated merchant's name doesn't
    // match the store name, this store is NOT connected — regardless of the 200.
    let connected = check.ok;
    let reason = check.reason;
    if (check.ok && store?.name && check.merchantName) {
      const storeTokens = store.name.toLowerCase().split(/\s+/)
        .map((t) => t.replace(/[^a-z0-9]/g, '')).filter((t) => t.length >= 3);
      const mLower = check.merchantName.toLowerCase();
      const nameOk = storeTokens.length === 0 || storeTokens.some((t) => mLower.includes(t));
      if (!nameOk) {
        connected = false;
        reason = `Token authenticates for "${check.merchantName}" — NOT "${store.name}". The stored credential is scoped to the wrong merchant; re-run merchant-scoped OAuth for this store.`;
      }
    }

    return Response.json({
      success: true,
      connected,
      ready_to_push: connected,
      store: { id: storeId, name: store.name },
      clover: {
        configured_merchant_id: targetMerchantId,
        token_source: tokenSource,
        credential_token_present: !!credToken,
        credential_merchant_id: credMerchantId || null,
        merchant_scoped_auth: connected,
        merchant_name: check.merchantName,
        environment: check.environment,
        reason,
        request_merchant_id: check.request_merchant_id || targetMerchantId,
        clover_response_status: check.clover_response_status ?? null,
        clover_response_body: check.clover_response_body ?? null,
      },
      next_step: connected
        ? 'Connection verified — a controlled test order can be pushed.'
        : 'Complete merchant-specific OAuth: have the retailer authorize the Clover app and exchange the code (cloverOAuthExchange) to store a token for this merchant.',
    });
  } catch (error) {
    console.error('[verifyCloverOrderConnection] error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}