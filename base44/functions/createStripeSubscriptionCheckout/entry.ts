import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

// Alcohol Delivered Subscription — $10/month with 30-day free trial
const MEMBERSHIP_PRICE_ID = 'price_1TvMXIItSFUKmqfVZVlwkgt5';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Block if user already has an active subscription
    if (user.membership_status === 'active' || user.membership_status === 'trialing') {
      return Response.json({ error: 'You already have an active membership' }, { status: 409 });
    }

    const origin = req.headers.get('origin') || 'https://app.base44.com';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: MEMBERSHIP_PRICE_ID, quantity: 1 }],
      subscription_data: {
        trial_period_days: 30,
        metadata: {
          user_id: user.id,
          customer_email: user.email,
        },
      },
      success_url: `${origin}/membership?subscription=success`,
      cancel_url: `${origin}/membership?subscription=cancelled`,
      customer_email: user.email,
      metadata: {
        base44_app_id: Deno.env.get('BASE44_APP_ID'),
        user_id: user.id,
        customer_email: user.email,
        type: 'membership_subscription',
      },
    });

    return Response.json({ url: session.url, session_id: session.id });
  } catch (error) {
    console.error('Subscription checkout error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});