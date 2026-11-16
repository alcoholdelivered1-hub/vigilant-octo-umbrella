import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import {
  validateApplication,
  findExistingApplication,
  ensureOnboardingCandidate,
  deliverSignupNotifications,
  applicationSummary,
  findOwnApplication,
  reconcileConcurrentDuplicate,
} from '../../shared/retailerSignupApplication.ts';

// Public intake for retailer applications. Deliberately callable by an anonymous
// visitor: the RetailerSignup entity only accepts admin writes, so this validated
// server path is the single way an application can be created. No administrator
// capability is exposed here: applications are saved as 'pending' candidates and
// only an administrator can approve, review or activate anything.
export default async function(req) {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed.' }, { status: 405 });
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return Response.json({ error: 'Submit a valid application.' }, { status: 400 });

    // A returning applicant may look up their OWN application only. The identity
    // comes from the authenticated session, never from the request body.
    if (body.action === 'myApplication') {
      const user = await base44.auth.me().catch(() => null);
      if (!user?.email) return Response.json({ error: 'Sign in to view your application.' }, { status: 401 });
      const own = await findOwnApplication(base44, user.email);
      return Response.json({ ok: true, application: applicationSummary(own) });
    }

    const fields = validateApplication(body);

    const existing = await findExistingApplication(base44, fields);
    if (existing) return Response.json({ ok: true, duplicate: true, application: applicationSummary(existing) });

    const signup = await base44.asServiceRole.entities.RetailerSignup.create(fields);

    // Concurrent duplicates: keep the earlier application, discard only our own row.
    const twin = await reconcileConcurrentDuplicate(base44, fields, signup.id);
    if (twin) return Response.json({ ok: true, duplicate: true, application: applicationSummary(twin) });

    let onboardingId = null;
    try {
      const candidate = await ensureOnboardingCandidate(base44, fields, signup.id);
      onboardingId = candidate?.id || null;
    } catch (error) {
      // The application is the record of truth and stays saved for administrators.
      console.error('[retailer signup] candidate creation failed:', error.message);
    }

    const notifications = await deliverSignupNotifications(base44, fields);

    return Response.json({
      ok: true,
      duplicate: false,
      application_id: signup.id,
      application: applicationSummary(signup),
      onboarding_linked: Boolean(onboardingId),
      notifications: notifications.delivery,
    });
  } catch (error) {
    console.error('[retailer signup] submission failed:', error.message);
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}