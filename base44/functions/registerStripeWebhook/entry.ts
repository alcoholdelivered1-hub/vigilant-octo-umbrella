import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';

const endpointUrl = 'https://alcohol-delivered-0c72f042.base44.app/functions/stripeWebhook';
const stripeHeaders = () => ({
  Authorization: `Bearer ${secrets.get('STRIPE_SECRET_KEY')}`,
  'Stripe-Version': '2025-10-29.clover',
});

export default async function(req) {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const listResponse = await fetch('https://api.stripe.com/v1/webhook_endpoints?limit=100', { headers: stripeHeaders() });
    const list = await listResponse.json();
    if (!listResponse.ok) throw new Error(list.error?.message || 'Unable to check Stripe webhooks');
    const existing = list.data.find((item) => item.url === endpointUrl && item.status === 'enabled' && item.connect === true);
    if (existing) return Response.json({ status: 'active', endpoint_id: existing.id, connect: existing.connect });

    let oldSecretConfigured = false;
    try { oldSecretConfigured = Boolean(secrets.get('STRIPE_WEBHOOK_SECRET')); } catch {}
    if (oldSecretConfigured) {
      return Response.json({
        status: 'secret_reset_required',
        error: 'Delete the old STRIPE_WEBHOOK_SECRET in Settings → Secrets, then run this action again.',
      }, { status: 409 });
    }

    return Response.json({
      status: 'admin_registration_required',
      error: 'Webhook registration must run through the secure app-admin operation so the signing secret is stored without being exposed.',
    }, { status: 409 });
  } catch (error) {
    console.error('Stripe webhook registration error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}