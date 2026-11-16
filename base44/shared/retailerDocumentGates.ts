import { allSetupRecords, retailerAmbiguity, setupError } from './retailerSetupAccess.ts';
import { setupSteps } from './retailerSetupFields.ts';
export async function retailerDocumentState(base44, store) {
  const submissions = await allSetupRecords(base44.asServiceRole.entities.RetailerSetupSubmission, { store_id: store.id });
  const documents = await allSetupRecords(base44.asServiceRole.entities.StoreSetupDocument, { store_id: store.id });
  const agreements = await allSetupRecords(base44.asServiceRole.entities.RetailerAgreement, { store_id: store.id });
  return { submissions, documents, agreements };
}
export async function retailerDocumentGates(base44, store, state) {
  const { submissions, documents, agreements } = state || await retailerDocumentState(base44, store);
  const blockers = await retailerAmbiguity(base44, store);
  for (const step of setupSteps) {
    const latest = submissions.find(s => s.step === step.key);
    if (latest?.status !== 'approved' || !latest.mapped_at) blockers.push(`${step.title}: ${latest?.status === 'needs_correction' ? latest.review_note : latest?.status === 'submitted' ? 'awaiting administrator review' : 'submit and obtain administrator approval'}.`);
    if (step.evidence) {
      const evidence = documents.find(d => d.kind === step.evidence);
      if (evidence?.status !== 'approved' || !latest?.document_ids?.includes(evidence.id)) blockers.push(`${step.title}: an administrator must approve the current uploaded evidence linked to the submitted version.`);
    }
  }
  const agreement = agreements[0];
  const uploaded = documents.find(d => d.kind === 'signed_agreement');
  if (agreement ? agreement.status !== 'submitted' || agreement.review_status !== 'approved' || !agreement.file_uri || !agreement.countersigned_file_uri : uploaded?.status !== 'approved') blockers.push('Agreement: both parties’ signed copy and administrator contract review are required; an upload or retailer signature alone is not approval.');
  const tokens = await base44.asServiceRole.entities.FCMToken.filter({ store_id: store.id }, '-created_date', 1);
  if (!tokens.length) blockers.push('Register notifications on the retailer device and have the sandbox notification test reviewed.');
  return blockers;
}
export async function retailerReviewFingerprint(base44, store) {
  const state = await retailerDocumentState(base44, store);
  const value = JSON.stringify({ store: [store.id,store.name,store.email,store.license_number,store.license_expiration_date,store.address,store.county,store.latitude,store.longitude,store.stripe_connect_account_id], submissions: setupSteps.map(step => { const s = state.submissions.find(s => s.step === step.key); return s && [s.id,s.revision,s.status,s.reviewed_at,s.mapped_at]; }), documents: state.documents.map(d => [d.id,d.status,d.reviewed_at]), agreement: state.agreements[0] && [state.agreements[0].id,state.agreements[0].terms_hash,state.agreements[0].review_status,state.agreements[0].reviewed_at] });
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))).map(b => b.toString(16).padStart(2,'0')).join('');
}
export async function requireFinalRetailerApproval(base44, store) {
  const approvals = await base44.asServiceRole.entities.RetailerSetupSubmission.filter({ store_id: store.id, step: 'launch' }, '-created_date', 1);
  const latest = approvals[0];
  if (latest?.status !== 'approved' || !latest.reviewed_by || latest.fields?.fingerprint !== await retailerReviewFingerprint(base44, store)) throw setupError('Submit for launch review and obtain final administrator approval for the current document versions. Changed evidence requires a new review.', 409);
}