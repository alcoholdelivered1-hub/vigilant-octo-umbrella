import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import Stripe from 'npm:stripe@17.4.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { action, store_id } = body;

    // Determine which Stripe Connect account to use
    let accountId = null;
    let accountType = null;

    if (store_id) {
      // Store owner flow
      const stores = await base44.asServiceRole.entities.Store.filter({ id: store_id }, 'name', 1);
      const store = stores[0];
      if (!store) return Response.json({ error: 'Store not found' }, { status: 404 });

      const isOwner = store.email && store.email.toLowerCase() === user.email.toLowerCase();
      const isAdmin = user.role === 'admin';
      if (!isOwner && !isAdmin) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
      accountId = store.stripe_connect_account_id;
      accountType = 'store';
    } else {
      // Driver flow
      accountId = user.stripe_connect_account_id;
      accountType = 'driver';
    }

    if (!accountId) {
      return Response.json({ error: 'No Stripe Connect account found. Complete onboarding first.' }, { status: 404 });
    }

    // Retrieve account details
    const account = await stripe.accounts.retrieve(accountId);

    // Send incomplete accounts through Stripe-hosted onboarding. Login links
    // are for the Express dashboard after the account has been set up.
    if (action === 'login') {
      const loginLink = await stripe.accounts.createLoginLink(accountId);
      return Response.json({ url: loginLink.url });
    }

    if (action === 'onboarding') {
      const origin = req.headers.get('origin') || 'https://app.base44.com';
      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${origin}/stripe-express?stripe_refresh=1${store_id ? `&store=${store_id}` : ''}`,
        return_url: `${origin}/stripe-express?stripe_connected=1${store_id ? `&store=${store_id}` : ''}`,
        type: 'account_onboarding',
      });
      return Response.json({ url: accountLink.url });
    }

    // Get balance
    const balance = await stripe.balance.retrieve({ stripeAccount: accountId });

    // Get recent payouts
    const payouts = await stripe.payouts.list(
      { limit: 10 },
      { stripeAccount: accountId }
    );

    // Get recent transfers to this account
    const transfers = await stripe.transfers.list({
      destination: accountId,
      limit: 10,
    });

    return Response.json({
      account_type: accountType,
      account_id: accountId,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      details_submitted: account.details_submitted,
      requirements: {
        currently_due: account.requirements?.currently_due || [],
        eventually_due: account.requirements?.eventually_due || [],
        errors: account.requirements?.errors || [],
      },
      balance: {
        available: balance.available.map(b => ({ amount: b.amount / 100, currency: b.currency })),
        pending: balance.pending.map(b => ({ amount: b.amount / 100, currency: b.currency })),
      },
      payouts: payouts.data.map(p => ({
        id: p.id,
        amount: p.amount / 100,
        currency: p.currency,
        status: p.status,
        created: new Date(p.created * 1000).toISOString(),
        arrival_date: new Date(p.arrival_date * 1000).toISOString(),
        method: p.method,
      })),
      transfers: transfers.data.map(t => ({
        id: t.id,
        amount: t.amount / 100,
        currency: t.currency,
        created: new Date(t.created * 1000).toISOString(),
        description: t.description,
      })),
    });
  } catch (error) {
    console.error('Stripe Express portal error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});