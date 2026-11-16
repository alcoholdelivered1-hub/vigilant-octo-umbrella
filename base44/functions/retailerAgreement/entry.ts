import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { agreementFields, agreementTerms, agreementVersion } from '../../shared/retailerAgreementTerms.ts';
import { retailerAgreementPdf } from '../../shared/retailerAgreementPdf.ts';
import { allSetupRecords, ownsRetailer, setupStore, setupError, requireUnambiguousRetailer, retailerAmbiguity } from '../../shared/retailerSetupAccess.ts';
import { configureRetailerAgreement, reviewRetailerAgreement } from '../../shared/retailerAgreementAdmin.ts';
import { freshAgreementFields, freshAgreementValues, checkAgreementIdentity, prepareFreshRetailerAgreements } from '../../shared/freshRetailerAgreements.ts';

export default async function(req) {
  try {
    if (req.method !== 'POST') throw setupError('Method not allowed',405);
    const base44 = createClientFromRequest(req), user = await base44.auth.me();
    if (!user || !(await base44.auth.isAuthenticated())) throw setupError('Sign in to complete your retailer agreement.',401);
    const payload = await req.json(), { action = 'get',store_id } = payload;
    if (!['list','get','save','submit','revise','fresh','prepare_all','configure','review'].includes(action)) throw setupError('Invalid action.');
    if (action === 'prepare_all') return Response.json(await prepareFreshRetailerAgreements(base44,user,payload));
    if (action === 'list') return Response.json({ stores:(await allSetupRecords(base44.asServiceRole.entities.Store,{},'name')).filter(s => ownsRetailer(user,s)).map(s => ({ id:s.id,name:s.name })) });
    const store = await setupStore(base44,user,store_id);
    const records = await allSetupRecords(base44.asServiceRole.entities.RetailerAgreement,{ store_id });
    let record = records[0];
    const documentVersion = record?.status === 'draft' && record.terms_version?.includes('/document-') ? record.terms_version : `${agreementVersion}/document-${records.length + 1}`;
    const configuration = (await base44.asServiceRole.entities.RetailerContractConfiguration.filter({ store_id },'-created_date',1))[0] || null;
    const controlled = ['payment_days','term_months','effective_date'];
    if (action === 'get') return Response.json({ record:record || null,store,configuration,is_admin:user.role === 'admin',history:records.map(r => ({ id:r.id,status:r.status,terms_version:r.terms_version,submitted_at:r.submitted_at,review_status:r.review_status,has_copy:!!r.file_uri,has_countersigned_copy:!!r.countersigned_file_uri })),terms:record?.status === 'submitted' ? (record.terms_snapshot || []) : agreementTerms({ ...record?.fields,...configuration }),fields:agreementFields,initial_fields:freshAgreementFields(store,configuration),identity_fields:['store_name','address','city_state_zip'],terms_version:agreementVersion,controlled_fields:controlled,ambiguity:await retailerAmbiguity(base44,store),legacy:record?.status === 'submitted' && !record.terms_snapshot?.length });
    await requireUnambiguousRetailer(base44,store);
    if (action === 'configure') return Response.json({ configuration:await configureRetailerAgreement(base44,user,store,payload) });
    if (action === 'review') return Response.json({ record:await reviewRetailerAgreement(base44,user,store,record,payload) });
    if (action === 'fresh') {
      if (payload.confirmed !== true || payload.expected_store_name !== store.name) throw setupError('Confirm the retailer name before creating a fresh agreement.');
      if (record && (payload.id !== record.id || payload.revision !== (record.revision || 0))) throw setupError('This agreement changed. Reload before starting a fresh version.',409);
      return Response.json({ record:await base44.asServiceRole.entities.RetailerAgreement.create(freshAgreementValues(store,configuration,record)) });
    }
    if (action === 'revise') {
      if (record?.status === 'draft' && record.configuration_id === configuration?.id) return Response.json({ record });
      record = await base44.asServiceRole.entities.RetailerAgreement.create({ store_id,store_name:store.name,contact_emails:[store.email,...(store.contact_emails || [])].filter(Boolean),fields:{ ...record?.fields,...Object.fromEntries(['store_name','address','city_state_zip'].map(key => [key,freshAgreementFields(store,configuration)[key]])),signature:'',signature_date:'',...Object.fromEntries(controlled.map(k => [k,configuration?.[k] || ''])) },status:'draft',terms_version:`${agreementVersion}/document-${records.length + 1}`,configuration_id:configuration?.id || '',supersedes_id:record?.id || '',revision:0 });
      return Response.json({ record });
    }
    if (record?.status === 'submitted' && action === 'save') throw setupError('Signed versions are read-only; start a new version and re-sign.',409);
    if (record?.status !== 'submitted') {
      if (!payload.fields || typeof payload.fields !== 'object' || Array.isArray(payload.fields) || Object.keys(payload.fields).some(k => !Object.hasOwn(agreementFields,k))) throw setupError('Submit only the agreement fields shown.');
      const fields = {};
      for (const key of Object.keys(agreementFields)) {
        const value = payload.fields[key] ?? '';
        if (typeof value !== 'string' || value.length > 250) throw setupError(`Invalid ${agreementFields[key]}.`);
        fields[key] = value.trim();
      }
      checkAgreementIdentity(store,fields);
      for (const key of controlled) {
        if (fields[key] && fields[key] !== configuration?.[key]) throw setupError('Commercial terms and the effective date require administrator configuration. Reload the approved terms.',409);
        fields[key] = configuration?.[key] || '';
      }
      if (record?.configuration_id && record.configuration_id !== configuration?.id) throw setupError('The administrator approved a new contract configuration. Start a new version and review it before signing.',409);
      if (action === 'submit') {
        if (!configuration || configuration.template_version !== agreementVersion) throw setupError('An administrator must resolve the supplied agreement version, effective date, remittance days and duration before signing.',409);
        for (const key of ['store_name','license_number','address','city_state_zip','owner_name','title','phone','email','effective_date','payment_days','term_months','signature','signature_date']) if (!fields[key]) throw setupError(`${agreementFields[key]} is required.`);
        if (payload.accepted !== true || fields.signature.toLowerCase() !== fields.owner_name.toLowerCase()) throw setupError('Consent to electronic signing and enter a signature matching your authorized representative name.');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) throw setupError('Enter a valid contact email.');
        for (const key of ['effective_date','signature_date']) if (!/^\d{4}-\d{2}-\d{2}$/.test(fields[key]) || !Number.isFinite(Date.parse(fields[key]))) throw setupError('Enter valid signature and agreement dates.');
        if (fields.store_name !== store.name || fields.license_number !== store.license_number || fields.address !== store.address) throw setupError('Submit corrections to the business or license step and obtain approval before signing with changed canonical details.',409);
      }
      const snapshot = agreementTerms(fields);
      const terms_hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({ version:documentVersion,configuration_id:configuration?.id,fields,terms:snapshot }))))).map(b => b.toString(16).padStart(2,'0')).join('');
      const values = { fields,configuration_id:configuration?.id || '',terms_version:documentVersion,...(action === 'submit' ? { status:'submitted',terms_snapshot:snapshot,terms_hash,submitted_at:new Date().toISOString(),submitted_by:user.email,review_status:'pending_review' } : {}) };
      if (record) {
        if (payload.id !== record.id || payload.revision !== (record.revision || 0)) throw setupError('This draft changed on another device. Reload before saving.',409);
        const result = await base44.asServiceRole.entities.RetailerAgreement.updateMany({ id:record.id,status:'draft',...(record.revision === undefined ? {} : { revision:record.revision }) },{ $set:{ ...values,revision:(record.revision || 0)+1 } });
        if (result.updated !== 1) throw setupError('This draft was already submitted or changed. Reload its saved version.',409);
        record = await base44.asServiceRole.entities.RetailerAgreement.get(record.id);
      } else record = await base44.asServiceRole.entities.RetailerAgreement.create({ store_id,store_name:store.name,contact_emails:[store.email,...(store.contact_emails || [])].filter(Boolean),status:'draft',revision:0,...values });
    }
    if (action === 'submit' && !record.file_uri) {
      const bytes = retailerAgreementPdf(record);
      const { file_uri } = await base44.asServiceRole.integrations.Core.UploadPrivateFile({ file:new File([bytes],'RetailerPartnerAgreement.pdf',{ type:'application/pdf' }) });
      record = await base44.asServiceRole.entities.RetailerAgreement.update(record.id,{ file_uri });
    }
    // No notifications or activation are sent by draft, signature or review submission.
    return Response.json({ record });
  } catch (error) { console.error('Retailer agreement:',error.message); return Response.json({ error:error.message },{ status:error.status || 400 }); }
}