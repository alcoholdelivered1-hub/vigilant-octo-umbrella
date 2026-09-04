/**
 * Tracks Stripe Connect onboarding status for every store.
 *
 * For each store with a stripe_connect_account_id, retrieves the live Stripe
 * account status (charges_enabled, payouts_enabled, details_submitted,
 * pending requirements) and syncs stripe_connect_onboarded on the Store record.
 *
 * POST body: {} — admin only.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import Stripe from 'npm:stripe@17.4.0';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

    const stores = await base44.asServiceRole.entities.Store.list('name', 500);

    // Retrieve account status in parallel (25 stores — well within limits)
    const results = await Promise.all(stores.map(async (store) => {
      if (!store.stripe_connect_account_id) {
        return {
          store_id: store.id,
          name: store.name,
          email: store.email,
          stripe_account_id: null,
          status: 'not_started',
          charges_enabled: false,
          payouts_enabled: false,
          details_submitted: false,
          currently_due: [],
        };
      }
      try {
        const acct = await stripe.accounts.retrieve(store.stripe_connect_account_id);
        const currentlyDue = (acct.requirements?.currently_due || []).slice(0, 6);
        const fullyOnboarded = !!acct.charges_enabled && !!acct.payouts_enabled;
        // Persist the onboarded flag so other pages can read it without a Stripe call
        if (Boolean(store.stripe_connect_onboarded) !== fullyOnboarded) {
          await base44.asServiceRole.entities.Store.update(store.id, {
            stripe_connect_onboarded: fullyOnboarded,
          });
        }
        return {
          store_id: store.id,
          name: store.name,
          email: store.email,
          stripe_account_id: acct.id,
          status: fullyOnboarded ? 'complete' : (acct.details_submitted ? 'in_progress' : 'pending'),
          charges_enabled: !!acct.charges_enabled,
          payouts_enabled: !!acct.payouts_enabled,
          details_submitted: !!acct.details_submitted,
          currently_due: currentlyDue,
        };
      } catch (err) {
        return {
          store_id: store.id,
          name: store.name,
          email: store.email,
          stripe_account_id: store.stripe_connect_account_id,
          status: 'error',
          error: err.message,
          charges_enabled: false,
          payouts_enabled: false,
          details_submitted: false,
          currently_due: [],
        };
      }
    }));

    const summary = {
      total: results.length,
      complete: results.filter(r => r.status === 'complete').length,
      in_progress: results.filter(r => r.status === 'in_progress').length,
      pending: results.filter(r => r.status === 'pending').length,
      not_started: results.filter(r => r.status === 'not_started').length,
      error: results.filter(r => r.status === 'error').length,
    };

    return Response.json({ summary, stores: results });
  } catch (error) {
    console.error('getStoreConnectStatus error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}