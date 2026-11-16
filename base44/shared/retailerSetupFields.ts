const f = (key, label, type = 'text', required = true) => ({ key, label, type, required });
export const setupSteps = [
  { key: 'business', title: 'Business and contact details', fields: [f('name','Licensed business name'), f('address','Street address'), f('city','City'), f('state','State'), f('zip_code','ZIP code'), f('county','County'), f('phone','Business phone','tel'), f('email','Business contact email','email'), f('representative_name','Authorized representative'), f('representative_title','Representative title')] },
  { key: 'license', title: 'Retail license and evidence', evidence: 'retail_license', fields: [f('license_number','ABC license number'), f('license_expiration_date','License expiration','date'), f('renewal_contact','Renewal contact'), f('notes','Verification source / notes','textarea')] },
  { key: 'operations', title: 'Hours, location and delivery eligibility', fields: [f('latitude','Pickup latitude','number'), f('longitude','Pickup longitude','number'), f('operating_hours_start','Weekday opening','time'), f('operating_hours_end','Weekday closing','time'), f('saturday_hours_start','Saturday opening','time'), f('saturday_hours_end','Saturday closing','time'), f('sunday_closed','Closed Sundays','checkbox',false), f('sunday_hours_start','Sunday opening (if open)','time',false), f('sunday_hours_end','Sunday closing (if open)','time',false), f('notes','Pickup instructions and delivery restrictions','textarea')] },
  { key: 'pos', title: 'POS authorization and inventory feed', fields: [f('pos_provider','POS provider'), f('pos_contact','Authorized POS contact'), f('inventory_method','Inventory method (Clover / CSV / Sheet)'), f('inventory_refresh','Inventory refresh frequency')] },
  { key: 'inventory', title: 'Sellable inventory and pricing review', evidence: 'inventory_export', fields: [f('notes','Catalog source, price checks and stock reconciliation','textarea')] },
  { key: 'device', title: 'Device and notification test', fields: [
    f('device_name','Device / browser'),
    f('tested_at','Test date','date'),
    f('test_order_reference','Sandbox order reference'),
    f('test_amount','Sandbox test amount (USD)','number'),
    f('retailer_accepted','Retailer accepted the sandbox order on the registered device','checkbox'),
    f('notification_confirmed','Retailer notification was received on the registered device','checkbox'),
    f('handoff_confirmed','Pickup and handoff confirmed for the sandbox order','checkbox'),
    f('notes','Test notes and results','textarea', false),
  ] },
];
export function validateSetupFields(kind, input, submit = false) {
  const step = setupSteps.find(s => s.key === kind);
  if (!step || !input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Choose a valid onboarding step and its fields.');
  const allowed = new Set(step.fields.map(f => f.key));
  if (Object.keys(input).some(key => !allowed.has(key))) throw new Error('Unrecognized or protected fields were submitted.');
  const fields = {};
  for (const def of step.fields) {
    const value = input[def.key] ?? (def.type === 'checkbox' ? false : '');
    if (def.type === 'checkbox') { if (typeof value !== 'boolean') throw new Error(`${def.label} must be yes or no.`); fields[def.key] = value; continue; }
    if (typeof value !== 'string' || value.length > (def.type === 'textarea' ? 1500 : 250)) throw new Error(`Invalid ${def.label}.`);
    fields[def.key] = value.trim();
    if (submit && def.required && !fields[def.key]) throw new Error(`${def.label} is required.`);
    if (!fields[def.key]) continue;
    if (def.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error('Enter a valid business contact email.');
    if (def.type === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value)) throw new Error(`Invalid ${def.label}.`);
    if (def.type === 'time' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error(`Invalid ${def.label}.`);
    if (def.type === 'number' && (!Number.isFinite(Number(value)) || Math.abs(Number(value)) > (def.key === 'latitude' ? 90 : 180))) throw new Error(`Invalid ${def.label}.`);
  }
  if (submit && kind === 'operations' && !fields.sunday_closed && (!fields.sunday_hours_start || !fields.sunday_hours_end)) throw new Error('Enter Sunday hours or select Closed Sundays.');
  if (submit && kind === 'business' && (fields.state.toUpperCase() !== 'AR' || !/^\d{5}(-\d{4})?$/.test(fields.zip_code) || fields.phone.replace(/\D/g,'').length < 10)) throw new Error('An Arkansas address, valid ZIP and business phone are required.');
  return fields;
}
export function setupStoreMapping(kind, fields, store) {
  const keys = kind === 'business' ? ['name','address','city','state','zip_code','county','phone','email'] : kind === 'license' ? ['license_number','license_expiration_date'] : kind === 'operations' ? setupSteps.find(s => s.key === kind).fields.map(f => f.key).filter(k => k !== 'notes') : [];
  const update = Object.fromEntries(keys.map(key => [key, ['latitude','longitude'].includes(key) ? Number(fields[key]) : fields[key]]));
  if (kind === 'business') update.contact_emails = [...new Set([store.email, ...(store.contact_emails || [])].filter(Boolean))];
  return update;
}