import { createClientFromRequest } from 'npm:@base44/sdk';
import { setupStore } from '../../shared/retailerSetupAccess.ts';

// Read-only checklist for a retailer's Clover Hosted Checkout pilot.
// Saved approvals are evidence flags, NOT payment authorization or processor readiness.
export default async function(req) {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Sign in to view the retailer payment setup.' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    if (!body.store_id) return Response.json({ error: 'Store ID is required.' }, { status: 400 });
    const store = await setupStore(base44, user, body.store_id);
    const connections = await base44.asServiceRole.entities.CloverConnection.filter({ store_id: store.id }, '-updated_date', 5);
    const connected = connections.some(c =>
      c.status === 'connected' &&
      Boolean(c.merchant_id) &&
      c.merchant_name?.trim().length > 0 &&
      (!c.access_token_expires_at || new Date(c.access_token_expires_at).getTime() > Date.now())
    );

    const checks = [
      { key: 'register', label: 'Retailer Clover merchant authorization', complete: connected },
      { key: 'ecommerce', label: 'Clover approval for online alcohol payments', complete: store.clover_ecommerce_approved === true },
      { key: 'fee_agreement', label: 'Retailer agrees to 25% merchandise commission and delivery settlement', complete: store.clover_commission_agreement_approved === true },
      { key: 'webhook', label: 'Signed payment webhook and order reconciliation test', complete: store.clover_webhook_test_passed === true },
      { key: 'launch', label: 'Authorized Clover checkout pilot activation', complete: store.clover_checkout_enabled === true }
    ];

    // This feature is currently a SETUP WORKSPACE only. There is no path that
    // accepts customer card payments with Clover until a production-quality,
    // verified server checkout + payment webhook workflow is added and tested.
    return Response.json({
      store_name: store.name,
      preferred_provider: store.preferred_payment_provider || 'stripe',
      pilot_only: true,
      customer_payments_available: false,
      checks,
      message: 'Clover online checkout is being prepared. No customer Clover payments are enabled. Existing Stripe checkout stays unchanged.'
    });
  } catch (err) {
    console.error('Clover payments checklist:', err.message);
    return Response.json({ error: err.message || 'Could not read Clover setup.' }, { status: err.status || 500 });
  }
}