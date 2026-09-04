/**
 * Sends Beverage King step-by-step instructions to complete the self-serve
 * Clover v2 OAuth flow (now that they have admin access). Uses the Gmail
 * connector (service role) so it reaches the address even if not yet a
 * registered app user.
 *
 * POST body: { to?: string, store_name?: string, merchant_id?: string }
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

function buildHTML(to, storeName, merchantId) {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'DM Sans',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
<tr><td style="background:#1e3a5f;padding:32px 40px;text-align:center;">
  <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">Alcohol Delivered</h1>
  <p style="margin:4px 0 0;color:#f59e0b;font-size:13px;text-transform:uppercase;letter-spacing:1.5px;">Connect Your Clover POS</p>
</td></tr>
<tr><td style="padding:36px 40px;">
  <h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;">Hello ${storeName}! 👑</h2>
  <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
    You now have admin access to <strong>Alcohol Delivered</strong>. One last step is needed to go live: connect your Clover POS so your menu, prices, and orders sync automatically. This takes about 2 minutes.
  </p>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
    <tr><td style="color:#475569;font-size:14px;line-height:1.8;">
      <strong style="color:#1e3a5f;">⚠ Use the LIVE app, not a builder preview.</strong> Clover blocks authorization inside an embedded preview, so open the published Alcohol Delivered app on your phone or browser.
    </td></tr>
  </table>
  <h3 style="margin:0 0 10px;color:#1e3a5f;font-size:16px;">Step-by-step</h3>
  <ol style="margin:0 0 24px;padding-left:22px;color:#475569;font-size:15px;line-height:1.8;">
    <li>In your <strong>Clover Developer Dashboard</strong> (under the <strong>${storeName}</strong> merchant), make sure you have an app with <strong>Inventory</strong> and <strong>Orders</strong> permissions, and note that app's <strong>Client ID</strong>. <span style="color:#92400e;">Important: use <em>your own</em> app's Client ID — <u>not</u> the platform/Alcohol Delivered app, which can only connect to the wrong merchant.</span></li>
    <li>Sign in to the Alcohol Delivered app with <strong>${to}</strong>.</li>
    <li>Open your <strong>Store Dashboard</strong>, then go to <strong>Clover Connect</strong>.</li>
    <li>In the <strong>Clover App ID (Client ID)</strong> box, enter <strong>your app's Client ID</strong> (from step 1) — replace whatever is pre-filled.</li>
    <li>Click <strong>"Authorize Merchant"</strong> — you'll be sent to Clover. <strong>Log in with the ${storeName} merchant account</strong> and click <strong>Allow</strong>.</li>
    <li>You'll be redirected back with an authorization code auto-filled. Click <strong>"Connect"</strong>.</li>
    <li>Our system verifies the connection read-only (merchant lookup, first 10 inventory items, recent orders, and permissions). You'll see a success confirmation once it passes — your merchant ID is saved automatically.</li>
  </ol>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef3c7;border:1px solid #fcd34d;border-radius:10px;padding:16px 20px;margin-bottom:14px;">
    <tr><td style="color:#92400e;font-size:14px;line-height:1.6;">
      <strong>Authorize on production Clover</strong> (not sandbox) so live orders route correctly.<br>
      Sign in to Clover as the <strong>${storeName}</strong> merchant and authorize using <strong>your own app's Client ID</strong> (merchant ID <code>${merchantId}</code>). If the wrong merchant or app is authorized, our verification flags it and the credential is <u>not</u> saved.
    </td></tr>
  </table>
  <p style="margin:14px 0 0;color:#94a3b8;font-size:13px;line-height:1.6;">
    Your token is stored encrypted and server-side only — it is never displayed or shared. If you hit any error, reply to this email and we'll help right away.
  </p>
</td></tr>
<tr><td style="background:#f8fafc;padding:20px 40px;text-align:center;">
  <p style="margin:0;color:#94a3b8;font-size:12px;">Alcohol Delivered — Licensed Arkansas Alcohol Delivery</p>
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

    let body: any = {};
    try { body = await req.json(); } catch (_) { /* empty body ok */ }
    const to = (body.to || 'bevking71603@gmail.com').toString().trim().toLowerCase();
    const storeName = (body.store_name || 'Beverage King').toString();
    const merchantId = (body.merchant_id || '5428143500034529').toString();

    const subject = 'Action needed: Connect your Clover POS to Alcohol Delivered';
    const htmlBody = buildHTML(to, storeName, merchantId);
    const raw = buildRawEmail(to, subject, htmlBody, 'Alcohol Delivered');

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw }),
    });
    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Gmail API error: ${res.status} — ${errBody}`);
    }
    const gmailResult = await res.json();
    console.log(`Clover OAuth instructions sent to ${to}`);
    return Response.json({ success: true, to, gmail_message_id: gmailResult.id });
  } catch (error) {
    console.error('sendCloverOAuthInstructions error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});