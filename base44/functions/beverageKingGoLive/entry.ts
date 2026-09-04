/**
 * beverageKingGoLive
 * Admin-only. One-call go-live console for Beverage King.
 *
 * Reports the EXACT current state of every requirement and the single next
 * action needed — so you stop guessing why "it keeps failing."
 *
 * POST body: { action?: 'status' | 'clear_clover' }
 *   status       (default) — read-only diagnostic of every gate.
 *   clear_clover           — wipe Beverage King's stored Clover credential
 *                            (use when it's scoped to the wrong merchant).
 *
 * Every external call in 'status' mode is read-only (Clover GET, Stripe
 * retrieve). 'clear_clover' is the only write, and only when requested.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import Stripe from 'npm:stripe@17.4.0';
import {
  BEVERAGE_KING_STORE_ID,
  resolveCloverCredentials,
  assertMerchantScopedToken,
} from '../../shared/cloverCredentials.ts';

const PLATFORM_MERCHANT_NAME = /alcohol\s*delivered/i;

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'status';
    const storeId = BEVERAGE_KING_STORE_ID;

    // ---- Store record ----
    let store = null;
    try { store = await base44.asServiceRole.entities.Store.get(storeId); } catch (_) { /* not found */ }

    // ---- Optional write: clear a wrong-merchant Clover credential ----
    let cleared = null;
    if (action === 'clear_clover') {
      const cred = (await base44.asServiceRole.entities.StorePosCredential.filter({ store_id: storeId }))[0];
      if (cred) {
        await base44.asServiceRole.entities.StorePosCredential.update(cred.id, {
          api_token: '',
          refresh_token: '',
          is_configured: false,
          notes: `Cleared by ${user.email} on ${new Date().toISOString()} — credential was scoped to the wrong merchant. Awaiting Beverage King's merchant-scoped token.`,
        });
        cleared = { cleared: true, previous_merchant_id: cred.merchant_id || null };
      } else {
        cleared = { cleared: false, reason: 'no credential on file' };
      }
    }

    // ---- Clover gate ----
    const { apiToken, merchantId, tokenSource, credMerchantId } =
      await resolveCloverCredentials(base44, storeId, { noEnvFallback: true });

    let clover = {
      has_token: !!apiToken,
      configured_merchant_id: credMerchantId || merchantId || null,
      token_source: tokenSource,
      authenticates: false,
      merchant_name: null,
      is_beverage_king: false,
      environment: null,
      reason: null,
    };

    if (apiToken) {
      const target = credMerchantId || merchantId;
      const auth = await assertMerchantScopedToken(apiToken, target);
      clover.authenticates = auth.ok;
      clover.merchant_name = auth.merchantName || null;
      clover.environment = auth.environment || null;
      clover.reason = auth.reason || null;
      if (auth.ok && auth.merchantName) {
        const mLower = auth.merchantName.toLowerCase();
        clover.is_beverage_king = ['beverage', 'king'].some((t) => mLower.includes(t));
        if (PLATFORM_MERCHANT_NAME.test(auth.merchantName)) clover.is_beverage_king = false;
        if (!clover.is_beverage_king) {
          clover.reason = `Token authenticates for "${auth.merchantName}" — NOT Beverage King. Wrong merchant; clear it (action: 'clear_clover') and re-connect as Beverage King.`;
        }
      }
    }

    const cloverOk = clover.has_token && clover.authenticates && clover.is_beverage_king;

    // ---- Stripe gate ----
    let stripe = { account_id: store?.stripe_connect_account_id || null, charges_enabled: null, payouts_enabled: null, onboarded: false, error: null };
    if (store?.stripe_connect_account_id) {
      try {
        const stripeClient = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
        const acct = await stripeClient.accounts.retrieve(store.stripe_connect_account_id);
        stripe.charges_enabled = !!acct.charges_enabled;
        stripe.payouts_enabled = !!acct.payouts_enabled;
        stripe.onboarded = acct.charges_enabled && acct.payouts_enabled;
      } catch (e) {
        stripe.error = e.message;
        stripe.revoked = e?.statusCode === 403 || e?.code === 'account_invalid' || /revoked/i.test(e?.message || '');
      }
    } else {
      stripe.error = 'No Stripe Connect account on store';
    }

    // ---- Catalog gate ----
    const products = await base44.asServiceRole.entities.Product.filter({ store_id: storeId }, '-updated_date', 1);
    const productCount = (await base44.asServiceRole.entities.Product.filter({ store_id: storeId }, 'name', 1000)).length;

    // ---- Assemble gates + blockers + the single next action ----
    const gates = [
      { key: 'store_active', label: 'Store exists & is_active', pass: !!(store && store.is_active) },
      { key: 'compliant', label: 'Compliance status = compliant', pass: store?.compliance_status === 'compliant' },
      { key: 'clover', label: 'Clover token authenticates for BEVERAGE KING merchant', pass: cloverOk },
      { key: 'stripe', label: 'Stripe Connect charges + payouts enabled', pass: stripe.onboarded },
      { key: 'catalog', label: 'Catalog has products', pass: productCount > 0 },
    ];
    const blockers = gates.filter((g) => !g.pass).map((g) => g.label);

    let next_action;
    if (!store) next_action = 'Beverage King store record missing — restore it.';
    else if (!clover.has_token) next_action = 'No Clover token on file. Get Beverage King\'s Merchant ID + API Token (Settings → API Tokens) and enter via Secure Manual Token Entry, OR have them complete OAuth. The poisoned credential may need clearing first (action: \'clear_clover\').';
    else if (!clover.authenticates) next_action = 'Stored Clover token does not authenticate (expired/invalid). Get a FRESH token from Beverage King and re-save.';
    else if (!clover.is_beverage_king) next_action = `Stored token is for "${clover.merchant_name}" — the WRONG merchant. Run action 'clear_clover' now, then connect Beverage King's real merchant.`;
    else if (!stripe.onboarded) next_action = stripe.revoked
      ? 'Stripe account revoked — use Stripe Onboarding Hub → Reconnect for Beverage King, then complete KYC.'
      : 'Stripe Connect onboarding incomplete — finish KYC/payouts via the Onboarding Hub.';
    else if (productCount === 0) next_action = 'Clover is connected — now sync the catalog (Sync Inventory) so products exist.';
    else next_action = 'ALL GATES PASS — push a controlled paid test order and confirm it appears on Beverage King\'s register, then flip the store live.';

    return Response.json({
      go_live_ready: blockers.length === 0,
      store: store ? { id: store.id, name: store.name, is_active: store.is_active, compliance_status: store.compliance_status, onboarding_status: store.onboarding_status } : null,
      clover,
      stripe,
      catalog: { product_count: productCount },
      gates,
      blockers,
      next_action,
      cleared: cleared || undefined,
    });
  } catch (error) {
    console.error('beverageKingGoLive error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
