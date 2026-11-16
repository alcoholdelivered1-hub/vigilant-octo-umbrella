import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { findBeverageKingStores } from '../../shared/beverageKingStore.ts';
import { secrets } from 'base44:runtime';

const storeId = '6a32d14d09b760f592dbf19e';
const endpointUrl = 'https://alcohol-delivered-0c72f042.base44.app/functions/stripeWebhook';

// Redeployed after the live webhook signing secret rotation.
export default async function(req) {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const headers = { Authorization: `Bearer ${secrets.get('STRIPE_SECRET_KEY')}`, 'Stripe-Version': '2025-10-29.clover' };
    const stores = await findBeverageKingStores(base44);
    const store = stores.length === 1 ? stores[0] : null;
    if (!store) return Response.json({ error: 'Beverage King store record was not found' }, { status: 404 });
    const accountId = store.stripe_connect_account_id;
    const [accountResponse, webhookResponse] = await Promise.all([
      accountId
        ? fetch(`https://api.stripe.com/v1/accounts/${accountId}`, { headers })
        : Promise.resolve(new Response(JSON.stringify({}), { status: 404 })),
      fetch('https://api.stripe.com/v1/webhook_endpoints?limit=100', { headers }),
    ]);
    const [account, webhooks] = await Promise.all([accountResponse.json(), webhookResponse.json()]);
    // Stripe's webhook endpoint response does not expose the Connect event scope.
    // Confirm connected-account delivery with a signed test event before opening.
    const activeEndpoints = webhookResponse.ok && Array.isArray(webhooks.data) ? webhooks.data.filter((item) =>
      item.url === endpointUrl && item.status === 'enabled' &&
      (item.enabled_events?.includes('*') || (
        item.enabled_events?.includes('checkout.session.completed') &&
        item.enabled_events?.includes('checkout.session.async_payment_succeeded')
      ))) : [];
    let secretConfigured = false;
    try { secretConfigured = Boolean(secrets.get('STRIPE_WEBHOOK_SECRET')); } catch {}

    const blockers = [];
    if (!accountId) blockers.push('Beverage King has not connected a Stripe account');
    else if (!accountResponse.ok) blockers.push('Beverage King Stripe access is not connected');
    if (accountResponse.ok && !account.details_submitted) blockers.push('Stripe KYC details are incomplete');
    if (accountResponse.ok && !account.charges_enabled) blockers.push('Stripe charges are not enabled');
    if (accountResponse.ok && !account.payouts_enabled) blockers.push('Stripe payouts or bank setup are not enabled');
    if (accountId && store.stripe_connection_status !== 'connected') blockers.push('Beverage King store is not mapped to its Stripe account');
    if (activeEndpoints.length === 0) blockers.push('No active Stripe webhook endpoint');
    if (!secretConfigured) blockers.push('Stripe webhook secret is not configured');

    return Response.json({
      ready: blockers.length === 0,
      blockers,
      stripe: accountResponse.ok ? { account_id: account.id, details_submitted: account.details_submitted, charges_enabled: account.charges_enabled, payouts_enabled: account.payouts_enabled } : { account_id: accountId || null, accessible: false },
      integrations_status: { active_endpoints: activeEndpoints.length, secret_configured: secretConfigured },
    });
  } catch (error) {
    console.error('Beverage King readiness check error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}