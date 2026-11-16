const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function beverageKingFinalStepsEmail(store, report) {
  const url = `https://alcohol-delivered.biz/onboarding?store_id=${encodeURIComponent(store.id)}`;
  const c = report.checks;
  const owner = [];
  const operations = [];
  if (!c.retailer_agreement_signed) owner.push('Review and sign the retailer partner agreement.');
  if (!c.license_present) owner.push('Record your current Arkansas ABC retail license in the store profile.');
  if (!c.stripe_details_submitted || !c.stripe_charges_enabled || !c.stripe_payouts_enabled || !c.stripe_account_matches_store) owner.push('Open Connect Stripe in the setup tracker and complete the requested business, identity, and bank details for Beverage King. The secure form must be completed by the owner; both charges and payouts must be enabled.');
  if (!c.clover_connected || !c.clover_merchant_verified || !c.clover_catalog_available || !c.verified_inventory_available) owner.push('Authorize Beverage King’s own Clover account, then work with Alcohol Delivered to sync and verify its real inventory, prices, and availability. Do not use a different store’s Clover account or sample products.');
  if (!c.retailer_push_token_registered) owner.push('Open the store dashboard on the device used for orders and enable notifications.');
  else owner.push('Keep the store device signed in with notifications enabled, and participate in the final retailer-alert test. Device registration is already recorded.');
  if (!c.tax_confirmation_recorded) operations.push('Record DFA tax guidance and evidence that the destination/category checkout tax calculation was reviewed.');
  if (!c.firebase_service_account_configured) operations.push('Complete the push-notification service configuration.');
  if (!c.available_driver_with_push) operations.push('Have an available, trained driver with real completed background clearance, age/license/vehicle checks, and registered notifications.');
  if (!c.test_order_passed) operations.push('Complete and record a sandbox payment, retailer notification, and delivery handoff test. No live customer charge is needed for this test.');
  if (!c.compliance_clear || !c.abc_delivery_permit_documented || !c.city_business_license_documented) operations.push('Resolve the remaining compliance and permit-document checks.');
  if (!c.webhook_active || !c.webhook_secret_configured) operations.push('Complete the payment/account notification configuration.');
  if (!c.stripe_store_mapping) operations.push('Confirm Beverage King is linked to its verified, payment-ready Stripe account after owner onboarding.');
  const list = items => items.length ? `<ol>${items.map(item => `<li style="margin-bottom:12px">${escapeHtml(item)}</li>`).join('')}</ol>` : '<p>No outstanding items in this section.</p>';
  return `<html><body style="font-family:Arial,sans-serif;line-height:1.6;color:#172033;max-width:620px;margin:24px auto;padding:16px">
    <h1>Beverage King: final go-live steps</h1>
    <p>Hello Beverage King team,</p>
    <p>Here is your current store setup link. Sign in with your store contact account (${escapeHtml(store.email)}); the tracker opens Beverage King’s setup.</p>
    <p><a href="${url}">Continue Beverage King setup</a></p><p>${url}</p>
    <p>Readiness checked ${escapeHtml(new Date().toISOString())}: <strong>${report.done} of ${report.total} checks passed.</strong> ${report.ready ? 'All launch checks currently pass.' : 'Beverage King is not yet cleared for launch.'}</p>
    ${c.retailer_agreement_signed ? '<p>Your retailer agreement is already recorded as complete; you do not need to sign it again.</p>' : ''}
    <h2>Store owner and staff</h2>${list(owner)}
    <h2>Alcohol Delivered responsibilities</h2>${list(operations)}
    <p>Please work through the tracker one step at a time and reply when the owner steps are complete so we can coordinate the final test. Never email passwords, Clover access tokens, bank details, or identity documents; use the secure setup forms.</p>
    <p>A saved “live” label is not launch approval. All verified readiness checks must pass before launch.</p>
    <p>Contact John Bess directly: <a href="tel:+18707181521">870-718-1521</a></p>
    <p>Alcohol Delivered</p>
  </body></html>`;
}