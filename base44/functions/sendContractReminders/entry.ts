import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function buildRawEmail(to, subject, htmlBody, fromName, senderEmail) {
  const message = [
    `From: ${fromName} <${senderEmail}>`,
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

function buildReminderHTML(store) {
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
            <p style="margin:4px 0 0;color:#f59e0b;font-size:13px;text-transform:uppercase;letter-spacing:1.5px;">Retailer Partner Agreement — Friendly Reminder</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;">Hello ${store.name} Team,</h2>
            <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.6;">
              Just a friendly reminder — we sent over your <strong>Alcohol Delivered Retailer Partner Agreement</strong> a few days ago and haven't received your signature yet.
            </p>
            <p style="margin:0 0 28px;color:#1e293b;font-size:15px;line-height:1.6;background:#fef3c7;border-left:4px solid #f59e0b;padding:16px 20px;border-radius:0 8px 8px 0;">
              Completing your agreement is the <strong>final step</strong> before we can start sending you delivery orders and growing your sales.
            </p>

            <!-- CTA Button -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td align="center">
                  <a href="https://alcohol-delivered.biz/retailer-contract" style="display:inline-block;background:#f59e0b;color:#1e3a5f;padding:14px 36px;border-radius:8px;text-decoration:none;font-size:16px;font-weight:700;">📋 Review & Sign Your Agreement</a>
                </td>
              </tr>
            </table>

            <!-- What Happens Next -->
            <h3 style="margin:0 0 12px;color:#1e3a5f;font-size:16px;">Once You Sign, Here's What Happens:</h3>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr><td style="padding:8px 0;color:#475569;font-size:14px;line-height:1.5;"><strong style="color:#1e3a5f;">✓</strong> Your store goes live on our platform instantly</td></tr>
              <tr><td style="padding:8px 0;color:#475569;font-size:14px;line-height:1.5;"><strong style="color:#1e3a5f;">✓</strong> Customers can start browsing and ordering your products</td></tr>
              <tr><td style="padding:8px 0;color:#475569;font-size:14px;line-height:1.5;"><strong style="color:#1e3a5f;">✓</strong> You receive 100% of the product subtotal on every order</td></tr>
              <tr><td style="padding:8px 0;color:#475569;font-size:14px;line-height:1.5;"><strong style="color:#1e3a5f;">✓</strong> Our drivers handle all delivery, ID verification, and compliance</td></tr>
            </table>

            <!-- Contact -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:10px;padding:16px 20px;">
              <tr><td style="color:#1e3a5f;font-size:14px;font-weight:600;padding-bottom:8px;">Questions? We're here to help.</td></tr>
              <tr><td style="color:#475569;font-size:13px;padding:2px 0;">✉️ <a href="mailto:alcohol.delivered1@gmail.com" style="color:#1e3a5f;text-decoration:none;">alcohol.delivered1@gmail.com</a></td></tr>
              <tr><td style="color:#475569;font-size:13px;padding:2px 0;">📞 870-209-9109 · 870-718-1521</td></tr>
              <tr><td style="color:#475569;font-size:13px;padding:2px 0;">🌐 <a href="https://alcohol-delivered.biz" style="color:#1e3a5f;text-decoration:none;">alcohol-delivered.biz</a></td></tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#1e3a5f;padding:20px 40px;text-align:center;">
            <p style="margin:0;color:#94a3b8;font-size:11px;line-height:1.5;">
              Alcohol Delivered, LLC · Pine Bluff, AR · alcohol-delivered.biz<br>
              This email was sent to ${store.email}.<br>
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

    // Allow scheduled automation (no user) OR admin manual trigger
    const payload = await req.json().catch(() => ({}));
    const isScheduled = payload?.event?.type === 'scheduled' || !payload?.event;
    if (!isScheduled) {
      const user = await base44.auth.me().catch(() => null);
      if (user?.role !== 'admin') {
        return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });
      }
    }

    const REMINDER_AFTER_DAYS = 3;
    const now = Date.now();
    const cutoff = now - REMINDER_AFTER_DAYS * 24 * 60 * 60 * 1000;

    const allStores = await base44.asServiceRole.entities.Store.list();

    // Stores still awaiting signature, with an email, contract sent >= 3 days ago,
    // and no reminder sent in the last 3 days.
    const targets = allStores.filter((s) => {
      if (s.onboarding_status !== 'contract_sent') return false;
      if (!s.email) return false;
      const sentAt = s.contract_sent_at ? new Date(s.contract_sent_at).getTime() : null;
      if (!sentAt || sentAt > cutoff) return false;
      const remindedAt = s.reminder_sent_at ? new Date(s.reminder_sent_at).getTime() : 0;
      if (remindedAt > cutoff) return false;
      return true;
    });

    if (targets.length === 0) {
      return Response.json({ success: true, sent: 0, reason: 'No stores due for a reminder' });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
    const profileRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const { emailAddress } = await profileRes.json();

    const results = [];
    for (const store of targets) {
      const subject = `Reminder: Complete Your Alcohol Delivered Partner Agreement — ${store.name}`;
      const htmlBody = buildReminderHTML(store);

      try {
        const raw = buildRawEmail(store.email, subject, htmlBody, 'Alcohol Delivered', emailAddress);
        const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ raw }),
        });
        if (!res.ok) {
          const errBody = await res.text();
          throw new Error(`Gmail API error: ${res.status} — ${errBody}`);
        }
        await base44.asServiceRole.entities.Store.update(store.id, {
          reminder_sent_at: new Date().toISOString(),
        });
        console.log(`Reminder sent to ${store.name} <${store.email}>`);
        results.push({ store: store.name, status: 'sent' });
      } catch (err) {
        console.error(`Reminder failed for ${store.name}: ${err.message}`);
        results.push({ store: store.name, status: 'failed', error: err.message });
      }
    }

    const sent = results.filter((r) => r.status === 'sent').length;
    return Response.json({ success: true, sent, results });
  } catch (error) {
    console.error('Contract reminder error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});