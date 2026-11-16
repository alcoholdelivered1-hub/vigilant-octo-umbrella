/**
 * Creates or retrieves a Stripe Connect Express account for the authenticated driver,
 * then returns an onboarding URL so they can complete KYC.
 *
 * POST body: { return_url: string, refresh_url: string }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import Stripe from 'npm:stripe@17.4.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
    const { return_url, refresh_url } = await req.json();

    let accountId = user.stripe_connect_account_id;

    // Create a new Express account if the driver doesn't have one yet
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: user.email,
        capabilities: {
          transfers: { requested: true },
        },
        metadata: {
          base44_user_id: user.id,
          base44_app_id: Deno.env.get('BASE44_APP_ID'),
        },
      });
      accountId = account.id;

      // Persist the account ID on the user.
      // Service role: this is a payout destination, so app users must not be able to
      // point their payouts at an arbitrary Stripe account from the browser.
      await base44.asServiceRole.entities.User.update(user.id, { stripe_connect_account_id: accountId });
    }

    // Generate an Account Link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refresh_url || `${req.headers.get('origin')}/driver/earnings`,
      return_url: return_url || `${req.headers.get('origin')}/driver/earnings?connected=1`,
      type: 'account_onboarding',
    });

    return Response.json({ url: accountLink.url, account_id: accountId });
  } catch (error) {
    console.error('stripeConnectOnboard error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});