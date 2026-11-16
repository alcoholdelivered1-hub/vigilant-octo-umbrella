import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';
import { buildReadinessIndex } from '../../shared/readiness/readinessIndex.ts';
import { evaluateStoreReadiness } from '../../shared/readiness/evaluateStoreReadiness.ts';
import { webhookStatus } from '../../shared/readiness/paymentWebhookPolicy.ts';
import { driverIsProductionQualified } from '../../shared/verifiedTaxDriverReadiness.ts';

const APP_URL = 'https://alcohol-delivered-0c72f042.base44.app';

const fetchWithTimeout = (url, options = {}, timeoutMs = 6000) =>
  fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });

export default async function(req) {
  try {
    if (req.method !== 'GET' && req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const stores = await base44.asServiceRole.entities.Store.list('-created_date', 500);
    // One evidence index, one evaluation: identical rules to the launch gate.
    const index = await buildReadinessIndex(base44, {});

    let stripeHeaders = null;
    try {
      const stripeSecret = secrets.get('STRIPE_SECRET_KEY');
      if (stripeSecret) stripeHeaders = { Authorization: `Bearer ${stripeSecret}`, 'Stripe-Version': '2025-10-29.clover' };
    } catch {}

    let endpoints = [];
    if (stripeHeaders) {
      try {
        const response = await fetchWithTimeout('https://api.stripe.com/v1/webhook_endpoints?limit=100', { headers: stripeHeaders });
        const payload = await response.json();
        if (response.ok && Array.isArray(payload.data)) endpoints = payload.data;
      } catch {}
    }
    let webhookSecretConfigured = false;
    try { webhookSecretConfigured = Boolean(secrets.get('STRIPE_WEBHOOK_SECRET')); } catch {}
    const webhook = webhookStatus({ secretConfigured: webhookSecretConfigured, endpoints, appUrl: APP_URL });

    let firebaseConfigured = false;
    try {
      const firebase = JSON.parse(secrets.get('FIREBASE_SERVICE_ACCOUNT') || '{}');
      firebaseConfigured = firebase.type === 'service_account' && Boolean(firebase.project_id && firebase.client_email && firebase.private_key?.includes('BEGIN PRIVATE KEY'));
    } catch {}

    const qualifiedDrivers = (index.drivers || []).filter(driverIsProductionQualified);

    const overview = stores.map(store => {
      const readiness = evaluateStoreReadiness({ store, index, webhook });
      return {
        store_id: store.id,
        name: store.name,
        city: store.city,
        county: store.county,
        state: store.state,
        is_active: store.is_active,
        onboarding_status: store.onboarding_status,
        compliance_status: store.compliance_status,
        stripe_connection_status: store.stripe_connection_status,
        ready: readiness.ready,
        tasks: readiness.tasks,
        missing: readiness.missing,
        checks: readiness.checks,
        blocking_count: readiness.blocking_count,
        complete_count: readiness.complete_count,
        total_count: readiness.total_count,
        legacy_relationships: readiness.legacy_relationships,
        fully_live: readiness.fully_live,
      };
    });

    return Response.json({
      stores: overview,
      global: {
        webhook_active: webhook.active,
        webhook_secret_configured: webhook.secret_configured,
        webhook_ready: webhook.ready,
        webhook_missing_events: webhook.missing_events,
        firebase_configured: firebaseConfigured,
        qualified_drivers: qualifiedDrivers.length,
      },
    });
  } catch (error) {
    console.error('Store compliance overview error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}