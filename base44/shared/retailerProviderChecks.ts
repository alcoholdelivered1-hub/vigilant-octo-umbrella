import { getRetailerStripeAccount, retailerPaymentsReady } from './retailerStripe.ts';
import { buildReadinessIndex } from './readiness/readinessIndex.ts';
import { evaluateStoreReadiness } from './readiness/evaluateStoreReadiness.ts';
import { getCloverClient } from './cloverConnection.ts';
import { cloverRequiredFor, posProviderOf } from './readiness/readinessEvidence.ts';

// Provider verification is read-only: it inspects the store's own accounts and never
// creates charges, payouts or account changes.
export async function retailerProviderChecks(base44, store) {
  const blockers = [];
  const index = await buildReadinessIndex(base44, { storeId: store.id, store });
  const readiness = evaluateStoreReadiness({ store, index });
  const result = { stripe: { verified: false }, clover: { verified: false }, activated: false };

  try {
    const account = await getRetailerStripeAccount(store);
    result.stripe = {
      verified: retailerPaymentsReady(account),
      account_id: account.id,
      charges_enabled: account.charges_enabled === true,
      payouts_enabled: account.payouts_enabled === true,
      details_submitted: account.details_submitted === true,
      disabled_reason: account.requirements?.disabled_reason || '',
      requirements: account.requirements?.currently_due || [],
    };
    if (!result.stripe.verified) blockers.push(`Stripe: charges and payouts must both be enabled. ${result.stripe.disabled_reason || result.stripe.requirements.join(', ') || 'Complete hosted verification.'}`);
  } catch (error) {
    blockers.push(`Stripe: ${error.message}`);
  }

  const posSubmission = index.submissions.find(row => row.store_id === store.id && row.step === 'pos' && row.status === 'approved') || null;
  const posProvider = posProviderOf(posSubmission);
  const required = cloverRequiredFor(posProvider);
  const connection = index.clover.filter(row => row.store_id === store.id)
    .sort((a, b) => Date.parse(b.connected_at || b.updated_date || 0) - Date.parse(a.connected_at || a.updated_date || 0))[0] || null;
  result.clover = {
    required,
    verified: false,
    state: 'not_required',
    pos_provider: posProvider || null,
    merchant_id: connection?.merchant_id || null,
    merchant_name: connection?.merchant_name || null,
    connection_status: connection?.status || null,
  };

  if (required) {
    const posCheck = readiness.checks.find(check => check.key === 'pos');
    result.clover.state = posCheck?.status === 'complete' ? 'connected' : (posCheck?.status || 'missing');
    try {
      const client = await getCloverClient(base44, store.id);
      const response = await fetch(`${client.origin}/v3/merchants/${encodeURIComponent(client.merchantId)}`, { headers: client.headers, signal: AbortSignal.timeout(8000) });
      const merchant = await response.json();
      if (!response.ok || merchant.id !== client.merchantId || !merchant.name) throw new Error('Authorize this store’s own register merchant; the connection could not be verified.');
      result.clover = { ...result.clover, verified: true, state: 'connected', merchant_id: merchant.id, merchant_name: merchant.name };
    } catch (error) {
      result.clover.state = result.clover.state === 'connected' ? 'missing' : result.clover.state;
      blockers.push(`Clover: ${error.message}`);
    }
  }

  return {
    ...result,
    readiness: { ready: readiness.ready, checks: readiness.checks.filter(check => ['pos', 'stripe', 'webhook'].includes(check.key)) },
    blockers,
    checked_at: new Date().toISOString(),
    activated: false,
  };
}