import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    // Account status (live mode, charges/payouts enabled)
    const account = await stripe.accounts.retrieve();

    // Available + pending balance
    let balance = null;
    try {
      balance = await stripe.balance.retrieve();
    } catch (e) {
      console.error('balance retrieve failed:', e.message);
    }

    // Fetch recent successful charges (last 30 days)
    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
    const charges = await stripe.charges.list({
      created: { gte: thirtyDaysAgo },
      limit: 100,
    });

    const successfulCharges = charges.data.filter(c => c.status === 'succeeded' && !c.refunded);
    const totalRevenueCents = successfulCharges.reduce((sum, c) => sum + c.amount, 0);
    const refundedCents = charges.data.filter(c => c.refunded).reduce((sum, c) => sum + c.amount_refunded, 0);

    // Fetch active subscriptions
    const subscriptions = await stripe.subscriptions.list({
      status: 'active',
      limit: 100,
    });

    // Fetch all subscription statuses for counts
    const allSubs = await stripe.subscriptions.list({ limit: 100 });

    const recentPayments = successfulCharges
      .slice(0, 8)
      .map(c => ({
        id: c.id,
        amount: c.amount / 100,
        currency: c.currency,
        created: new Date(c.created * 1000).toISOString(),
        customer_email: c.billing_details?.email || '',
        description: c.description || '',
        receipt_url: c.receipt_url,
      }));

    const subscriptionDetails = subscriptions.data.slice(0, 12).map(s => ({
      id: s.id,
      status: s.status,
      customer_id: s.customer,
      current_period_end: s.current_period_end ? new Date(s.current_period_end * 1000).toISOString() : null,
      amount: (s.items?.data?.[0]?.price?.unit_amount || 0) / 100,
      currency: s.items?.data?.[0]?.price?.currency || 'usd',
      interval: s.items?.data?.[0]?.price?.recurring?.interval || null,
      product_id: s.items?.data?.[0]?.price?.product || null,
    }));

    return Response.json({
      account: {
        id: account.id,
        country: account.country,
        default_currency: account.default_currency,
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        business_name: account.business_profile?.name || null,
        email: account.email || null,
      },
      balance: balance ? {
        available: (balance.available || []).map(b => ({ amount: b.amount / 100, currency: b.currency })),
        pending: (balance.pending || []).map(b => ({ amount: b.amount / 100, currency: b.currency })),
      } : null,
      mode: 'live',
      total_revenue: totalRevenueCents / 100,
      refunded_amount: refundedCents / 100,
      payment_count: successfulCharges.length,
      active_subscriptions: subscriptions.data.length,
      trialing_subscriptions: allSubs.data.filter(s => s.status === 'trialing').length,
      canceled_subscriptions: allSubs.data.filter(s => s.status === 'canceled').length,
      recent_payments: recentPayments,
      subscriptions: subscriptionDetails,
    });
  } catch (error) {
    console.error('Stripe dashboard error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});