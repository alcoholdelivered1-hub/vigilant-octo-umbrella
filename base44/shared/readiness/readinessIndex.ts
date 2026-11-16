import { allSetupRecords } from '../retailerSetupAccess.ts';
import { attachDriverCompliance } from '../driverAnnualCompliance.ts';

// Every readiness surface loads evidence through this one index, scoped by store id.
export async function buildReadinessIndex(base44, { storeId = null, store = null } = {}) {
  const entities = base44.asServiceRole.entities;
  const scope = storeId ? { store_id: storeId } : {};
  const list = (entity, filter) => allSetupRecords(entity, filter);
  const [submissions, documents, agreements, taxes, clover, onboarding, coverage, tokens, zones] = await Promise.all([
    list(entities.RetailerSetupSubmission, scope),
    list(entities.StoreSetupDocument, scope),
    list(entities.RetailerAgreement, scope),
    list(entities.TaxConfirmation, scope),
    list(entities.CloverConnection, scope),
    // Onboarding records are small and needed in full to resolve legacy name-only links.
    list(entities.RetailerOnboarding, {}),
    list(entities.DriverStoreCoverage, scope),
    list(entities.FCMToken, scope),
    list(entities.DeliveryZone, { is_active: true, is_wet: true }),
  ]);
  const permits = storeId
    ? await list(entities.BusinessPermit, store?.email ? { $or: [{ store_id: storeId }, { store_email: store.email }] } : { store_id: storeId })
    : await list(entities.BusinessPermit, {});
  const products = storeId
    ? await list(entities.Product, { store_id: storeId })
    : await entities.Product.filter({}, '-updated_date', 3000);
  const drivers = await attachDriverCompliance(base44, await list(entities.Driver, { is_active: true }));
  return { submissions, documents, agreements, taxes, clover, onboarding, coverage, tokens, zones, permits, products, drivers };
}