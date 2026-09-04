/**
 * Bulk-creates Stripe Connect Express accounts for all stores that don't have one,
 * generates onboarding links, and emails each store owner.
 *
 * POST body: { skip_existing?: boolean }
 * Admin-only.
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

function buildOnboardingHTML(store, onboardingUrl) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'DM Sans',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#1e3a5f;padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">Alcohol Delivered</h1>
            <p style="margin:4px 0 0;color:#f59e0b;font-size:13px;text-transform:uppercase;letter-spacing:1.5px;">Action Needed: Link Your Bank Account</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px;">
            <h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;">Hello ${store.name}! 💳</h2>
            <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
              To receive your weekly payouts for orders placed through <strong>Alcohol Delivered</strong>, you need to complete a quick one-time setup with our payment partner, <strong>Stripe</strong>.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef3c7;border:1px solid #fcd34d;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
              <tr><td style="color:#92400e;font-size:14px;font-weight:600;line-height:1.5;">
                ⏳ Your payouts are on hold until this step is completed. Finish setup today to receive your first payout!
              </td></tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td style="background:#1e3a5f;border-radius:10px;padding:24px;text-align:center;">
                  <a href="${onboardingUrl}" style="display:inline-block;background:#f59e0b;color:#1e3a5f;padding:14px 36px;border-radius:8px;text-decoration:none;font-size:16px;font-weight:700;">Complete Stripe Setup →</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#1e3a5f;padding:20px 40px;text-align:center;">
            <p style="margin:0;color:#94a3b8;font-size:11px;">
              Alcohol Delivered, LLC · Pine Bluff, AR · alcohol-delivered.biz<br>
              This email was sent to ${store.email} regarding your payout setup.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const skipExisting = body.skip_existing !== false;

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
    const origin = req.headers.get('origin') || 'https://alcohol-delivered.biz';

    // Get Gmail connection for sending emails
    const { accessToken: gmailToken } = await base44.asServiceRole.connectors.getConnection('gmail');

    // Fetch ALL stores
    const allStores = await base44.asServiceRole.entities.Store.list('-created_date', 500);

    // Filter to stores that need Stripe accounts
    const storesNeedingOnboarding = skipExisting
      ? allStores.filter(s => !s.stripe_connect_account_id || !s.stripe_connect_onboarded)
      : allStores.filter(s => s.email && s.email.includes('@'));

    const results = [];
    let created = 0;
    let emailed = 0;
    let failed = 0;

    for (const store of storesNeedingOnboarding) {
      try {
        if (!store.email || !store.email.includes('@')) {
          results.push({ store: store.name, status: 'skipped', reason: 'no valid email' });
          continue;
        }

        // Create Express account if missing
        let accountId = store.stripe_connect_account_id;
        if (!accountId) {
          const account = await stripe.accounts.create({
            type: 'express',
            email: store.email,
            business_type: 'company',
            business_profile: {
              name: store.name,
              url: origin,
              mcc: '5921',
            },
            capabilities: {
              transfers: { requested: true },
              card_payments: { requested: true },
            },
            metadata: {
              base44_store_id: store.id,
              store_name: store.name,
              base44_app_id: Deno.env.get('BASE44_APP_ID'),
            },
          });
          accountId = account.id;
          await base44.asServiceRole.entities.Store.update(store.id, {
            stripe_connect_account_id: accountId,
          });
          created++;
        }

        // Generate onboarding link
        const accountLink = await stripe.accountLinks.create({
          account: accountId,
          refresh_url: `${origin}/store/dashboard?stripe_refresh=1&store=${store.id}`,
          return_url: `${origin}/store/dashboard?stripe_connected=1&store=${store.id}`,
          type: 'account_onboarding',
        });

        // Send email via Gmail
        const subject = `💳 ${store.name} — Link Your Bank Account to Start Receiving Payouts`;
        const htmlBody = buildOnboardingHTML(store, accountLink.url);
        const raw = buildRawEmail(store.email, subject, htmlBody, 'Alcohol Delivered');

        const gmailRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${gmailToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ raw }),
        });

        if (!gmailRes.ok) {
          const errBody = await gmailRes.text();
          throw new Error(`Gmail error: ${gmailRes.status} — ${errBody}`);
        }

        emailed++;
        results.push({
          store: store.name,
          email: store.email,
          stripe_account_id: accountId,
          status: 'emailed',
        });
      } catch (err) {
        failed++;
        results.push({ store: store.name, status: 'failed', error: err.message });
        console.error(`Failed for ${store.name}:`, err.message);
      }
    }

    return Response.json({
      success: true,
      total_stores: allStores.length,
      stores_processed: storesNeedingOnboarding.length,
      accounts_created: created,
      emails_sent: emailed,
      failed,
      results,
    });
  } catch (error) {
    console.error('bulkStripeOnboard error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});