import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { sendFCMToTokens, getFCMServiceAccount } from '../../shared/fcmUtils.ts';

/**
 * FCM HTTP v1 push sender.
 *
 * Payload: { tokens: string[], title, body, data? }
 * OR:      { user_emails: string[], title, body, data? }
 * OR:      { store_id: string, title, body, data? }
 * OR:      { driver_id: string, title, body, data? }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const authenticated = await base44.auth.isAuthenticated().catch(() => false);
    if (!authenticated) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const user = await base44.auth.me().catch(() => null);
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { tokens: directTokens, user_emails, store_id, driver_id, title, body: msgBody, data } = body;

    if (!title || !msgBody) {
      return Response.json({ error: 'title and body are required' }, { status: 400 });
    }

    // Validate FCM credentials early for a clear error
    try {
      getFCMServiceAccount();
    } catch (e) {
      return Response.json({ error: e.message }, { status: 500 });
    }

    let fcmTokens: string[] = [];

    if (directTokens?.length) {
      fcmTokens = directTokens;
    } else if (user_emails?.length) {
      for (const email of user_emails) {
        const r = await base44.asServiceRole.entities.FCMToken.filter({ user_email: email });
        fcmTokens.push(...r.map((rec) => rec.token));
      }
    } else if (store_id) {
      const records = await base44.asServiceRole.entities.FCMToken.filter({ store_id });
      fcmTokens = records.map((r) => r.token);
    } else if (driver_id) {
      const records = await base44.asServiceRole.entities.FCMToken.filter({ driver_id });
      fcmTokens = records.map((r) => r.token);
    }

    if (fcmTokens.length === 0) {
      console.log('No FCM tokens found for target — skipping push');
      return Response.json({ skipped: true, reason: 'No FCM tokens registered for target' });
    }

    const results = await sendFCMToTokens(fcmTokens, title, msgBody, data || {});
    const successCount = results.filter((r) => r.success).length;
    console.log(`FCM push sent to ${successCount}/${fcmTokens.length} tokens`);

    return Response.json({
      success: true,
      tokens_targeted: fcmTokens.length,
      tokens_delivered: successCount,
      results,
    });
  } catch (error) {
    console.error('sendFCMPush error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});