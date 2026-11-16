const titles = {
  store_found: ['Admin', 'Beverage King store record found'],
  retailer_agreement_signed: ['Owner', 'Retailer partner agreement signed'],
  compliance_clear: ['Admin', 'Store compliance approved'],
  license_present: ['Owner', 'Store retail license recorded'],
  abc_delivery_permit_documented: ['Admin', 'Current platform ABC delivery permit documented'],
  city_business_license_documented: ['Admin', 'Current Pine Bluff business license documented'],
  tax_confirmation_recorded: ['Admin', 'DFA guidance and checkout tax calculation reviewed'],
  inventory_synced: ['Owner', 'Liquor Bee inventory downloaded'],
  stripe_account_accessible: ['Owner', 'Stripe account accessible'],
  stripe_account_matches_store: ['Owner', 'Stripe account ownership verified'],
  stripe_details_submitted: ['Owner', 'Stripe business and identity details submitted'],
  stripe_charges_enabled: ['Owner', 'Stripe card charges enabled'],
  stripe_payouts_enabled: ['Owner', 'Stripe bank payouts enabled'],
  stripe_store_mapping: ['Admin', 'Store linked to its ready Stripe account'],
  webhook_active: ['Admin', 'Stripe payment and account notifications configured'],
  webhook_secret_configured: ['Admin', 'Stripe notification signing secret configured'],
  firebase_service_account_configured: ['Admin', 'Push notification credentials configured'],
  retailer_push_token_registered: ['Staff', 'Store tablet notifications registered'],
  available_driver_with_push: ['Driver', 'Available trained driver with real clearance and notifications'],
  test_order_passed: ['Admin', 'Sandbox order, retailer alert and delivery handoff verified'],
};

export function beverageKingLaunchChecklist(checks) {
  return Object.entries(titles).map(([key, [owner, title]]) => ({ key, owner, title, done: checks[key] === true }));
}