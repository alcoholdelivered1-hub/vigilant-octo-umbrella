import { buildReadinessIndex } from './readiness/readinessIndex.ts';
import { evaluateStoreReadiness } from './readiness/evaluateStoreReadiness.ts';

// Single entry point for one store: load its evidence once, evaluate it once.
export async function loadStoreReadiness(base44, store, options = {}) {
  const index = options.index || await buildReadinessIndex(base44, { storeId: store.id, store });
  return evaluateStoreReadiness({ store, index, today: options.today, stripe: options.stripe, webhook: options.webhook });
}

export async function loadReadinessBlockers(base44, store, options = {}) {
  return (await loadStoreReadiness(base44, store, options)).blockers;
}