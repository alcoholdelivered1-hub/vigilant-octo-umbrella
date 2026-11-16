import { retailerDocumentState, retailerReviewFingerprint } from './retailerDocumentGates.ts';
import { setupSteps } from './retailerSetupFields.ts';

// Called only after an authorized retailer step submission. Never approves evidence.
export async function queueRetailerLaunchReview(base44, user, store) {
  if (store.is_active || store.onboarding_status === 'live') return { queued: false, reason: 'Store already active.' };
  const state = await retailerDocumentState(base44, store);
  const complete = setupSteps.every(step => {
    const latest = state.submissions.find(item => item.step === step.key);
    return latest && ['submitted', 'approved'].includes(latest.status);
  });
  if (!complete) return { queued: false, reason: 'Submit the remaining information steps.' };
  const latest = state.submissions.find(item => item.step === 'launch');
  if (latest?.status === 'submitted') return { queued: true, duplicate: true, id: latest.id };
  const fingerprint = await retailerReviewFingerprint(base44, store);
  if (latest?.status === 'approved' && latest.fields?.fingerprint === fingerprint)
    return { queued: false, reason: 'Current launch review already approved.' };
  const record = await base44.asServiceRole.entities.RetailerSetupSubmission.create({
    store_id: store.id, step: 'launch', version: (latest?.version || 0) + 1, revision: 0,
    fields: { fingerprint, automatic_request: true, source: 'all_information_steps_submitted' },
    status: 'submitted', submitted_by: user.email, submitted_at: new Date().toISOString(),
    supersedes_id: latest?.id || '',
  });
  return { queued: true, id: record.id };
}
