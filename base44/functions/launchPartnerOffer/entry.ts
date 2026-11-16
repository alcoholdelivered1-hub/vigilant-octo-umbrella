import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { applyLaunchPartnerReward } from '../../shared/launchPartnerReward.ts';

export default async function(req) {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Sign in required' }, { status: 401 });
    const { store_id, action = 'status', confirmed, note = '' } = await req.json();
    if (typeof store_id !== 'string' || !store_id || store_id.length > 100 || !['status', 'start', 'submit', 'approve', 'request_changes', 'apply_reward'].includes(action)) return Response.json({ error: 'Invalid request' }, { status: 400 });
    const admin = user.role === 'admin';
    if (['approve', 'request_changes', 'apply_reward'].includes(action) && !admin) return Response.json({ error: 'Admin review required' }, { status: 403 });
    const store = await base44.entities.Store.get(store_id);
    if (!store) return Response.json({ error: 'Store not found' }, { status: 404 });
    const email = user.email?.trim().toLowerCase();
    if (!admin && !(email && [store.email, ...(store.contact_emails || [])].some(e => e?.trim().toLowerCase() === email))) return Response.json({ error: 'This store is not linked to your account' }, { status: 403 });
    const records = base44.asServiceRole.entities.LaunchPartnerEnrollment;
    let enrollment = (await records.filter({ store_id }, 'created_date', 1))[0] || null;
    const now = new Date();
    if (action === 'start' && !enrollment) {
      if (store.onboarding_status === 'live') return Response.json({ error: 'This offer is for stores still onboarding' }, { status: 409 });
      enrollment = await records.create({ store_id, started_at: now.toISOString(), deadline_at: new Date(now.getTime() + 7 * 86400000).toISOString(), status: 'enrolled' });
    }
    if (action === 'submit') {
      if (!enrollment) return Response.json({ error: 'Start your seven-day offer first' }, { status: 409 });
      if (['enrolled', 'needs_changes'].includes(enrollment.status)) {
        if (now.getTime() > Date.parse(enrollment.deadline_at)) return Response.json({ error: 'The seven-day submission deadline has passed; onboarding can still continue' }, { status: 409 });
        if (confirmed !== true) return Response.json({ error: 'Confirm that all required setup information has been submitted' }, { status: 400 });
        enrollment = await records.update(enrollment.id, { status: 'pending_review', submitted_at: now.toISOString(), submitted_by: user.id });
      }
    }
    if (['approve', 'request_changes'].includes(action)) {
      if (!enrollment || enrollment.status !== 'pending_review') return Response.json({ error: 'No submission is awaiting review' }, { status: 409 });
      if (typeof note !== 'string' || note.length > 500) return Response.json({ error: 'Review notes must be 500 characters or fewer' }, { status: 400 });
      if (action === 'approve' && (confirmed !== true || !enrollment.submitted_at || Date.parse(enrollment.submitted_at) > Date.parse(enrollment.deadline_at))) return Response.json({ error: 'Confirm complete submission before the deadline' }, { status: 400 });
      if (action === 'request_changes' && !note.trim()) return Response.json({ error: 'Explain which information needs to be completed' }, { status: 400 });
      enrollment = await records.update(enrollment.id, { status: action === 'approve' ? 'approved' : 'needs_changes', review_note: note.trim(), reviewed_by: user.id, ...(action === 'approve' ? { approved_at: now.toISOString() } : {}) });
    }
    const placement = ['approve', 'apply_reward'].includes(action)
      ? await applyLaunchPartnerReward(base44, store, enrollment)
      : (await base44.asServiceRole.entities.LaunchPartnerPlacement.filter({ store_id }, 'created_date', 1))[0] || null;
    return Response.json({ enrollment, placement, can_enroll: !enrollment && store.onboarding_status !== 'live', server_time: now.toISOString() });
  } catch (error) {
    console.error('Launch Partner offer:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}