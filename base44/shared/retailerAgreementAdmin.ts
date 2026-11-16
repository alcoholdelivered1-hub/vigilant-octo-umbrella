import { agreementVersion } from './retailerAgreementTerms.ts';
import { retailerAgreementPdf } from './retailerAgreementPdf.ts';
import { setupError } from './retailerSetupAccess.ts';
export async function configureRetailerAgreement(base44,user,store,body) {
  if (user.role !== 'admin') throw setupError('Only an administrator can configure commercial terms.',403);
  const fields = {};
  for (const key of ['payment_days','term_months','effective_date','resolution_note']) {
    if (typeof body[key] !== 'string' || body[key].length > 1500) throw setupError(`Enter ${key.replaceAll('_',' ')}.`);
    fields[key] = body[key].trim();
  }
  if (!/^\d{1,3}$/.test(fields.payment_days) || Number(fields.payment_days) < 1 || !/^\d{1,3}$/.test(fields.term_months) || Number(fields.term_months) < 1) throw setupError('Remittance business days and duration must be explicitly agreed (1–999).');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fields.effective_date) || !Number.isFinite(Date.parse(fields.effective_date)) || fields.resolution_note.length < 30 || body.confirmed !== true) throw setupError('Confirm the effective date and document how the supplied agreement and current clauses were reconciled (at least 30 characters).');
  const current = (await base44.asServiceRole.entities.RetailerContractConfiguration.filter({ store_id:store.id },'-created_date',1))[0];
  if (current && Object.keys(fields).every(k => current[k] === fields[k]) && current.template_version === agreementVersion) return current;
  return await base44.asServiceRole.entities.RetailerContractConfiguration.create({ store_id:store.id,...fields,template_version:agreementVersion,version:crypto.randomUUID(),approved_by:user.email,approved_at:new Date().toISOString() });
}
export async function reviewRetailerAgreement(base44,user,store,record,body) {
  if (user.role !== 'admin') throw setupError('Administrator contract review required.',403);
  if (!record || record.store_id !== store.id || record.status !== 'submitted') throw setupError('Submit a signed agreement before review.');
  if (!['approved','needs_correction'].includes(body.decision) || typeof body.note !== 'string' || body.note.trim().length < 10 || body.note.length > 1500) throw setupError('Provide a contract review decision and meaningful reason.');
  if (record.review_status === body.decision) return record;
  if (['approved','needs_correction'].includes(record.review_status)) throw setupError('Preserve this reviewed version. Create a new version and obtain new signatures for corrections.',409);
  const review = { review_status:body.decision,review_note:body.note.trim(),reviewed_at:new Date().toISOString(),reviewed_by:user.email };
  if (body.decision === 'approved') {
    if (!record.terms_snapshot?.length) throw setupError('Legacy signed copies cannot be reconstructed. Review the original as an uploaded signed agreement or create a new version for both parties to sign.',409);
    if (body.accepted !== true) throw setupError('Consent to countersign on behalf of Alcohol Delivered is required.');
    for (const key of ['platform_signature','platform_name','platform_title','platform_date']) {
      if (typeof body[key] !== 'string' || !body[key].trim() || body[key].length > 250) throw setupError(`Enter ${key.replaceAll('_',' ')}.`);
      review[key] = body[key].trim();
    }
    if (review.platform_signature.toLowerCase() !== review.platform_name.toLowerCase() || !/^\d{4}-\d{2}-\d{2}$/.test(review.platform_date) || !Number.isFinite(Date.parse(review.platform_date))) throw setupError('The platform signature must match its printed name and include a valid date.');
    const bytes = retailerAgreementPdf({ ...record,...review });
    const upload = await base44.asServiceRole.integrations.Core.UploadPrivateFile({ file:new File([bytes],'RetailerPartnerAgreement-Countersigned.pdf',{ type:'application/pdf' }) });
    review.countersigned_file_uri = upload.file_uri;
  }
  return await base44.asServiceRole.entities.RetailerAgreement.update(record.id,review);
}