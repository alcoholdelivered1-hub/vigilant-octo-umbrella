import { agreementFields, agreementVersion } from './retailerAgreementTerms.ts';
import { allSetupRecords, setupError } from './retailerSetupAccess.ts';

export function freshAgreementFields(store, configuration) {
  return { ...Object.fromEntries(Object.keys(agreementFields).map(key => [key, ''])), store_name:store.name, address:store.address || '', city_state_zip:`${store.city || ''}, ${store.state || 'AR'} ${store.zip_code || ''}`.trim(), license_number:/pending|verify|unknown/i.test(store.license_number || '') ? '' : store.license_number || '', phone:store.phone || '', email:store.email || '', license_expiration_date:store.license_expiration_date || '', ...Object.fromEntries(['payment_days','term_months','effective_date'].map(key => [key,configuration?.[key] || ''])) };
}
export function freshAgreementValues(store, configuration, previous) {
  return { store_id:store.id, store_name:store.name, contact_emails:[...new Set([store.email,...(store.contact_emails || [])].filter(Boolean))], fields:freshAgreementFields(store,configuration), status:'draft', terms_version:`${agreementVersion}/document-${crypto.randomUUID()}`, configuration_id:configuration?.id || '', supersedes_id:previous?.id || '', revision:0 };
}
export function checkAgreementIdentity(store, fields) {
  for (const key of ['store_name','address','city_state_zip']) {
    const expected = freshAgreementFields(store,null)[key];
    if (fields[key] !== expected) throw setupError('This agreement must use the selected retailer’s own business details. Submit business corrections through retailer setup before signing.',409);
  }
}
export async function prepareFreshRetailerAgreements(base44, user, payload) {
  if (user.role !== 'admin') throw setupError('Administrator access required.',403);
  if (payload.confirmed !== true) throw setupError('Confirm preparation of separate fresh agreements.');
  const stores = await allSetupRecords(base44.asServiceRole.entities.Store,{},'name');
  if (stores.length > 100) throw setupError('Prepare agreements for at most 100 retailers at a time.');
  const records = await allSetupRecords(base44.asServiceRole.entities.RetailerAgreement);
  const configurations = await allSetupRecords(base44.asServiceRole.entities.RetailerContractConfiguration);
  const batch = payload.batch_id;
  if (typeof batch !== 'string' || !/^[a-z0-9-]{10,100}$/i.test(batch)) throw setupError('A preparation reference is required.');
  const values = stores.filter(store => !records.some(record => record.store_id === store.id && record.terms_version?.endsWith(`/fresh-${batch}`))).map(store => ({ ...freshAgreementValues(store,configurations.find(c => c.store_id === store.id),records.find(r => r.store_id === store.id)), terms_version:`${agreementVersion}/document-${(records.filter(r => r.store_id === store.id).length + 1)}/fresh-${batch}` }));
  if (values.length) await base44.asServiceRole.entities.RetailerAgreement.bulkCreate(values);
  return { success:true, prepared:values.length, total:stores.length, sent:false };
}