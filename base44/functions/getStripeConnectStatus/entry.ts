/**
 * Retrieves the real Stripe Connect account status for every store,
 * auto-corrects the local `stripe_connect_onboarded` flag when Stripe
 * reports a store is fully verified, and returns a breakdown of who is
 * complete vs. incomplete (with their past_due / currently_due requirements).
 *
 * Admin-only. No emails are sent here — callers use the breakdown to
 * decide whether to nudge or re-link a store.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import Stripe from 'npm:stripe@17.4.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
    const stores = await base44.asServiceRole.entities.Store.list('name', 500);

    let complete = 0;
    let incomplete = 0;
    let noAccount = 0;
    let corrected = 0;
    const completeStores: string[] = [];
    const incompleteStores: any[] = [];

    for (const s of stores) {
      if (!s.stripe_connect_account_id) {
        noAccount++;
        continue;
      }
      try {
        const acct = await stripe.accounts.retrieve(s.stripe_connect_account_id);
        const detailsSubmitted = !!acct.details_submitted;
        const chargesEnabled = !!acct.charges_enabled;
        const payoutsEnabled = !!acct.payouts_enabled;
        const pastDue = acct.requirements?.past_due || [];
        const currentlyDue = acct.requirements?.currently_due || [];
        const isComplete = detailsSubmitted && chargesEnabled && payoutsEnabled && pastDue.length === 0;

        if (isComplete) {
          complete++;
          completeStores.push(s.name);
          if (!s.stripe_connect_onboarded) {
            await base44.asServiceRole.entities.Store.update(s.id, { stripe_connect_onboarded: true });
            corrected++;
          }
        } else {
          incomplete++;
          incompleteStores.push({
            store_id: s.id,
            name: s.name,
            email: s.email,
            account_id: s.stripe_connect_account_id,
            details_submitted: detailsSubmitted,
            charges_enabled: chargesEnabled,
            payouts_enabled: payoutsEnabled,
            past_due: pastDue,
            currently_due: currentlyDue,
          });
        }
      } catch (e: any) {
        incompleteStores.push({
          name: s.name,
          email: s.email,
          account_id: s.stripe_connect_account_id,
          error: e.message,
        });
      }
    }

    return Response.json({
      total: stores.length,
      complete,
      incomplete,
      no_account: noAccount,
      local_flags_corrected: corrected,
      complete_stores: completeStores,
      incomplete_stores: incompleteStores,
    });
  } catch (error) {
    console.error('getStripeConnectStatus error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});