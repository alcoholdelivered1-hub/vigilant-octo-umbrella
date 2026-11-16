import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { allSetupRecords, ownsRetailer, setupStore, setupError, requireUnambiguousRetailer, retailerAmbiguity } from '../../shared/retailerSetupAccess.ts';
import { setupSteps, validateSetupFields } from '../../shared/retailerSetupFields.ts';
import { retailerDocumentState, retailerReviewFingerprint } from '../../shared/retailerDocumentGates.ts';
import { readRetailerLaunchEvidence } from '../../shared/readRetailerLaunchEvidence.ts';
import { reviewSetupSubmission } from '../../shared/retailerSetupReview.ts';
import { retailerProviderChecks } from '../../shared/retailerProviderChecks.ts';
import { waitUntil } from 'base44:runtime';
import { retailerApprovalAlert } from '../../shared/retailerApprovalAlerts.ts';
import { queueRetailerLaunchReview } from '../../shared/queueRetailerLaunchReview.ts';

export default async function(req) {
  try {
    if (req.method !== 'POST') throw setupError('Method not allowed.',405);
    const base44 = createClientFromRequest(req), user = await base44.auth.me();
    if (!user || !(await base44.auth.isAuthenticated())) throw setupError('Sign in to complete retailer setup.',401);
    const body = await req.json();
    const allowed = ['list','get','save','submit','revise','review','document','review_document','verify','request_review','approve_launch','reject_launch'];
    if (!allowed.includes(body.action)) throw setupError('Invalid onboarding action.');
    if (body.action === 'list') return Response.json({ stores: (await allSetupRecords(base44.asServiceRole.entities.Store,{},'name')).filter(s => ownsRetailer(user,s)).map(s => ({ id:s.id, name:s.name, city:s.city })), is_admin:user.role === 'admin' });
    const store = await setupStore(base44,user,body.store_id);
    if (body.action === 'document') {
      if (!['StoreSetupDocument','RetailerAgreement'].includes(body.entity)) throw setupError('Choose an onboarding document.');
      const doc = await base44.asServiceRole.entities[body.entity].get(body.id);
      if (!doc || doc.store_id !== store.id) throw setupError('Document access denied.',403);
      return Response.json({ file_uri: body.copy === 'countersigned' ? doc.countersigned_file_uri : doc.file_uri });
    }
    const state = await retailerDocumentState(base44,store);
    if (body.action === 'get') return Response.json({ store, is_admin:user.role === 'admin', steps:setupSteps, submissions:state.submissions, documents:state.documents.map(({ file_uri,...doc }) => doc), agreements:state.agreements.map(a => ({ id:a.id,status:a.status,terms_version:a.terms_version,review_status:a.review_status,review_note:a.review_note,submitted_at:a.submitted_at,has_copy:!!a.file_uri })), blockers:await readRetailerLaunchEvidence(base44,store,{ setupState:state }), ambiguity:await retailerAmbiguity(base44,store), provider_note:'Saved connection flags are not verification. Use Verify connections; final activation rechecks providers.' });
    await requireUnambiguousRetailer(base44,store);
    if (body.action === 'verify') return Response.json(await retailerProviderChecks(base44,store));
    if (body.action === 'review') return Response.json({ record:await reviewSetupSubmission(base44,user,store,body) });
    const now = new Date().toISOString();
    if (body.action === 'review_document') {
      if (user.role !== 'admin') throw setupError('Administrator review required.',403);
      const doc = state.documents.find(d => d.id === body.id);
      if (!doc || !['approved','needs_correction'].includes(body.decision) || typeof body.note !== 'string' || body.note.trim().length < 10 || body.note.length > 1500) throw setupError('Select a document, decision and meaningful review reason.');
      if (doc.status === body.decision) return Response.json({ record:doc });
      if (doc.status !== 'pending_review') throw setupError('Reviewed documents are preserved. Upload a corrected version instead.',409);
      if (doc.kind === 'signed_agreement' && body.decision === 'approved') {
        const config = await base44.asServiceRole.entities.RetailerContractConfiguration.filter({ store_id:store.id },'-created_date',1);
        if (!config.length || body.both_parties_signed !== true) throw setupError('Resolve the contract version and verify both parties’ signatures before approval.',409);
      }
      return Response.json({ record:await base44.asServiceRole.entities.StoreSetupDocument.update(doc.id,{ status:body.decision,review_note:body.note.trim(),reviewed_at:now,reviewed_by:user.email }) });
    }
    if (['request_review','approve_launch','reject_launch'].includes(body.action)) {
      const latest = state.submissions.find(s => s.step === 'launch');
      if (body.action !== 'request_review' && user.role !== 'admin') throw setupError('Only an administrator can decide launch review.',403);
      if (body.action !== 'reject_launch' && body.consent !== true) throw setupError('Explicit launch-review consent is required.');
      const blockers = await readRetailerLaunchEvidence(base44,store);
      if (body.action === 'approve_launch') {
        if (!latest || latest.status !== 'submitted') throw setupError('The retailer must submit a current launch review request.',409);
        const providers = await retailerProviderChecks(base44,store); blockers.push(...providers.blockers);
        if (blockers.length) return Response.json({ activated:false,ready:false,blockers });
        await base44.asServiceRole.entities.RetailerSetupSubmission.update(latest.id,{ status:'approved',reviewed_by:user.email,reviewed_at:now,review_note:'Approved for final live verification; not activated.',fields:{ fingerprint:await retailerReviewFingerprint(base44,store) } });
      } else if (body.action === 'reject_launch') {
        if (!latest || latest.status !== 'submitted' || typeof body.note !== 'string' || body.note.trim().length < 10 || body.note.length > 1500) throw setupError('A submitted review and correction reason are required.');
        await base44.asServiceRole.entities.RetailerSetupSubmission.update(latest.id,{ status:'needs_correction',review_note:body.note.trim(),reviewed_by:user.email,reviewed_at:now });
      } else if (!latest || latest.status !== 'submitted') {
        await base44.asServiceRole.entities.RetailerSetupSubmission.create({ store_id:store.id,step:'launch',version:(latest?.version || 0)+1,revision:0,fields:{ blockers },status:'submitted',submitted_by:user.email,submitted_at:now,supersedes_id:latest?.id || '' });
      }
      if (body.action === 'approve_launch') {
        // The review is saved first. Activation failures must never undo a saved decision.
        try {
          const response = await base44.functions.invoke('retailerGoLive', { store_id:store.id,activate:true,automatic:true });
          const activation = response.data || {};
          return Response.json({ status:'approved', activated:activation.activated === true, blockers:activation.blockers || [], activation_error:activation.error || '', activation_skipped:activation.skipped === true });
        } catch (error) {
          return Response.json({ status:'approved',activated:false,activation_error:error.message,blockers:['Final activation check failed. Approval is saved; retry the activation check.'] });
        }
      }
      return Response.json({ activated:false,ready_for_review:blockers.length === 0,blockers,status:body.action === 'approve_launch' ? 'approved' : body.action === 'reject_launch' ? 'needs_correction' : 'submitted' });
    }
    const step = setupSteps.find(s => s.key === body.step);
    if (!step) throw setupError('Choose an editable onboarding step.');
    let record = state.submissions.find(s => s.step === body.step);
    if (body.action === 'revise') {
      if (record?.status === 'draft') return Response.json({ record });
      if (record?.status === 'submitted') throw setupError('Wait for review before creating a correction.',409);
      record = await base44.asServiceRole.entities.RetailerSetupSubmission.create({ store_id:store.id,step:step.key,version:(record?.version || 0)+1,revision:0,fields:record?.fields || {},status:'draft',edited_by:user.email,supersedes_id:record?.id || '' });
      return Response.json({ record });
    }
    const fields = validateSetupFields(step.key,body.fields,body.action === 'submit');
    const hash = JSON.stringify(fields);
    if (body.action === 'submit' && ['submitted','approved','needs_correction'].includes(record?.status) && record.submission_hash === hash) return Response.json({ record,duplicate:true });
    if (record && record.status !== 'draft') throw setupError('Create a new correction version before editing this reviewed submission.',409);
    if (body.action === 'submit' && step.evidence && !state.documents.some(d => d.kind === step.evidence && d.status !== 'needs_correction')) throw setupError('Upload the required evidence under Setup documents before submitting this step.');
    const update = { fields,edited_by:user.email,...(body.action === 'submit' ? { status:'submitted',submitted_by:user.email,submitted_at:now,submission_hash:hash,document_ids:state.documents.filter(d => d.kind === step.evidence && d.status !== 'needs_correction').map(d => d.id) } : {}) };
    if (record) {
      if (body.id !== record.id || body.revision !== record.revision) throw setupError('This draft changed on another device. Reload before saving.',409);
      const result = await base44.asServiceRole.entities.RetailerSetupSubmission.updateMany({ id:record.id,status:'draft',revision:body.revision },{ $set:{ ...update,revision:record.revision+1 } });
      if (result.updated !== 1) throw setupError('Another submission changed this draft. Reload to see the saved version.',409);
      record = await base44.asServiceRole.entities.RetailerSetupSubmission.get(record.id);
    } else record = await base44.asServiceRole.entities.RetailerSetupSubmission.create({ store_id:store.id,step:step.key,version:1,revision:0,status:'draft',...update });
    let launch_review = null;
    if (body.action === 'submit') {
      waitUntil(retailerApprovalAlert(base44,'RetailerSetupSubmission',record.id).catch(error => console.error('Submission alert:',error.message)));
      try {
        launch_review = await queueRetailerLaunchReview(base44,user,store);
        if (launch_review.queued && !launch_review.duplicate) waitUntil(retailerApprovalAlert(base44,'RetailerSetupSubmission',launch_review.id).catch(error => console.error('Launch review alert:',error.message)));
      } catch (error) {
        // Information remains saved even if review queueing needs a retry.
        launch_review = { queued:false,error:error.message };
      }
    }
    return Response.json({ record,launch_review });
  } catch (error) { console.error('Retailer setup:',error.message); return Response.json({ error:error.message },{ status:error.status || 400 }); }
}