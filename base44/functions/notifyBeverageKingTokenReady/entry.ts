/**
 * Watches Beverage King's Clover credential for a live, merchant-scoped API token.
 *
 * Triggered automatically by the "Beverage King Clover Token Watcher" workflow
 * whenever Beverage King's StorePosCredential is updated with a non-empty api_token.
 *
 * Validates the new token against Clover (merchant-scoped), then emails + pushes
 * all admins with a clear go / no-go result so the team knows the instant the
 * store is ready to accept live orders.
 *
 * Payload: { store_id, api_token, merchant_id }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertMerchantScopedToken, BEVERAGE_KING_STORE_ID } from '../../shared/cloverCredentials.ts';
import { sendFCMToTokens } from '../../shared/fcmUtils.ts';

export default async function(req) {
  const base44 = createClientFromRequest(req);
  try {
    const body = await req.json();
    const storeId = body.store_id || BEVERAGE_KING_STORE_ID;

    // Always read the latest credential from the DB (source of truth) — the
    // workflow payload is a snapshot and may already be stale.
    const cred = (await base44.asServiceRole.entities.StorePosCredential.filter({ store_id: storeId }))[0];
    if (!cred) {
      return Response.json({ skipped: true, reason: 'No StorePosCredential found for store' });
    }

    const apiToken = (cred.api_token || '').trim();
    const merchantId = (cred.merchant_id || '').trim();

    if (!apiToken) {
      return Response.json({ skipped: true, reason: 'api_token still empty — nothing to validate' });
    }
    if (!merchantId) {
      return Response.json({ skipped: true, reason: 'merchant_id missing — cannot validate token scope' });
    }

    // Validate the token is truly merchant-scoped for Beverage King's merchant.
    const validation = await assertMerchantScopedToken(apiToken, merchantId);
    const live = validation.ok === true;

    // Fetch admin users for notification.
    const users = await base44.asServiceRole.entities.User.list('-created_date', 500);
    const adminEmails = users.filter(u => u.role === 'admin' && u.email).map(u => u.email);

    const subject = live
      ? '✅ Beverage King Clover token is LIVE — ready for go-live'
      : '⚠️ Beverage King token saved but FAILED validation';
    const merchantLine = validation.merchantName ? `Merchant: ${validation.merchantName} (${merchantId})` : `Merchant ID: ${merchantId}`;
    const emailBody = live
      ? `Beverage King's Clover API token was just saved and validated successfully.\n\n${merchantLine}\nEnvironment: ${validation.environment}\n\nOrders can now be pushed to Clover POS. You are clear for go-live.`
      : `Beverage King's Clover credential was updated, but the token did NOT validate against the store's configured merchant.\n\n${merchantLine}\nHTTP status: ${validation.httpStatus}\nReason: ${validation.reason}\nClover response: ${validation.clover_response_body || 'n/a'}\n\nAction: the store owner must re-complete Clover OAuth (https://www.clover.com/oauth/v2/authorize) before live orders will push to the POS.`;

    let emailResults = [];
    if (adminEmails.length > 0) {
      for (const email of adminEmails) {
        try {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: email,
            subject,
            body: emailBody,
          });
          emailResults.push({ email, sent: true });
        } catch (e) {
          emailResults.push({ email, sent: false, error: e.message });
        }
      }
    }

    // Push notification to all admin devices.
    let pushResult = { skipped: true };
    if (adminEmails.length > 0) {
      let fcmTokens = [];
      for (const email of adminEmails) {
        const records = await base44.asServiceRole.entities.FCMToken.filter({ user_email: email });
        fcmTokens.push(...records.map(r => r.token));
      }
      if (fcmTokens.length > 0) {
        const title = live ? '✅ BevKing Clover LIVE' : '⚠️ BevKing token invalid';
        const msg = live
          ? `Token validated for merchant ${merchantId}. Clear for go-live.`
          : `Token saved but failed Clover validation. Re-auth needed.`;
        pushResult = await sendFCMToTokens(fcmTokens, title, msg, {
          type: 'bevking_token_watch',
          store_id: storeId,
          live: String(live),
          merchant_id: merchantId,
        });
      }
    }

    console.log(`Beverage King token watch fired — live=${live}, admins emailed=${emailResults.length}, push=${JSON.stringify(pushResult).slice(0, 200)}`);

    return Response.json({
      success: true,
      live,
      validation,
      admin_emails: adminEmails,
      email_results: emailResults,
      push_result: pushResult,
    });
  } catch (error) {
    console.error('notifyBeverageKingTokenReady error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}