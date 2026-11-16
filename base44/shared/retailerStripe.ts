import { secrets } from 'base44:runtime';

export async function retailerStripeRequest(path, params = null, accountId = null) {
  const headers = { Authorization: `Bearer ${secrets.get('STRIPE_SECRET_KEY')}`, 'Stripe-Version': '2025-10-29.clover' };
  if (accountId) headers['Stripe-Account'] = accountId;
  if (params) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    headers['Idempotency-Key'] = crypto.randomUUID();
  }
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method: params ? 'POST' : 'GET', headers,
    ...(params ? { body: new URLSearchParams(params) } : {}),
  });
  const data = await response.json();
  if (!response.ok) {
    console.error('Retailer Stripe request failed', path, response.status, data.error?.code);
    throw new Error(response.status === 403 || data.error?.code === 'account_invalid'
      ? 'This retailer’s Stripe account must be reauthorized by its owner.'
      : (data.error?.message || 'Stripe could not complete this request.').replace(/(?:sk|rk)_(?:live|test)_\S+/g, '[redacted]'));
  }
  return data;
}

export async function createRetailerStripeAccount(store) {
  return retailerStripeRequest('/accounts', {
    type: 'standard', country: 'US', email: store.email,
    'business_profile[name]': store.name,
    'capabilities[card_payments][requested]': 'true',
    'capabilities[transfers][requested]': 'true',
    'metadata[base44_app_id]': secrets.get('BASE44_APP_ID'),
    'metadata[store_id]': store.id,
  });
}

export async function getRetailerStripeAccount(store) {
  if (!/^acct_[A-Za-z0-9]+$/.test(store.stripe_connect_account_id || '')) throw new Error('This retailer must connect its own Stripe account before accepting payments.');
  const account = await retailerStripeRequest(`/accounts/${encodeURIComponent(store.stripe_connect_account_id)}`);
  const normalize = value => (value || '').trim().toLowerCase();
  const mappedStore = account.metadata?.store_id;
  const ownerMatches = normalize(account.email) === normalize(store.email);
  const nameMatches = normalize(account.business_profile?.name || account.company?.name) === normalize(store.name);
  if (mappedStore ? mappedStore !== store.id : !(ownerMatches && nameMatches)) {
    throw new Error('The connected payment account must belong to this retailer. Confirm its owner before accepting orders.');
  }
  return account;
}

export function retailerPaymentsReady(account) {
  return account.charges_enabled === true && account.payouts_enabled === true && account.details_submitted === true;
}