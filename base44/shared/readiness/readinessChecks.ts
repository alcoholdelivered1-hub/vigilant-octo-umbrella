// The single authoritative task list. The compliance dashboard and the launch gate
// both render from this array, so labels, blockers and reasons can never drift.
// `href: 'setup'` resolves to that store's onboarding workspace.
export const READINESS_CHECKS = [
  { key: 'profile', label: 'License, address & owner contact', message: 'Complete the retailer’s license, address and owner contact.', blocking: true, href: 'setup' },
  { key: 'compliance', label: 'Retailer compliance', message: 'Resolve retailer compliance issues.', blocking: true, href: '/admin/compliance' },
  { key: 'license', label: 'Current ABC retail license', message: 'Verify a current ABC retail license and its expiration date.', blocking: true, href: 'setup' },
  { key: 'operations', label: 'Phone, hours & pickup coordinates', message: 'Confirm the store phone, operating hours and pickup coordinates.', blocking: true, href: 'setup' },
  { key: 'agreement', label: 'Signed retailer agreement', message: 'Agreement: both parties’ signed copy and administrator contract review are required; an upload or retailer signature alone is not approval.', blocking: true, href: 'setup' },
  { key: 'abc_permit', label: 'ABC third-party delivery permit', message: 'Document a current Arkansas ABC third-party delivery permit.', blocking: true, href: '/admin/compliance' },
  { key: 'city_license', label: 'Current business license', message: 'Document the current business license.', blocking: true, href: '/admin/compliance' },
  { key: 'tax', label: 'Verified tax calculation & rate', message: 'Record the retailer’s verified tax calculation and rate.', blocking: true, href: '/admin/compliance' },
  { key: 'pos', label: 'Register / POS connection', message: 'Connect and verify this store’s register merchant, or record an approved POS configuration that does not need a connection, before launch.', blocking: true, href: 'setup' },
  { key: 'inventory', label: 'Real inventory & shelf prices', message: 'The retailer must confirm real inventory and shelf prices.', blocking: true, href: 'setup' },
  { key: 'test', label: 'Sandbox checkout & delivery test', message: 'Record a successful sandbox checkout, notification and delivery-handoff test before activation.', blocking: true, href: 'setup' },
  { key: 'stripe', label: 'Stripe identity, bank & payment readiness', message: 'Connect this retailer’s own Stripe account, complete identity verification and enable charges and payouts.', blocking: false, href: 'setup' },
  { key: 'webhook', label: 'Payment webhook delivery', message: 'The payment webhook signing secret is missing; configure payment webhook delivery before launch.', blocking: false, href: '/admin/store-compliance' },
  { key: 'driver', label: 'Qualified driver available', message: 'An available driver needs administrator-reviewed current annual ABC training, a Server Awareness form, valid license, and completed real background clearance.', blocking: true, href: '/driver-onboarding' },
  { key: 'zone', label: 'Legal delivery zone', message: 'Configure a legal delivery zone for the retailer’s county.', blocking: true, href: '/admin/zones/editor' },
];

export const READINESS_CHECK_KEYS = READINESS_CHECKS.map(check => check.key);

export function readinessCheck(key) {
  return READINESS_CHECKS.find(check => check.key === key) || null;
}