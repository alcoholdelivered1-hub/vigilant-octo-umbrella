const APP_URL = 'https://alcohol-delivered.biz';
const escapeText = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

export function retailerNextStep(store, inspection) {
  const keys = new Set(inspection.completed.map(step => step.key));
  const setup = `${APP_URL}/onboarding?store_id=${encodeURIComponent(store.id)}`;
  const choices = [
    ['profile', 'profile', 'Complete your store profile', 'Add your license number, address, county and store contact details.'],
    ['license', 'profile', 'Confirm your retail license', 'Provide your current ABC retail license and expiration date so John Bess can review them.'],
    ['agreement', 'agreement', 'Review and sign the retailer agreement', 'Open the retailer agreement, review the terms, and contact John Bess to return your signed copy.'],
    ['stripe_connected', 'stripe', 'Complete Stripe setup', 'Connect your store’s Stripe account and complete its business, identity and bank information securely in Stripe.'],
    ...(store.email?.toLowerCase() === 'bevking71603@gmail.com' ? [['clover_connected', 'clover', 'Authorize Clover', 'Connect Beverage King’s Clover account so its real products, prices and availability can be synced.']] : []),
    ['inventory', 'inventory', 'Load your real inventory', 'Provide your store’s actual products, shelf prices and availability in Inventory setup.'],
    ['operations', 'profile', 'Confirm store operations', 'Confirm your phone number, opening hours and pickup location with John Bess.'],
  ];
  const next = choices.find(([key]) => !keys.has(key));
  if (next) return { title: next[2], description: next[3], url: `${setup}&step=${next[1]}` };
  return { title: 'Final launch review', description: 'Your retailer setup steps are recorded. John Bess will review the remaining tax, compliance, payment and delivery requirements; no further approval is implied by this email.', url: `${setup}&step=golive` };
}

export async function retailerStepEmail(base44, store, inspection, previous, { initialize = false, preview = false } = {}) {
  const completed = [...inspection.completed];
  if (['contract_signed', 'inventory_added', 'live'].includes(store.onboarding_status) && !completed.some(step => step.key === 'agreement')) {
    completed.push({ key: 'agreement', label: 'Retailer agreement recorded as signed' });
  }
  const added = completed.filter(step => !(previous?.completed_keys || []).includes(step.key));
  const next = retailerNextStep(store, { ...inspection, completed });
  const result = { sent: false, initialized: !previous || initialize, new_steps: previous ? added.map(step => step.label) : [], next_step: next.title, next_url: next.url };
  if (preview) return result;
  const snapshot = { store_id: store.id, completed_keys: completed.map(step => step.key), checked_at: new Date().toISOString() };
  if (previous && !initialize && added.length) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(store.email || '')) return { ...result, skipped: 'Store contact email is missing or invalid' };
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: store.email,
      from_name: 'Alcohol Delivered',
      template_name: 'RetailerOnboardingProgress',
      variables: { store_name: escapeText(store.name), completed_steps: added.map(step => escapeText(step.label)).join('; '), next_title: next.title, next_description: next.description, next_url: next.url },
    });
    snapshot.last_email_at = new Date().toISOString();
    result.sent = true;
  }
  const changed = !previous || completed.length !== previous.completed_keys.length || completed.some(step => !previous.completed_keys.includes(step.key));
  if (previous && (changed || result.sent)) await base44.entities.RetailerStepEmailState.update(previous.id, snapshot);
  else if (!previous) await base44.entities.RetailerStepEmailState.create(snapshot);
  return result;
}