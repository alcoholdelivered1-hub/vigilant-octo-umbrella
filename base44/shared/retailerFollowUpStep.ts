import { loadStoreReadiness } from './storeReadiness.ts';
import { retailerOnboardingProgress } from './retailerOnboardingProgress.ts';
import { retailerNextStep } from './retailerStepEmail.ts';

export async function retailerFollowUpStep(base44, store) {
  const readiness = await loadStoreReadiness(base44, store);
  const progress = retailerOnboardingProgress(store, readiness.blockers, false, readiness);
  const completed = progress.checks.filter(check => check.status === 'complete').map(check => ({ key: check.key }));
  return retailerNextStep(store, { completed });
}