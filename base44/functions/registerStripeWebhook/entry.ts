/**
 * Admin-only. Registers (idempotently) the live Stripe webhook endpoint that
 * points at this app's stripeWebhook function, subscribing to exactly the
 * events that handler processes.
 *
 * POST body: { url?: string }
 *   If omitted, defaults to: {origin}/api/apps/{BASE44_APP_ID}/functions/stripeWebhook
 *
 * Returns the endpoint id and — when newly created — the signing secret so it
 * can be stored as the STRIPE_WEBHOOK_SECRET app secret. Stripe only shows
 * the secret once; if the endpoint already exists this function reports it
 * without re-creating it.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import Stripe from 'npm:stripe@17.4.0';

// Keep in sync with base44/functions/stripeWebhook/entry.ts
const ENABLED_EVENTS = [
  'checkout.session.completed',
  'checkout.session.expired',
  'account.updated',
  'charge.refunded',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
  'payment_intent.succeeded',
];

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const appId = Deno.env.get('BASE44_APP_ID') || '';
    const origin = req.headers.get('origin') || '';
    const url = (body.url || (origin && appId ? `${origin}/api/apps/${appId}/functions/stripeWebhook` : '')).trim();

    if (!url) {
      return Response.json({
        error: 'No webhook URL could be derived. Pass { url } explicitly, e.g. https://<your-app>/api/apps/<app-id>/functions/stripeWebhook',
      }, { status: 400 });
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

    // Idempotent: reuse an existing endpoint already pointing at this URL
    const existing = await stripe.webhookEndpoints.list({ limit: 100 });
    const match = existing.data.find((e) => e.url === url);
    if (match) {
      return Response.json({
        created: false,
        endpoint_id: match.id,
        status: match.status,
        url: match.url,
        enabled_events: match.enabled_events,
        note: 'Endpoint already registered. Stripe cannot re-display the signing secret — if STRIPE_WEBHOOK_SECRET is missing from app secrets, roll the secret in the Stripe Dashboard (Developers → Webhooks) and update the secret.',
      });
    }

    const endpoint = await stripe.webhookEndpoints.create({
      url,
      enabled_events: ENABLED_EVENTS,
      description: 'Alcohol Delivered — stripeWebhook (orders, Connect onboarding, refunds, subscriptions)',
    });

    return Response.json({
      created: true,
      endpoint_id: endpoint.id,
      status: endpoint.status,
      url: endpoint.url,
      enabled_events: endpoint.enabled_events,
      signing_secret: endpoint.secret,
      next_step: 'Add STRIPE_WEBHOOK_SECRET with the signing_secret value to the app secrets, then re-run the Integrations Status check.',
    });
  } catch (error) {
    console.error('registerStripeWebhook error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
