/**
 * sendCloverOnboardingToRetailers
 * Emails every retailer (with a valid email) a Clover POS onboarding message
 * with a link to the self-serve /admin/clover-connect page, so any store using
 * Clover can authorize their merchant and start syncing orders.
 *
 * Admin-only. POST body: { only_clover?: boolean } — default sends to all active
 * stores; pass only_clover:true to restrict to stores whose pos_system is 'clover'.
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

function buildHTML(store, connectUrl) {
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
          <h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;">Hello ${store.name}! 🍷</h2>
          <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.6;">
            Do you use <strong>Clover POS</strong> at your store? Connecting it to Alcohol Delivered takes about two minutes and lets your menu, prices, and orders sync automatically — no manual entry.
          </p>
          <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.6;"><strong style="color:#1e3a5f;">Here's what it does:</strong></p>
          <ul style="margin:0 0 20px;color:#475569;font-size:14px;line-height:1.8;padding-left:20px;">
            <li>Pulls your live Clover inventory into your online store</li>
            <li>Pushes customer orders straight to your Clover register</li>
            <li>Keeps prices and stock in sync automatically</li>
          </ul>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
            <tr><td style="background:#1e3a5f;border-radius:10px;padding:20px;text-align:center;">
              <a href="${connectUrl}" style="display:inline-block;background:#f59e0b;color:#1e3a5f;padding:14px 36px;border-radius:8px;text-decoration:none;font-size:16px;font-weight:700;">Connect Your Clover POS →</a>
              <p style="margin:12px 0 0;color:#94a3b8;font-size:12px;">You'll log in to Clover and click "Allow" — that's it.</p>
            </td></tr>
          </table>
          <p style="margin:0;color:#64748b;font-size:13px;line-height:1.6;">
            Not using Clover? No action needed — just reply to this email and we'll help sync your inventory another way.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:10px;padding:16px 20px;margin-top:20px;">
            <tr><td style="color:#475569;font-size:13px;padding:2px 0;">✉️ <a href="mailto:alcohol.delivered1@gmail.com" style="color:#1e3a5f;text-decoration:none;">alcohol.delivered1@gmail.com</a></td></tr>
            <tr><td style="color:#475569;font-size:13px;padding:2px 0;">🌐 <a href="https://alcohol-delivered.biz" style="color:#1e3a5f;text-decoration:none;">alcohol-delivered.biz</a></td></tr>
          </table>
        </td></tr>
        <tr><td style="background:#1e3a5f;padding:20px 40px;text-align:center;">
          <p style="margin:0;color:#94a3b8;font-size:11px;line-height:1.5;">Alcohol Delivered, LLC · Pine Bluff, AR · Operating under Arkansas ACT 157</p>
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

    const body = await req.json().catch(() => ({}));
    const onlyClover = !!body.only_clover;
    const origin = req.headers.get('origin') || 'https://alcohol-delivered.biz';
    const connectUrl = `${origin}/store/clover-connect`;

    const allStores = await base44.asServiceRole.entities.Store.list('name', 500);
    let storesWithEmail = allStores.filter(s => s.email && s.email.includes('@'));
    if (onlyClover) storesWithEmail = storesWithEmail.filter(s => s.pos_system === 'clover');

    if (storesWithEmail.length === 0) {
      return Response.json({ error: 'No stores with email addresses found' }, { status: 400 });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
    const results = [];

    for (const store of storesWithEmail) {
      try {
        const subject = `🍷 ${store.name} — Connect Your Clover POS to Alcohol Delivered`;
        const raw = buildRawEmail(store.email, subject, buildHTML(store, connectUrl), 'Alcohol Delivered');
        const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ raw }),
        });
        if (!res.ok) throw new Error(`Gmail API error: ${res.status} — ${await res.text()}`);
        results.push({ store: store.name, email: store.email, pos_system: store.pos_system || 'none', status: 'sent' });
      } catch (err) {
        results.push({ store: store.name, email: store.email, status: 'failed', error: err.message });
      }
    }

    return Response.json({
      success: true,
      sent: results.filter(r => r.status === 'sent').length,
      failed: results.filter(r => r.status === 'failed').length,
      total: results.length,
      results,
    });
  } catch (error) {
    console.error('sendCloverOnboardingToRetailers error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});