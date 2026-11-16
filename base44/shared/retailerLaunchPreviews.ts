import { allSetupRecords } from './retailerSetupAccess.ts';
import { buildReadinessIndex } from './readiness/readinessIndex.ts';
import { evaluateStoreReadiness } from './readiness/evaluateStoreReadiness.ts';
import { retailerOnboardingProgress } from './retailerOnboardingProgress.ts';

export async function retailerLaunchPreviews(base44, user, webhookConfigured) {
  const email = user.email?.trim().toLowerCase();
  const stores = (await allSetupRecords(base44.asServiceRole.entities.Store, {}, 'name')).filter(store =>
    user.role === 'admin' || Boolean(email && [store.email, ...(store.contact_emails || [])].some(contact => contact?.trim().toLowerCase() === email)));
  if (!stores.length) return [];
  // One evidence index for every authorized store, then the same evaluation the dashboard uses.
  const index = await buildReadinessIndex(base44, {});
  return stores.map(store => {
    const readiness = evaluateStoreReadiness({ store, index });
    const result = retailerOnboardingProgress(store, readiness.blockers, webhookConfigured, readiness);
    if (user.role !== 'admin') result.checks = result.checks.map(check => ({ ...check, href: `/onboarding?store_id=${encodeURIComponent(store.id)}` }));
    return result;
  });
}