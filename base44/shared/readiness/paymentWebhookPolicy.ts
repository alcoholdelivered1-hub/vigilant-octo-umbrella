// One payment-webhook rule set shared by the compliance dashboard and the launch gate.
export const PAYMENT_WEBHOOK_PATH = '/functions/stripeWebhook';

export const PAYMENT_WEBHOOK_EVENTS = [
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'account.updated',
];

export function webhookEndpointIsReady(endpoint, appUrl) {
  if (!endpoint || endpoint.status !== 'enabled') return false;
  if (endpoint.url !== `${appUrl}${PAYMENT_WEBHOOK_PATH}`) return false;
  const events = endpoint.enabled_events || [];
  return events.includes('*') || PAYMENT_WEBHOOK_EVENTS.every(event => events.includes(event));
}

export function webhookStatus({ secretConfigured, endpoints, appUrl }) {
  const active = Array.isArray(endpoints) && endpoints.some(endpoint => webhookEndpointIsReady(endpoint, appUrl));
  const matched = Array.isArray(endpoints) ? endpoints.find(endpoint => endpoint.url === `${appUrl}${PAYMENT_WEBHOOK_PATH}`) : null;
  const events = matched?.enabled_events || [];
  const missing_events = matched && !events.includes('*')
    ? PAYMENT_WEBHOOK_EVENTS.filter(event => !events.includes(event))
    : [];
  return {
    secret_configured: secretConfigured === true,
    active,
    missing_events,
    ready: secretConfigured === true && active,
  };
}