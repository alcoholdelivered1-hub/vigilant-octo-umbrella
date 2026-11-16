// Explicit public projection. Never return retailer contacts, payment IDs or notes.
const fields = ['id','name','address','city','county','state','zip_code','latitude','longitude','image_url','description','operating_hours_start','operating_hours_end','saturday_hours_start','saturday_hours_end','sunday_closed','sunday_hours_start','sunday_hours_end','is_active','is_browsable','onboarding_status','compliance_status','stripe_connection_status','sales_tax_rate','placement_tier','placement_expires'];
export const isPublicStore = store => store?.is_active === true || store?.is_browsable === true;
export const isOrderingStore = store => store?.is_active === true && store?.onboarding_status === 'live' && store?.compliance_status === 'compliant' && store?.stripe_connection_status === 'connected';
export function publicStore(store) {
  return Object.fromEntries(fields.filter(key => Object.hasOwn(store, key)).map(key => [key, store[key]]));
}
