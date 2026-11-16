/**
 * checkStripeAccountStatus
 * Admin-only, READ-ONLY. Looks up ANY Stripe Connect account by id and reports
 * only non-sensitive status fields (never secret keys, never full SSN/tax id/
 * bank account numbers — Stripe does not return those on a read anyway).
 *
 * Built to safely compare Beverage King's current vs. a prior Stripe account
 * before deciding whether to remap stripe_connect_account_id. Does NOT change
 * anything on the account or on any Store record.
 *
 * POST body: { account_id: string, store_id?: string }
 *   store_id (optional) — if given, also reports whether the account's email/
 *   name/metadata match that store, using the same check the app itself uses
 *   before trusting a mapped account (shared/retailerStripe.ts).
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { secrets } from 'base44:runtime';

export default async function (req) {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const accountId = String(body.account_id || '').trim();
    if (!/^acct_[A-Za-z0-9]+$/.test(accountId)) {
      return Response.json({ error: 'A valid account_id (acct_...) is required' }, { status: 400 });
    }

    const headers = { Authorization: `Bearer ${secrets.get('STRIPE_SECRET_KEY')}`, 'Stripe-Version': '2025-10-29.clover' };
    const resp = await fetch(`https://api.stripe.com/v1/accounts/${encodeURIComponent(accountId)}`, { headers });
    const account = await resp.json();

    if (!resp.ok) {
      return Response.json({
        accessible: false,
        account_id: accountId,
        status_code: resp.status,
        error: account?.error?.message || 'Stripe rejected this request',
        error_code: account?.error?.code || null,
      }, { status: 200 });
    }

    const result = {
      accessible: true,
      account_id: accountId,
      type: account.type,
      email: account.email || null,
      business_profile_name: account.business_profile?.name || null,
      company_name: account.company?.name || null,
      charges_enabled: account.charges_enabled === true,
      payouts_enabled: account.payouts_enabled === true,
      details_submitted: account.details_submitted === true,
      disabled_reason: account.requirements?.disabled_reason || null,
      currently_due: account.requirements?.currently_due || [],
      metadata: account.metadata || {},
      created: account.created ? new Date(account.created * 1000).toISOString() : null,
    };

    const storeId = String(body.store_id || '').trim();
    if (storeId) {
      const store = await base44.asServiceRole.entities.Store.get(storeId).catch(() => null);
      if (store) {
        const normalize = (v) => (v || '').trim().toLowerCase();
        const mappedStore = account.metadata?.store_id;
        result.store_match = {
          store_id: storeId,
          store_name: store.name,
          metadata_store_id_matches: mappedStore ? mappedStore === store.id : null,
          email_matches: normalize(account.email) === normalize(store.email),
          name_matches: normalize(account.business_profile?.name || account.company?.name) === normalize(store.name),
          currently_mapped_on_store: store.stripe_connect_account_id === accountId,
        };
      }
    }

    return Response.json(result);
  } catch (error) {
    console.error('checkStripeAccountStatus error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
