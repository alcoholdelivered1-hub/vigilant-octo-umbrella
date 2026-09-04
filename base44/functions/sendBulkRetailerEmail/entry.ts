import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { getGmailSender, sendGmail } from '../../shared/emailUtils.ts';
import { isBlockedRecipient, normalizeEmail } from '../../shared/emailGuard.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const subject = (body.subject || '').trim();
    const message = (body.message || '').trim();
    if (!subject || !message) {
      return Response.json({ error: 'Subject and message are required' }, { status: 400 });
    }

    const only_active = body.only_active !== false; // default: active stores only
    const only_pending_stripe = !!body.only_pending_stripe;

    const allStores = await base44.asServiceRole.entities.Store.list('name', 500);

    const targets = [];
    const seen = new Set();
    for (const s of allStores) {
      const email = (s.email || '').trim();
      if (!email) continue;
      const e = normalizeEmail(email);
      if (seen.has(e)) continue;
      if (isBlockedRecipient(e)) continue;
      if (only_active && s.is_active === false) continue;
      if (only_pending_stripe && s.stripe_connect_onboarded) continue;
      seen.add(e);
      targets.push({ id: s.id, name: s.name, email: e });
    }

    if (targets.length === 0) {
      return Response.json({
        success: true,
        sent: 0,
        failed: 0,
        total: 0,
        results: [],
        reason: 'No matching retailers with an email address',
      });
    }

    const { accessToken, senderEmail } = await getGmailSender(base44);
    const htmlBody = buildHTML(subject, message);

    const results = [];
    let sent = 0;
    let failed = 0;
    for (const t of targets) {
      try {
        const res = await sendGmail(accessToken, t.email, senderEmail, subject, htmlBody);
        if (res.ok) {
          sent++;
          results.push({ store: t.name, email: t.email, status: 'sent' });
        } else {
          failed++;
          const errText = await res.text().catch(() => '');
          results.push({ store: t.name, email: t.email, status: 'failed', error: errText.slice(0, 200) });
        }
      } catch (e) {
        failed++;
        results.push({ store: t.name, email: t.email, status: 'failed', error: e.message });
      }
    }

    return Response.json({ success: true, sent, failed, total: targets.length, results });
  } catch (error) {
    console.error('sendBulkRetailerEmail error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildHTML(subject, message) {
  const paras = message
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;color:#1e293b;font-size:15px;line-height:1.6;">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'DM Sans',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr><td style="background:#1e3a5f;padding:28px 40px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Alcohol Delivered</h1>
          <p style="margin:4px 0 0;color:#f59e0b;font-size:12px;text-transform:uppercase;letter-spacing:1.5px;">Retailer Notification · Pine Bluff, Arkansas</p>
        </td></tr>
        <tr><td style="padding:36px 40px;">
          <h2 style="margin:0 0 20px;color:#1e3a5f;font-size:19px;">${escapeHtml(subject)}</h2>
          ${paras}
        </td></tr>
        <tr><td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;">
          <p style="margin:0;color:#64748b;font-size:12px;line-height:1.5;">You received this message because you are a retail partner of Alcohol Delivered. Reply to this email with any questions, or contact us at alcohol.delivered1@gmail.com.</p>
        </td></tr>
      </table>
      <p style="margin:16px 0 0;color:#94a3b8;font-size:11px;">Alcohol Delivered, LLC · Pine Bluff, AR</p>
    </td></tr>
  </table>
</body></html>`;
}