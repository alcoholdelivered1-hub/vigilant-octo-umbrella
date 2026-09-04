/**
 * One-time admin setup for Beverage King (Pine Bluff, Jefferson County):
 *  Creates a Stripe Connect Express account for the store and returns the
 *  onboarding URL the store owner must visit to complete KYC + bank details.
 *
 * Admin-only. POST body: {} (store is matched by name).
 *
 * NOTE: this function deliberately does NOT write Clover credentials. It used to
 * copy the platform's CLOVER_MERCHANT_ID / CLOVER_API_TOKEN (Alcohol Delivered
 * LLC's merchant) into Beverage King's StorePosCredential — which is what made
 * orders route to the wrong POS and blocked go-live. Beverage King's Clover
 * credential must come from merchant-scoped OAuth (cloverOAuthExchange) only.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import Stripe from 'npm:stripe@17.4.0';

const STORE_ID = '6a32d14d09b760f592dbf19e';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: admin only' }, { status: 403 });

    const stores = await base44.asServiceRole.entities.Store.filter({ id: STORE_ID }, 'name', 1);
    const store = stores[0];
    if (!store) return Response.json({ error: 'Store not found' }, { status: 404 });

    const results = { store: store.name, pos_credential: 'skipped (merchant OAuth required — never copy platform token)', stripe_account_id: null, stripe_onboarding_url: null };

    // Stripe Connect Express account
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
    let accountId = store.stripe_connect_account_id;
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: store.email,
        business_type: 'company',
        business_profile: { name: store.name, mcc: '5921' },
        capabilities: { transfers: { requested: true }, card_payments: { requested: true } },
        metadata: {
          base44_store_id: store.id,
          store_name: store.name,
          base44_app_id: Deno.env.get('BASE44_APP_ID'),
        },
      });
      accountId = account.id;
      await base44.asServiceRole.entities.Store.update(store.id, { stripe_connect_account_id: accountId });
    }
    results.stripe_account_id = accountId;

    // Onboarding link the store owner uses to finish KYC + bank account
    const origin = req.headers.get('origin') || 'https://app.base44.com';
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/store/dashboard?stripe_refresh=1`,
      return_url: `${origin}/store/dashboard?stripe_connected=1&store=${store.id}`,
      type: 'account_onboarding',
    });
    results.stripe_onboarding_url = accountLink.url;

    return Response.json(results);
  } catch (error) {
    console.error('setupBeverageKingPayouts error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});