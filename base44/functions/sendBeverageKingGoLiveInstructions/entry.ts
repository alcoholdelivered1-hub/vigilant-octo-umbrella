/**
 * Sends Beverage King a go-live instructions email covering:
 *   1. Completing Stripe Connect onboarding (link bank account)
 *   2. Connecting their Clover POS (provide API token + merchant ID)
 *
 * The email states explicitly that NO real customer orders will be accepted
 * for Beverage King until a paid test order successfully appears on their
 * Clover POS.
 *
 * Looks up the store by name (case-insensitive "beverage king"), generates a
 * fresh Stripe onboarding link, and emails it via Gmail.
 *
 * POST body: {} — Admin-only.
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

function buildHTML(store, onboardingUrl, origin) {
  const dashboardUrl = `${origin}/store/dashboard`;
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
            <p style="margin:4px 0 0;color:#f59e0b;font-size:13px;text-transform:uppercase;letter-spacing:1.5px;">Beverage King — Two Steps to Go Live</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;">Hello Beverage King! 👑</h2>
            <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
              You're almost ready to start receiving orders through <strong>Alcohol Delivered</strong>. To go live, we need you to complete <strong>two connections</strong>: link your bank account through Stripe, and connect your Clover POS so orders sync straight to your register.
            </p>

            <!-- Hold notice -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fee2e2;border:1px solid #fca5a5;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
              <tr><td style="color:#991b1b;font-size:14px;font-weight:600;line-height:1.5;">
                ⛔ <strong>Important:</strong> We will <u>not</u> accept real customer orders for Beverage King until a <strong>paid test order</strong> successfully appears on your Clover POS. Please complete both steps below so we can run that test order as soon as possible.
              </td></tr>
            </table>

            <!-- STEP 1: Stripe -->
            <h3 style="margin:0 0 8px;color:#1e3a5f;font-size:16px;">Step 1 — Complete Your Stripe Setup 💳</h3>
            <p style="margin:0 0 14px;color:#475569;font-size:14px;line-height:1.6;">
              Click the button below to finish your one-time Stripe Express onboarding. You'll need your bank account &amp; routing number, business name &amp; EIN, business address &amp; phone, an owner's name/DOB/SSN last 4, and a valid government ID. Takes 5–10 minutes. Once complete, your weekly payouts will deposit straight to your bank every Monday.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td style="background:#1e3a5f;border-radius:10px;padding:20px;text-align:center;">
                  <a href="${onboardingUrl}" style="display:inline-block;background:#f59e0b;color:#1e3a5f;padding:14px 36px;border-radius:8px;text-decoration:none;font-size:16px;font-weight:700;">Complete Stripe Setup →</a>
                  <p style="margin:12px 0 0;color:#94a3b8;font-size:12px;">This link is unique to your account and may expire — reply to this email if you need a fresh one.</p>
                </td>
              </tr>
            </table>

            <!-- STEP 2: Clover -->
            <h3 style="margin:0 0 8px;color:#1e3a5f;font-size:16px;">Step 2 — Connect Your Clover POS 🖥️</h3>
            <p style="margin:0 0 14px;color:#475569;font-size:14px;line-height:1.6;">
              Connecting Clover lets us sync your real inventory and push incoming orders straight to your register. To connect, please send us the following from your Clover Dashboard (<a href="https://www.clover.com/login" style="color:#1e3a5f;font-weight:600;">clover.com/login</a> → Settings → API Tokens):
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px 20px;margin-bottom:14px;">
              <tr><td style="padding:4px 0;color:#475569;font-size:14px;line-height:1.8;">
                <strong style="color:#1e3a5f;">✓ Your Clover Merchant ID</strong> — found on your Clover Dashboard under Settings → Merchant<br>
                <strong style="color:#1e3a5f;">✓ Your Clover API Token</strong> — generated under Settings → API Tokens (create a new token with order + inventory permissions)<br>
                <strong style="color:#1e3a5f;">✓ Confirm your environment</strong> — let us know if this is your live/production Clover or a sandbox account
              </td></tr>
            </table>
            <p style="margin:0 0 24px;color:#475569;font-size:14px;line-height:1.6;">
              Just reply to this email with those two details (Merchant ID &amp; API Token), and we'll connect your Clover and run a paid test order to confirm everything flows through to your register.
            </p>

            <!-- What happens next -->
            <h3 style="margin:0 0 8px;color:#1e3a5f;font-size:16px;">What Happens Next</h3>
            <p style="margin:0 0 12px;color:#475569;font-size:14px;line-height:1.6;">
              Once both connections are complete, we'll push a small <strong>paid test order</strong> to your Clover. As soon as that test order shows up on your register, we'll flip Beverage King live and real customers can start ordering.
            </p>

            <!-- Help -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:10px;padding:16px 20px;margin-bottom:8px;">
              <tr><td style="color:#1e3a5f;font-size:14px;font-weight:600;padding-bottom:8px;">Need a hand? We'll walk you through either step.</td></tr>
              <tr><td style="color:#475569;font-size:13px;padding:2px 0;">✉️ <a href="mailto:alcohol.delivered1@gmail.com" style="color:#1e3a5f;text-decoration:none;">alcohol.delivered1@gmail.com</a></td></tr>
              <tr><td style="color:#475569;font-size:13px;padding:2px 0;">🌐 <a href="https://alcohol-delivered.biz" style="color:#1e3a5f;text-decoration:none;">alcohol-delivered.biz</a></td></tr>
              <tr><td style="color:#475569;font-size:13px;padding:2px 0;">📍 Pine Bluff, AR — Jefferson County</td></tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#1e3a5f;padding:20px 40px;text-align:center;">
            <p style="margin:0;color:#94a3b8;font-size:11px;line-height:1.5;">
              Alcohol Delivered, LLC · Pine Bluff, AR · alcohol-delivered.biz<br>
              This email was sent to ${store.email} regarding your Beverage King go-live setup.<br>
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

    const origin = req.headers.get('origin') || 'https://alcohol-delivered.biz';

    // Look up Beverage King (case-insensitive)
    const stores = await base44.asServiceRole.entities.Store.list('name', 500);
    const store = stores.find(
      (s) => s.name && s.name.toLowerCase().includes('beverage king')
    );
    if (!store) {
      return Response.json({ error: 'Beverage King store not found' }, { status: 404 });
    }
    if (!store.email || !store.email.includes('@')) {
      return Response.json({ error: 'Beverage King has no valid email address' }, { status: 400 });
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

    // Ensure a Stripe Express account exists
    let accountId = store.stripe_connect_account_id;
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: store.email,
        business_type: 'company',
        business_profile: { name: store.name, url: origin, mcc: '5921' },
        capabilities: { transfers: { requested: true }, card_payments: { requested: true } },
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

    // Fresh onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/store/dashboard?stripe_refresh=1&store=${store.id}`,
      return_url: `${origin}/store/dashboard?stripe_connected=1&store=${store.id}`,
      type: 'account_onboarding',
    });

    // Send email via Gmail
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
    const subject = `👑 Beverage King — Complete Stripe + Clover to Go Live`;
    const htmlBody = buildHTML(store, accountLink.url, origin);
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
    console.log(`Beverage King go-live instructions sent to ${store.email}`);

    return Response.json({
      success: true,
      store: store.name,
      email: store.email,
      stripe_account_id: accountId,
      onboarding_url: accountLink.url,
      gmail_message_id: gmailResult.id,
    });
  } catch (error) {
    console.error('sendBeverageKingGoLiveInstructions error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});