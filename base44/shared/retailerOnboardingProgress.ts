import { READINESS_CHECKS } from './readiness/readinessChecks.ts';

// Rendered states map onto the statuses this checklist has always exposed.
const DISPLAY_STATUS = {
  complete: 'complete',
  not_required: 'complete',
  verification: 'verification',
  missing: 'missing',
  incomplete: 'missing',
  pending: 'pending',
  expired: 'expired',
  stale: 'stale',
  placeholder: 'missing',
  unlinked: 'missing',
  wrong_store: 'missing',
  inactive: 'missing',
  no_document: 'missing',
  no_issue_date: 'missing',
  no_expiration: 'missing',
  not_yet_valid: 'missing',
};

export function retailerOnboardingProgress(store, blockers = [], webhookSecretConfigured = false, readiness = null) {
  const setup = `/onboarding?store_id=${encodeURIComponent(store.id)}`;
  const resolveHref = value => (value === 'setup' ? setup : value || setup);
  const listed = Array.isArray(blockers) ? blockers : [];

  // Prefer the shared evaluation so the launch gate shows exactly what the dashboard shows.
  const checks = readiness?.checks?.length
    ? readiness.checks.map(check => ({
      key: check.key,
      label: check.label,
      href: resolveHref(check.href),
      blocking: check.blocking,
      status: DISPLAY_STATUS[check.status] || 'missing',
      state: check.status,
      detail: check.reason,
    }))
    : READINESS_CHECKS.map(definition => {
      const failing = listed.includes(definition.message);
      return {
        key: definition.key,
        label: definition.label,
        href: resolveHref(definition.href),
        blocking: definition.blocking,
        status: failing ? 'missing' : 'complete',
        state: failing ? 'missing' : 'complete',
        detail: failing ? definition.message : 'Required evidence is on file and passes the current launch check.',
      };
    });

  // A blocker that is not one of the shared requirements must still be visible.
  const known = new Set(READINESS_CHECKS.map(definition => definition.message));
  listed.filter(message => !known.has(message)).forEach((message, index) => checks.push({
    key: `blocking-${index}`,
    label: 'Onboarding review requirement',
    href: setup,
    blocking: true,
    status: 'missing',
    state: 'missing',
    detail: message,
  }));

  return {
    store_id: store.id,
    store_name: store.name,
    city: store.city,
    stage: store.onboarding_status || 'pending',
    live: store.is_active === true && store.onboarding_status === 'live',
    webhook_secret_configured: webhookSecretConfigured === true,
    checks,
    checked_at: new Date().toISOString(),
    preview: true,
    activated: false,
  };
}