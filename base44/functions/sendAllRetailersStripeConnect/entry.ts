/**
 * Sends every retailer (with a valid email) a Stripe Connect onboarding email
 * that also includes instructions on how to sync their store with Alcohol Delivered.
 *
 * For each store:
 *   1. Creates (if needed) a Stripe Express account and saves the account id.
 *   2. Generates a fresh account_onboarding link.
 *   3. Emails the store an enhanced template covering bank/payout setup AND
 *      inventory/POS sync instructions.
 *
 * POST body: {} — sends to all stores with an email address.
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

function buildHTML(store, onboardingUrl, origin) {
  const dashboardUrl = `${origin}/store/dashboard`;
  const registerUrl = `${origin}/register`;
  const contractUrl = `${origin}/retailer-contract?store=${store.id}`;
  const inventoryUploadUrl = `${origin}/admin/inventory-upload`;
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
            <p style="margin:4px 0 0;color:#f59e0b;font-size:13px;text-transform:uppercase;letter-spacing:1.5px;">Action Needed: Link Your Bank &amp; Sync Your Store</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;">Hello ${store.name}! 🚀</h2>
            <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
              We're ready to start sending you orders. There are <strong>two quick steps</strong> to get fully synced with Alcohol Delivered: (1) link your bank account through Stripe so we can pay you, and (2) sync your inventory so customers can see and order your products.
            </p>

            <!-- STEP 1: Stripe -->
            <h3 style="margin:0 0 8px;color:#1e3a5f;font-size:16px;">Step 1 — Link Your Bank Account (Stripe) 💳</h3>
            <p style="margin:0 0 14px;color:#475569;font-size:14px;line-height:1.6;">
              To receive weekly payouts for delivered orders, complete a one-time setup with our payment partner, Stripe.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:10px;padding:16px 20px;margin-bottom:14px;">
              <tr><td style="padding:4px 0;color:#475569;font-size:14px;line-height:1.8;">
                <strong style="color:#1e3a5f;">You'll need (5–10 min):</strong> bank account &amp; routing number, business name &amp; EIN, business address &amp; phone, an owner's name/DOB/SSN last 4, and a valid government ID.
              </td></tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td style="background:#1e3a5f;border-radius:10px;padding:20px;text-align:center;">
                  <a href="${onboardingUrl}" style="display:inline-block;background:#f59e0b;color:#1e3a5f;padding:14px 36px;border-radius:8px;text-decoration:none;font-size:16px;font-weight:700;">Complete Stripe Setup →</a>
                  <p style="margin:12px 0 0;color:#94a3b8;font-size:12px;">This link is unique to your account and may expire — reply to this email if you need a new one.</p>
                </td>
              </tr>
            </table>

            <!-- STEP 2: Sync -->
            <h3 style="margin:0 0 8px;color:#1e3a5f;font-size:16px;">Step 2 — Sync Your Store With Alcohol Delivered 🔄</h3>
            <p style="margin:0 0 12px;color:#475569;font-size:14px;line-height:1.6;">
              Once your account is set up, here's how your store connects to our platform:
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 20px;margin-bottom:8px;">
                  <p style="margin:0;color:#1e293b;font-size:14px;line-height:1.6;"><strong style="color:#1e3a5f;">1. Register your account</strong><br>
                  <span style="color:#64748b;font-size:13px;">Sign up at <a href="${registerUrl}" style="color:#1e3a5f;font-weight:600;">alcohol-delivered.biz/register</a> using <strong>${store.email}</strong>, then log in to your <a href="${dashboardUrl}" style="color:#1e3a5f;font-weight:600;">Store Dashboard</a>.</span></p>
                </td>
              </tr>
              <tr><td style="height:8px;"></td></tr>
              <tr>
                <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 20px;margin-bottom:8px;">
                  <p style="margin:0;color:#1e293b;font-size:14px;line-height:1.6;"><strong style="color:#1e3a5f;">2. Load your inventory</strong><br>
                  <span style="color:#64748b;font-size:13px;">Add products in your dashboard (name, category, price, stock), send us a CSV/spreadsheet and we'll upload it, or connect your Clover POS so your menu syncs automatically.</span></p>
                </td>
              </tr>
              <tr><td style="height:8px;"></td></tr>
              <tr>
                <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 20px;margin-bottom:8px;">
                  <p style="margin:0;color:#1e293b;font-size:14px;line-height:1.6;"><strong style="color:#1e3a5f;">3. Sign your partner agreement</strong><br>
                  <span style="color:#64748b;font-size:13px;">Review and sign at <a href="${contractUrl}" style="color:#1e3a5f;font-weight:600;">alcohol-delivered.biz/retailer-contract</a>.</span></p>
                </td>
              </tr>
              <tr><td style="height:8px;"></td></tr>
              <tr>
                <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 20px;">
                  <p style="margin:0;color:#1e293b;font-size:14px;line-height:1.6;"><strong style="color:#1e3a5f;">4. Orders flow automatically</strong><br>
                  <span style="color:#64748b;font-size:13px;">When a customer orders, you get an instant alert — prepare it, seal it, and our driver picks it up. You keep <strong>100% of the product subtotal</strong>; we earn only service &amp; delivery fees. Payouts hit your bank every Monday.</span></p>
                </td>
              </tr>
            </table>

            <!-- Help -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:10px;padding:16px 20px;margin-bottom:8px;">
              <tr><td style="color:#1e3a5f;font-size:14px;font-weight:600;padding-bottom:8px;">Questions? We're standing by to help you sync.</td></tr>
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
              This email was sent to ${store.email} regarding your payout &amp; store sync setup.<br>
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

    // All stores with a valid contact email
    const allStores = await base44.asServiceRole.entities.Store.list('name', 500);
    const storesWithEmail = allStores.filter(s => s.email && s.email.includes('@'));

    if (storesWithEmail.length === 0) {
      return Response.json({ error: 'No stores with email addresses found' }, { status: 400 });
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

    // Gmail OAuth token (shared)
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');

    const results = [];

    for (const store of storesWithEmail) {
      try {
        // 1. Ensure a Stripe Express account exists for this store
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
        }

        // 2. Fresh onboarding link
        const accountLink = await stripe.accountLinks.create({
          account: accountId,
          refresh_url: `${origin}/store/dashboard?stripe_refresh=1&store=${store.id}`,
          return_url: `${origin}/store/dashboard?stripe_connected=1&store=${store.id}`,
          type: 'account_onboarding',
        });

        // 3. Email
        const subject = `🚀 ${store.name} — Link Your Bank & Sync Your Store With Alcohol Delivered`;
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

        console.log(`Stripe+sync email sent to ${store.name} <${store.email}>`);
        results.push({ store: store.name, email: store.email, stripe_account_id: accountId, status: 'sent' });
      } catch (err) {
        console.error(`Failed for ${store.name}: ${err.message}`);
        results.push({ store: store.name, email: store.email, status: 'failed', error: err.message });
      }
    }

    const sent = results.filter(r => r.status === 'sent').length;
    const failed = results.filter(r => r.status === 'failed').length;

    return Response.json({ success: true, sent, failed, total: results.length, results });
  } catch (error) {
    console.error('sendAllRetailersStripeConnect error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});