/**
 * Creates or retrieves a Stripe Connect Express account for the authenticated
 * retailer's store, then returns an onboarding URL so they can complete KYC.
 *
 * POST body: { store_id: string, return_url?: string, refresh_url?: string }
 *
 * The calling user must be the store owner (store.email === user.email) or an admin.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import Stripe from 'npm:stripe@17.4.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { store_id, return_url, refresh_url } = await req.json();
    if (!store_id) return Response.json({ error: 'store_id is required' }, { status: 400 });

    // Fetch the store — must belong to this user or user must be admin
    const stores = await base44.asServiceRole.entities.Store.filter({ id: store_id }, 'name', 1);
    const store = stores[0];
    if (!store) return Response.json({ error: 'Store not found' }, { status: 404 });

    const isOwner = store.email && store.email.toLowerCase() === user.email.toLowerCase();
    const isAdmin = user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return Response.json({ error: 'Forbidden: you do not own this store' }, { status: 403 });
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
    let accountId = store.stripe_connect_account_id;
    let previousAccountRevoked = false;

    // A previously-connected account may have revoked platform access. Stripe
    // then answers every call for it with 403 account_invalid, and onboarding
    // links can NEVER be created for it again — the only fix is a fresh
    // Express account. Detect that here instead of failing on link creation.
    if (accountId) {
      try {
        await stripe.accounts.retrieve(accountId);
      } catch (err) {
        const revoked =
          err?.statusCode === 403 ||
          err?.code === 'account_invalid' ||
          /revoked/i.test(err?.message || '');
        if (!revoked) throw err;
        console.warn(`Store ${store.id} Stripe account ${accountId} revoked platform access — creating a fresh account`);
        previousAccountRevoked = true;
        accountId = null;
      }
    }

    // Create a new Express account if the store doesn't have a usable one
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: store.email || user.email,
        business_type: 'company',
        business_profile: {
          name: store.name,
          url: req.headers.get('origin') || undefined,
          mcc: '5921', // Package stores — beer, wine, liquor
        },
        capabilities: {
          transfers: { requested: true },
          card_payments: { requested: true },
        },
        metadata: {
          base44_store_id: store.id,
          store_name: store.name,
          base44_app_id: Deno.env.get('BASE44_APP_ID'),
          ...(previousAccountRevoked ? { reconnected_from: store.stripe_connect_account_id } : {}),
        },
      });
      accountId = account.id;

      // Persist the account ID on the store (and reset the onboarded flag)
      await base44.asServiceRole.entities.Store.update(store.id, {
        stripe_connect_account_id: accountId,
        stripe_connect_onboarded: false,
      });
    }

    // Generate an Account Link for onboarding
    const origin = req.headers.get('origin') || 'https://app.base44.com';
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refresh_url || `${origin}/store/dashboard?stripe_refresh=1`,
      return_url: return_url || `${origin}/store/dashboard?stripe_connected=1&store=${store.id}`,
      type: 'account_onboarding',
    });

    return Response.json({ url: accountLink.url, account_id: accountId, reconnected: previousAccountRevoked });
  } catch (error) {
    console.error('stripeConnectOnboardStore error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});