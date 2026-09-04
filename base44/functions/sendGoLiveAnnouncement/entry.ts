/**
 * Sends a "going live in a few days" announcement email to all stores
 * that have a valid email address on file.
 *
 * POST body: {} (sends to all stores with email)
 * Admin-only.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

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

function buildGoLiveHTML(store) {
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
            <p style="margin:4px 0 0;color:#f59e0b;font-size:13px;text-transform:uppercase;letter-spacing:1.5px;">🚀 We're Going Live This Week!</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;">Hello ${store.name}! 🎉</h2>
            <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
              The moment we've been building toward is almost here. <strong>Alcohol Delivered is launching in just a few days</strong> — and you're part of our founding group of retail partners. Customers across Jefferson County and the surrounding wet areas will soon be able to browse your store and order for delivery straight from their phones.
            </p>

            <!-- Launch Alert -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#1e3a5f,#2d4a7a);border-radius:12px;padding:24px;margin-bottom:24px;">
              <tr><td style="text-align:center;">
                <p style="margin:0 0 6px;color:#f59e0b;font-size:28px;font-weight:800;">Launching This Week</p>
                <p style="margin:0;color:#ffffff;font-size:14px;line-height:1.6;">Get your inventory loaded and your dashboard ready — orders start flowing soon!</p>
              </td></tr>
            </table>

            <!-- Checklist -->
            <h3 style="margin:0 0 12px;color:#1e3a5f;font-size:16px;">Your Launch Checklist ✅</h3>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 20px;margin-bottom:8px;">
                  <p style="margin:0;color:#1e293b;font-size:14px;line-height:1.6;"><strong style="color:#1e3a5f;">1. Register your account</strong><br>
                  <span style="color:#64748b;font-size:13px;">Go to <a href="https://alcohol-delivered.biz/register" style="color:#1e3a5f;font-weight:600;">alcohol-delivered.biz/register</a> and sign up using <strong>${store.email}</strong></span></p>
                </td>
              </tr>
              <tr><td style="height:8px;"></td></tr>
              <tr>
                <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 20px;margin-bottom:8px;">
                  <p style="margin:0;color:#1e293b;font-size:14px;line-height:1.6;"><strong style="color:#1e3a5f;">2. Load your inventory</strong><br>
                  <span style="color:#64748b;font-size:13px;">Log in to your <a href="https://alcohol-delivered.biz/store/dashboard" style="color:#1e3a5f;font-weight:600;">Store Dashboard</a> and add your products — name, category, price, and stock. You can also send us a spreadsheet and we'll upload it for you.</span></p>
                </td>
              </tr>
              <tr><td style="height:8px;"></td></tr>
              <tr>
                <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 20px;margin-bottom:8px;">
                  <p style="margin:0;color:#1e293b;font-size:14px;line-height:1.6;"><strong style="color:#1e3a5f;">3. Link your bank account (Stripe)</strong><br>
                  <span style="color:#64748b;font-size:13px;">Complete your Stripe Express onboarding from the dashboard so we can deposit your weekly payouts directly. Takes 5–10 minutes.</span></p>
                </td>
              </tr>
              <tr><td style="height:8px;"></td></tr>
              <tr>
                <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 20px;">
                  <p style="margin:0;color:#1e293b;font-size:14px;line-height:1.6;"><strong style="color:#1e3a5f;">4. Sign your partner agreement</strong><br>
                  <span style="color:#64748b;font-size:13px;">Review and sign your retailer agreement at <a href="https://alcohol-delivered.biz/retailer-contract?store=${store.id}" style="color:#1e3a5f;font-weight:600;">alcohol-delivered.biz/retailer-contract</a></span></p>
                </td>
              </tr>
            </table>

            <!-- What to Expect -->
            <h3 style="margin:0 0 8px;color:#1e3a5f;font-size:16px;">What Happens at Launch?</h3>
            <p style="margin:0 0 24px;color:#475569;font-size:14px;line-height:1.6;">
              Once we go live, customers will see your store in the app immediately. You'll receive an instant notification every time an order comes in — just prepare it, seal it, and our driver picks it up. You keep <strong>100% of the product subtotal</strong>; we only earn our service and delivery fees. Payouts hit your bank every Monday.
            </p>

            <!-- CTA -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td style="background:#f59e0b;border-radius:10px;padding:20px;text-align:center;">
                  <a href="https://alcohol-delivered.biz/store/dashboard" style="display:inline-block;background:#1e3a5f;color:#ffffff;padding:14px 36px;border-radius:8px;text-decoration:none;font-size:16px;font-weight:700;">Go to Your Dashboard →</a>
                </td>
              </tr>
            </table>

            <!-- Contact -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:10px;padding:16px 20px;margin-bottom:8px;">
              <tr><td style="color:#1e3a5f;font-size:14px;font-weight:600;padding-bottom:8px;">Questions? We're here to help you get ready.</td></tr>
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
              This email was sent to ${store.email} as a launch announcement.<br>
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

    // Get all stores with valid emails
    const allStores = await base44.asServiceRole.entities.Store.list('name', 500);
    const storesWithEmail = allStores.filter(s => s.email && s.email.includes('@'));

    if (storesWithEmail.length === 0) {
      return Response.json({ error: 'No stores with email addresses found' }, { status: 400 });
    }

    // Get Gmail OAuth access token
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');

    const results = [];

    for (const store of storesWithEmail) {
      const subject = `🚀 ${store.name} — We're Going Live This Week! Get Ready!`;
      const htmlBody = buildGoLiveHTML(store);

      try {
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

        console.log(`Go-live email sent to ${store.name} <${store.email}>`);
        results.push({ store: store.name, email: store.email, status: 'sent' });
      } catch (err) {
        console.error(`Failed to send to ${store.name}: ${err.message}`);
        results.push({ store: store.name, email: store.email, status: 'failed', error: err.message });
      }
    }

    const sent = results.filter(r => r.status === 'sent').length;
    const failed = results.filter(r => r.status === 'failed').length;

    return Response.json({ success: true, sent, failed, total: results.length, results });
  } catch (error) {
    console.error('sendGoLiveAnnouncement error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});