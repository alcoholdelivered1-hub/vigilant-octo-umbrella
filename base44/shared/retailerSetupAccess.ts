export const normalizeRetailer = value => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
export const ownsRetailer = (user, store) => user?.role === 'admin' || Boolean(user?.email && [store.email, ...(store.contact_emails || [])].some(e => e?.trim().toLowerCase() === user.email.trim().toLowerCase()));
export function setupError(message, status = 400) { return Object.assign(new Error(message), { status }); }
export async function allSetupRecords(entity, filter = {}, sort = '-created_date') {
  const items = [];
  const limit = 100;
  for (let skip = 0; ; skip += limit) {
    const page = await entity.filter(filter, sort, limit, skip);
    items.push(...page);
    if (page.length < limit) break;
  }
  return items;
}
export async function setupStore(base44, user, id) {
  if (typeof id !== 'string' || !id || id.length > 100) throw setupError('Choose a retailer.');
  const store = await base44.asServiceRole.entities.Store.get(id);
  if (!store || !ownsRetailer(user, store)) throw setupError('This store is not linked to your account.', 403);
  return store;
}
export async function retailerAmbiguity(base44, store) {
  const stores = await allSetupRecords(base44.asServiceRole.entities.Store, {}, 'name');
  const matches = stores.filter(s => s.id !== store.id && (normalizeRetailer(s.name) === normalizeRetailer(store.name) || (store.license_number && !/pending|verify/i.test(store.license_number) && normalizeRetailer(s.license_number) === normalizeRetailer(store.license_number)) || (store.address && normalizeRetailer(s.address) === normalizeRetailer(store.address) && normalizeRetailer(s.city) === normalizeRetailer(store.city))));
  return matches.length ? ['Canonical retailer is ambiguous: another store has the same name, license or address. An administrator must resolve ownership and the canonical record; no stores were merged.'] : [];
}
export async function requireUnambiguousRetailer(base44, store) {
  const blockers = await retailerAmbiguity(base44, store);
  if (blockers.length) throw setupError(blockers[0], 409);
}