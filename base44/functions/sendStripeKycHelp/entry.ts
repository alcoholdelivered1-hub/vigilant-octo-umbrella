/**
 * Sends a focused, KYC-only step-by-step help email to every store that has
 * NOT completed Stripe Connect onboarding. For each incomplete store:
 *   1. Retrieves the real Stripe account status (so we only email stores that
 *      genuinely need it).
 *   2. Generates a fresh account_onboarding link.
 *   3. Emails a plain, short, KYC guide with the exact documents/info to have
 *      ready and their personal link.
 *
 * Admin-only. Does NOT email stores that are already fully onboarded.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import Stripe from 'npm:stripe@17.4.0';

function buildRawEmail(to, subject, htmlBody, fromName) {
  const fromHeader = `${fromName} <alcohol.delivered1@gmail.com>`;
  const message = [
    `From: ${fromHeader}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=UTF-8`,
    ``,
    htmlBody,
  ].join('\r\n');
  return btoa(unescape(encodeURIComponent(message)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function buildHTML(store, onboardingUrl) {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'DM Sans',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

        <tr><td style="background:#1e3a5f;padding:28px 40px;text-align:center;">
          <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">Finish Your Payout Setup (5–10 min)</h1>
          <p style="margin:6px 0 0;color:#f59e0b;font-size:12px;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;">${store.name} · Stripe Bank Link</p>
        </td></tr>

        <tr><td style="padding:32px 40px;">
          <p style="margin:0 0 20px;color:#1e293b;font-size:15px;line-height:1.6;">
            Hi ${store.name}! To receive your weekly payouts for delivered orders, there's one quick step left: link your bank through our payment partner, Stripe. <strong>Nothing has been charged</strong> — this just lets us pay you.
          </p>

          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:18px 20px;margin:0 0 22px;">
            <tr><td style="color:#1e3a5f;font-size:14px;font-weight:700;padding-bottom:10px;">📋 Have these ready before you start:</td></tr>
            <tr><td style="color:#475569;font-size:13px;line-height:1.7;padding:2px 0;">☑ <strong>Business bank account</strong> &amp; routing number</td></tr>
            <tr><td style="color:#475569;font-size:13px;line-height:1.7;padding:2px 0;">☑ <strong>Business name</strong> &amp; <strong>EIN</strong> (tax ID)</td></tr>
            <tr><td style="color:#475569;font-size:13px;line-height:1.7;padding:2px 0;">☑ <strong>Business address</strong> &amp; phone</td></tr>
            <tr><td style="color:#475569;font-size:13px;line-height:1.7;padding:2px 0;">☑ An <strong>owner's</strong> full name, date of birth, email &amp; phone</td></tr>
            <tr><td style="color:#475569;font-size:13px;line-height:1.7;padding:2px 0;">☑ That owner's <strong>last 4 of SSN</strong> &amp; a valid government ID</td></tr>
          </table>

          <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;">
            <tr><td style="background:#1e3a5f;border-radius:10px;padding:20px;text-align:center;">
              <a href="${onboardingUrl}" style="display:inline-block;background:#f59e0b;color:#fff;padding:15px 40px;border-radius:8px;text-decoration:none;font-size:16px;font-weight:700;">Start Bank Setup →</a>
              <p style="margin:10px 0 0;color:#94a3b8;font-size:11px;">Your personal link — it may expire, so reply here for a fresh one anytime.</p>
            </td></tr>
          </table>

          <p style="margin:0 0 12px;color:#1e293b;font-size:14px;line-height:1.6;"><strong>What happens after:</strong></p>
          <ol style="margin:0 0 22px;padding-left:20px;color:#475569;font-size:13px;line-height:1.8;">
            <li>Stripe verifies your info (usually instant, up to 1–2 days).</li>
            <li>You're marked ready to receive payouts.</li>
            <li>We pay you every <strong>Monday</strong> for the prior week's delivered orders — you keep 100% of the product subtotal.</li>
          </ol>

          <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef3c7;border:1px solid #fbbf24;border-radius:10px;padding:14px 18px;margin:0 0 18px;">
            <tr><td style="color:#92400e;font-size:13px;line-height:1.6;">⚠️ <strong>This is required to get paid.</strong> Orders can still come in now, but payouts to your bank won't start until this is complete. It only takes a few minutes — please do it today.</td></tr>
          </table>

          <p style="margin:0;color:#64748b;font-size:12px;line-height:1.5;">
            Questions or stuck on a step? Just reply to this email and we'll walk you through it.<br>
            — Alcohol Delivered · alcohol.delivered1@gmail.com · Pine Bluff, AR
          </p>
        </td></tr>

        <tr><td style="background:#1e3a5f;padding:16px 40px;text-align:center;">
          <p style="margin:0;color:#94a3b8;font-size:11px;">Alcohol Delivered, LLC · Operating under Arkansas ACT 157</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    const origin = req.headers.get('origin') || 'https://alcohol-delivered.biz';
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');

    const stores = await base44.asServiceRole.entities.Store.list('name', 500);
    const results = [];

    for (const s of stores) {
      if (!s.stripe_connect_account_id) {
        results.push({ store: s.name, email: s.email, status: 'skipped', reason: 'no account' });
        continue;
      }
      if (!s.email) {
        results.push({ store: s.name, email: null, status: 'skipped', reason: 'no email' });
        continue;
      }
      let accountId = s.stripe_connect_account_id;
      // Only email stores that are NOT fully onboarded
      try {
        const acct = await stripe.accounts.retrieve(accountId);
        const pastDue = acct.requirements?.past_due || [];
        const isComplete = acct.details_submitted && acct.charges_enabled && acct.payouts_enabled && pastDue.length === 0;
        if (isComplete) {
          // Ensure local flag reflects reality
          if (!s.stripe_connect_onboarded) {
            await base44.asServiceRole.entities.Store.update(s.id, { stripe_connect_onboarded: true });
          }
          results.push({ store: s.name, email: s.email, status: 'already_complete' });
          continue;
        }
      } catch (e) {
        const revoked =
          e?.statusCode === 403 ||
          e?.code === 'account_invalid' ||
          /revoked/i.test(e?.message || '');
        if (!revoked) {
          results.push({ store: s.name, email: s.email, status: 'failed', error: `status check: ${e.message}`.substring(0, 150) });
          continue;
        }
        // Account revoked platform access — it can never take onboarding links
        // again, so spin up a fresh Express account and relink the store.
        try {
          const account = await stripe.accounts.create({
            type: 'express',
            email: s.email,
            business_type: 'company',
            business_profile: { name: s.name, mcc: '5921' },
            capabilities: { transfers: { requested: true }, card_payments: { requested: true } },
            metadata: {
              base44_store_id: s.id,
              store_name: s.name,
              base44_app_id: Deno.env.get('BASE44_APP_ID'),
              reconnected_from: s.stripe_connect_account_id,
            },
          });
          accountId = account.id;
          await base44.asServiceRole.entities.Store.update(s.id, {
            stripe_connect_account_id: accountId,
            stripe_connect_onboarded: false,
          });
        } catch (e2) {
          results.push({ store: s.name, email: s.email, status: 'failed', error: `recreate: ${e2.message}`.substring(0, 150) });
          continue;
        }
      }

      // Generate a fresh account_onboarding link
      let accountLink;
      try {
        accountLink = await stripe.accountLinks.create({
          account: accountId,
          refresh_url: `${origin}/store/dashboard?stripe_refresh=1&store=${s.id}`,
          return_url: `${origin}/store/dashboard?stripe_connected=1&store=${s.id}`,
          type: 'account_onboarding',
        });
      } catch (e) {
        results.push({ store: s.name, email: s.email, status: 'failed', error: `link: ${e.message}`.substring(0, 150) });
        continue;
      }

      const subject = `💳 ${s.name} — One Quick Step to Get Paid (Stripe Bank Setup)`;
      const raw = buildRawEmail(s.email, subject, buildHTML(s, accountLink.url), 'Alcohol Delivered');
      const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw }),
      });

      if (res.ok) {
        results.push({ store: s.name, email: s.email, status: 'sent' });
      } else {
        const errBody = await res.text();
        results.push({ store: s.name, email: s.email, status: 'failed', error: errBody.substring(0, 150) });
      }
    }

    const sent = results.filter(r => r.status === 'sent').length;
    const failed = results.filter(r => r.status === 'failed').length;
    const skipped = results.filter(r => r.status === 'already_complete' || r.status === 'skipped').length;

    return Response.json({ success: true, sent, failed, skipped, total: results.length, results });
  } catch (error) {
    console.error('sendStripeKycHelp error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});