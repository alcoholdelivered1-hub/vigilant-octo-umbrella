import { loadStoreReadiness } from './storeReadiness.ts';

// Launch gate: the same evaluation the compliance dashboard renders, reduced to blockers.
// Preloaded evidence must be a readiness index; legacy ad-hoc evidence maps are ignored
// so the gate can never evaluate different rules from the dashboard.
export async function readRetailerLaunchEvidence(base44, store, evidence = {}) {
  const readiness = await loadStoreReadiness(base44, store, {
    index: Array.isArray(evidence.submissions) ? evidence : undefined,
    stripe: evidence.stripe || null,
    webhook: evidence.webhook || null,
  });
  return [...new Set(readiness.blockers)];
}