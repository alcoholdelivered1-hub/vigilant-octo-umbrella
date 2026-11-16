import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';
import { resolveAppOrigin } from '../../shared/appOrigin.ts';
import { setupStore, requireUnambiguousRetailer, allSetupRecords } from '../../shared/retailerSetupAccess.ts';
import { retailerStripeRequest, getRetailerStripeAccount, retailerPaymentsReady, createRetailerStripeAccount } from '../../shared/retailerStripe.ts';

export default async function(req) {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const { store_id, action = 'onboard' } = await req.json();
    if (!['onboard', 'status'].includes(action)) return Response.json({ error: 'Invalid action' }, { status: 400 });
    const store = await setupStore(base44,user,store_id);
    await requireUnambiguousRetailer(base44,store);
    if (!store) return Response.json({ error: 'Store not found' }, { status: 404 });
    if (user.role !== 'admin' && ![store.email, ...(store.contact_emails || [])].some(email => email && email.toLowerCase() === user.email?.toLowerCase())) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!store.email) return Response.json({ error: 'Add the retailer owner’s contact email before connecting payments.' }, { status: 409 });
    let account = null;
    if (store.stripe_connect_account_id) {
      const linkedStores = await allSetupRecords(base44.asServiceRole.entities.Store, { stripe_connect_account_id: store.stripe_connect_account_id });
      if (linkedStores.some(other => other.id !== store.id)) return Response.json({ error: 'This Stripe account is linked to another retailer. Each retailer must have its own account.' }, { status: 409 });
      account = await getRetailerStripeAccount(store);
    }
    if (action === 'status') {
      const ready = !!account && retailerPaymentsReady(account);
      const disabledReason = account?.requirements?.disabled_reason || null;
      const reviewRequired = !!disabledReason && /^(rejected\.|under_review)/.test(disabledReason);
      const status = ready ? 'connected' : reviewRequired ? 'restricted' : account ? 'pending' : 'disconnected';
      // Status verification is read-only; provider returns never activate a retailer.
      return Response.json({ ready, status, disabled_reason: disabledReason, review_required: reviewRequired, account_id: account?.id || null,
        dashboard_url: account?.type === 'standard' ? `https://dashboard.stripe.com/${account.id}` : null,
        charges_enabled: account?.charges_enabled === true, payouts_enabled: account?.payouts_enabled === true,
        details_submitted: account?.details_submitted === true,
        requirements: account?.requirements?.currently_due || [] });
    }
    if (!account) return Response.json({ error:'An administrator must map this canonical retailer’s existing Stripe account before hosted onboarding. No account has been created.' },{ status:409 });
    if (/^(rejected\.|under_review)/.test(account.requirements?.disabled_reason || '')) {
      return Response.json({ error: 'Stripe review is required. The account owner must open the existing Stripe Dashboard and follow its review or appeal instructions. Reconnecting cannot remove this restriction.', review_required: true }, { status: 409 });
    }
    // An inaccessible existing account is never silently replaced.
    const returnUrl = `${resolveAppOrigin(req)}/onboarding?store_id=${encodeURIComponent(store.id)}&step=connections`;
    const link = await retailerStripeRequest('/account_links', {
      account: account.id, type: 'account_onboarding', refresh_url: returnUrl, return_url: `${returnUrl}&stripe_return=1`,
    });
    return Response.json({ url: link.url, account_id: account.id, store_id: store.id, expires_at: link.expires_at });
  } catch (error) {
    console.error('Beverage King Stripe reconnect error:', error.message);
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}