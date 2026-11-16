import { setupError } from './retailerSetupAccess.ts';
import { latestBy, posProviderOf, readinessConfigSignature, sandboxEvidenceFromFields, sandboxMissingParts } from './readiness/readinessEvidence.ts';

async function sandboxEvidence(base44, store, record, fields, user) {
  const [posRows, cloverRows, agreementRows, taxRows] = await Promise.all([
    base44.asServiceRole.entities.RetailerSetupSubmission.filter({ store_id: store.id, step: 'pos', status: 'approved' }, '-created_date', 1),
    base44.asServiceRole.entities.CloverConnection.filter({ store_id: store.id }, '-updated_date', 1),
    base44.asServiceRole.entities.RetailerAgreement.filter({ store_id: store.id }, '-created_date', 1),
    base44.asServiceRole.entities.TaxConfirmation.filter({ store_id: store.id }, '-confirmed_at', 1),
  ]);
  const signature = readinessConfigSignature({
    store,
    posProvider: posProviderOf(posRows[0]),
    cloverConnection: latestBy(cloverRows),
    agreement: latestBy(agreementRows),
    tax: latestBy(taxRows),
  });
  const evidence = sandboxEvidenceFromFields(fields, {
    submission_id: record.id,
    recorded_by: user.email,
    recorded_at: new Date().toISOString(),
    config_signature: signature,
  });
  return { evidence, signature, complete: sandboxMissingParts(evidence).length === 0 };
}

export async function mapRetailerSetupReview(base44,user,store,record,fields) {
  const linked = await base44.asServiceRole.entities.RetailerOnboarding.filter({ store_id:store.id },'-created_date',2);
  const byName = linked.length ? [] : await base44.asServiceRole.entities.RetailerOnboarding.filter({ name:store.name },'-created_date',2);
  const candidates = linked.length ? linked : byName;
  if (candidates.length > 1 || candidates[0]?.store_id && candidates[0].store_id !== store.id) throw setupError('Multiple onboarding records or a conflicting store link require administrator resolution; no duplicate onboarding record was created.',409);
  const data = { store_id:store.id,last_reviewed_by:user.email,last_reviewed_at:new Date().toISOString(),last_submission_id:record.id };
  if (record.step === 'business') Object.assign(data,{ name:fields.name,address:fields.address,contact_name:fields.representative_name,contact_title:fields.representative_title,contact_email:fields.email });
  if (record.step === 'license') data.license_number = fields.license_number;
  if (record.step === 'pos') for (const key of ['pos_provider','pos_contact','inventory_method','inventory_refresh']) data[key] = fields[key];
  if (record.step === 'inventory') data.catalog_verified = true;
  if (record.step === 'device') {
    const sandbox = await sandboxEvidence(base44, store, record, fields, user);
    data.sandbox_evidence = sandbox.evidence;
    data.sandbox_config_signature = sandbox.signature;
    data.test_order_passed = sandbox.complete;
  }
  if (candidates[0]) return await base44.asServiceRole.entities.RetailerOnboarding.update(candidates[0].id,data);
  return await base44.asServiceRole.entities.RetailerOnboarding.create({ name:store.name,status:'details_pending',...data });
}