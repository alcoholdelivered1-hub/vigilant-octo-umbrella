/**
 * Generates a fresh Stripe Express onboarding link for a store and emails
 * it to the store's contact email via Gmail.
 *
 * POST body: { store_id: string }
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

function buildStripeOnboardingHTML(store, onboardingUrl) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'DM Sans',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:#1e3a5f;padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:0.5px;">Alcohol Delivered</h1>
            <p style="margin:4px 0 0;color:#f59e0b;font-size:13px;text-transform:uppercase;letter-spacing:1.5px;">Action Needed: Link Your Bank Account</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;">Hello ${store.name}! 💳</h2>
            <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
              To receive your weekly payouts for orders placed through <strong>Alcohol Delivered</strong>, you need to complete a quick one-time setup with our payment partner, <strong>Stripe</strong>. This links your bank account so we can deposit your earnings directly.
            </p>

            <!-- Alert Box -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef3c7;border:1px solid #fcd34d;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
              <tr><td style="color:#92400e;font-size:14px;font-weight:600;line-height:1.5;">
                ⏳ Your payouts are currently on hold until this step is completed. Orders are still coming in — finish setup today to receive your first payout!
              </td></tr>
            </table>

            <!-- What You'll Need -->
            <h3 style="margin:0 0 12px;color:#1e3a5f;font-size:16px;">What You'll Need (5–10 minutes)</h3>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
              <tr><td style="padding:4px 0;color:#475569;font-size:14px;line-height:1.8;">
                <strong style="color:#1e3a5f;">✓</strong> Your bank account number and routing number<br>
                <strong style="color:#1e3a5f;">✓</strong> Business name and EIN (tax ID)<br>
                <strong style="color:#1e3a5f;">✓</strong> Business address and phone number<br>
                <strong style="color:#1e3a5f;">✓</strong> Name, DOB, and SSN last 4 of an owner or representative<br>
                <strong style="color:#1e3a5f;">✓</strong> A valid government-issued ID
              </td></tr>
            </table>

            <!-- CTA Button -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td style="background:#1e3a5f;border-radius:10px;padding:24px;text-align:center;">
                  <p style="margin:0 0 14px;color:#ffffff;font-size:15px;font-weight:600;">🔗 Click below to start your Stripe Express onboarding</p>
                  <a href="${onboardingUrl}" style="display:inline-block;background:#f59e0b;color:#1e3a5f;padding:14px 36px;border-radius:8px;text-decoration:none;font-size:16px;font-weight:700;">Complete Stripe Setup →</a>
                  <p style="margin:12px 0 0;color:#94a3b8;font-size:12px;">This link is unique to your account and may expire. If it does, just let us know and we'll send a new one.</p>
                </td>
              </tr>
            </table>

            <!-- Why Stripe -->
            <h3 style="margin:0 0 8px;color:#1e3a5f;font-size:16px;">Why Stripe?</h3>
            <p style="margin:0 0 24px;color:#475569;font-size:14px;line-height:1.6;">
              Stripe is the same secure payment platform used by Amazon, Lyft, and Shopify. Your banking details are encrypted and never shared with us — Stripe handles all transfers directly to your account. Once set up, you'll receive <strong>weekly payouts</strong> every Monday for the previous week's delivered orders.
            </p>

            <!-- Help -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:10px;padding:16px 20px;margin-bottom:8px;">
              <tr><td style="color:#1e3a5f;font-size:14px;font-weight:600;padding-bottom:8px;">Need help? We're standing by.</td></tr>
              <tr><td style="color:#475569;font-size:13px;padding:2px 0;">✉️ <a href="mailto:alcohol.delivered1@gmail.com" style="color:#1e3a5f;text-decoration:none;">alcohol.delivered1@gmail.com</a></td></tr>
              <tr><td style="color:#475569;font-size:13px;padding:2px 0;">🌐 <a href="https://alcohol-delivered.biz" style="color:#1e3a5f;text-decoration:none;">alcohol-delivered.biz</a></td></tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#1e3a5f;padding:20px 40px;text-align:center;">
            <p style="margin:0;color:#94a3b8;font-size:11px;line-height:1.5;">
              Alcohol Delivered, LLC · Pine Bluff, AR · alcohol-delivered.biz<br>
              This email was sent to ${store.email} regarding your payout setup.<br>
              Operating under Arkansas ACT 157 with a valid ABC Third-Party Delivery Permit.
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

    const { store_id } = await req.json();
    if (!store_id) return Response.json({ error: 'store_id is required' }, { status: 400 });

    // Fetch the store
    const stores = await base44.asServiceRole.entities.Store.filter({ id: store_id }, 'name', 1);
    const store = stores[0];
    if (!store) return Response.json({ error: 'Store not found' }, { status: 404 });
    if (!store.email || !store.email.includes('@')) {
      return Response.json({ error: 'Store has no valid email address' }, { status: 400 });
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

    // Create or retrieve the Express account
    let accountId = store.stripe_connect_account_id;
    if (!accountId) {
      const origin = req.headers.get('origin') || 'https://alcohol-delivered.biz';
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
    }

    // Generate a fresh onboarding link
    const origin = req.headers.get('origin') || 'https://alcohol-delivered.biz';
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/store/dashboard?stripe_refresh=1&store=${store.id}`,
      return_url: `${origin}/store/dashboard?stripe_connected=1&store=${store.id}`,
      type: 'account_onboarding',
    });

    // Build and send the email via Gmail
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');

    const subject = `💳 ${store.name} — Link Your Bank Account to Start Receiving Payouts`;
    const htmlBody = buildStripeOnboardingHTML(store, accountLink.url);
    const raw = buildRawEmail(store.email, subject, htmlBody, 'Alcohol Delivered');

    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Gmail API error: ${res.status} — ${errBody}`);
    }

    const gmailResult = await res.json();

    console.log(`Stripe onboarding email sent to ${store.name} <${store.email}>`);

    return Response.json({
      success: true,
      store: store.name,
      email: store.email,
      stripe_account_id: accountId,
      onboarding_url: accountLink.url,
      gmail_message_id: gmailResult.id,
    });
  } catch (error) {
    console.error('sendStripeOnboardingEmail error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});