/**
 * watchBeverageKingStripeStatus
 * Scheduled every 30 minutes (see the matching workflow). Checks Beverage
 * King's live Stripe account status and, the moment charges_enabled and
 * payouts_enabled both turn true, emails an alert and marks the store's
 * stripe_connection_status as "connected" so this stops re-alerting once
 * it's done. No manual trigger needed — this is a pure background watcher.
 *
 * Does nothing (and sends nothing) while the account is still restricted —
 * it only fires once, on the transition to ready.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { secrets } from 'base44:runtime';

const BEVERAGE_KING_STORE_ID = '6a32d14d09b760f592dbf19e';

function buildRawEmail(to, subject, body, fromName) {
  const message = [
    `From: ${fromName} <alcohol.delivered1@gmail.com>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=UTF-8`,
    ``,
    body,
  ].join('\r\n');
  return btoa(unescape(encodeURIComponent(message)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    // Allow both manual admin invocation (for testing) and scheduled (no-user) execution.
    let user = null;
    try { user = await base44.auth.me(); } catch (_) { /* scheduled run — no user */ }
    if (user && user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const store = await base44.asServiceRole.entities.Store.get(BEVERAGE_KING_STORE_ID);
    if (!store?.stripe_connect_account_id) {
      return Response.json({ checked: false, reason: 'No Stripe account mapped to Beverage King' });
    }

    // Already confirmed connected on a prior run — nothing to do.
    if (store.stripe_connection_status === 'connected') {
      return Response.json({ checked: true, already_connected: true, alert_sent: false });
    }

    const headers = { Authorization: `Bearer ${secrets.get('STRIPE_SECRET_KEY')}`, 'Stripe-Version': '2025-10-29.clover' };
    const resp = await fetch(`https://api.stripe.com/v1/accounts/${store.stripe_connect_account_id}`, { headers });
    const account = await resp.json();

    if (!resp.ok) {
      return Response.json({ checked: true, accessible: false, error: account?.error?.message || 'Stripe request failed' });
    }

    const ready = account.charges_enabled === true && account.payouts_enabled === true && account.details_submitted === true;

    if (!ready) {
      return Response.json({
        checked: true,
        ready: false,
        disabled_reason: account.requirements?.disabled_reason || null,
        charges_enabled: account.charges_enabled === true,
        payouts_enabled: account.payouts_enabled === true,
        alert_sent: false,
      });
    }

    // Transitioned to ready — send a one-time alert and mark it so we never alert twice.
    const alertTo = (secrets.get('MANAGER_EMAIL') || secrets.get('STORE_MANAGER_EMAIL') || 'alcohol.delivered1@gmail.com').trim();
    const subject = 'Beverage King Stripe account is now cleared — ready for final go-live check';
    const body = `Beverage King's Stripe account (${store.stripe_connect_account_id}) now shows:

  charges_enabled: true
  payouts_enabled: true
  details_submitted: true

Bobby Singh appears to have completed Stripe's verification/appeal. Run beverageKingGoLive (action: check) to confirm every other go-live gate also passes before flipping the store fully live.

This is an automated alert from watchBeverageKingStripeStatus — it will not send again.`;

    let alertSent = false;
    try {
      const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
      const raw = buildRawEmail(alertTo, subject, body, 'Alcohol Delivered Ops Alert');
      const gmailRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw }),
      });
      alertSent = gmailRes.ok;
    } catch (e) {
      console.error('watchBeverageKingStripeStatus: failed to send alert email:', e.message);
    }

    await base44.asServiceRole.entities.Store.update(store.id, {
      stripe_connection_status: 'connected',
      stripe_connected_at: new Date().toISOString(),
    });

    return Response.json({ checked: true, ready: true, alert_sent: alertSent, alert_to: alertTo });
  } catch (error) {
    console.error('watchBeverageKingStripeStatus error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
