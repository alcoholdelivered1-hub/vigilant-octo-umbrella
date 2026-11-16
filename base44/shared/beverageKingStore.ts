export const BK_STORE_EMAIL = 'bevking71603@gmail.com';

// The Beverage King store record's email has been stored with different
// capitalizations over time (e.g. BEVKING71603@GMAIL.COM), while launch
// functions looked it up with an exact lowercase match and reported the
// store as missing. Resolve it case-insensitively instead, with the store
// name as a fallback, so every go-live gate reads the same record the
// admin pages edit. The service role keeps the lookup independent of the
// caller's own store-access rights.
export async function findBeverageKingStores(base44) {
  const stores = await base44.asServiceRole.entities.Store.list('-updated_date');
  return stores.filter((s) =>
    (s.email || '').trim().toLowerCase() === BK_STORE_EMAIL
    || /^beverage king$/i.test((s.name || '').trim())
  );
}