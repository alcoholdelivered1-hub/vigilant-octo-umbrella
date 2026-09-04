import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { data, old_data, event } = body || {};

    if (!data) return Response.json({ skipped: true, reason: 'no store data' });

    const store = data;
    const prevStatus = old_data?.onboarding_status;

    // Only notify when onboarding_status transitions to 'live'
    if (store.onboarding_status !== 'live') {
      return Response.json({ skipped: true, reason: `status is ${store.onboarding_status}, not live` });
    }
    if (prevStatus === 'live') {
      return Response.json({ skipped: true, reason: 'was already live' });
    }

    const secretEmail = Deno.env.get('STORE_MANAGER_EMAIL')?.trim();
    const adminEmail = (secretEmail && secretEmail.includes('@')) ? secretEmail : 'madhouserecords@yahoo.com';

    // Get Gmail access token
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');

    const subject = `✅ ${store.name} Completed Onboarding — Now Live!`;
    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#16a34a;padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">🎉 Onboarding Complete!</h1>
            <p style="margin:4px 0 0;color:#bbf7d0;font-size:13px;text-transform:uppercase;letter-spacing:1.5px;">Retailer Now Live</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px;">
            <h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;">${store.name} is now live!</h2>
            <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.6;">
              The retailer has completed all onboarding steps and is now accepting orders through Alcohol Delivered.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
              <tr><td style="padding:4px 0;color:#64748b;font-size:13px;width:120px;">Store</td><td style="padding:4px 0;color:#1e293b;font-size:14px;font-weight:600;">${store.name}</td></tr>
              <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Address</td><td style="padding:4px 0;color:#1e293b;font-size:14px;">${store.address || ''}, ${store.city || ''}, ${store.state || ''} ${store.zip_code || ''}</td></tr>
              <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">License #</td><td style="padding:4px 0;color:#1e293b;font-size:14px;">${store.license_number || ''}</td></tr>
              <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">County</td><td style="padding:4px 0;color:#1e293b;font-size:14px;">${store.county || ''}</td></tr>
              <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Status</td><td style="padding:4px 0;color:#16a34a;font-size:14px;font-weight:700;">LIVE ✅</td></tr>
              <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Previous</td><td style="padding:4px 0;color:#94a3b8;font-size:14px;">${prevStatus || 'invited'}</td></tr>
            </table>
            <p style="margin:0;color:#64748b;font-size:13px;">You can view the store in your <a href="https://alcohol-delivered.biz/admin/stores" style="color:#1e3a5f;font-weight:600;">Admin Dashboard</a>.</p>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;padding:20px 40px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="margin:0;color:#94a3b8;font-size:12px;">Alcohol Delivered · Automated Notification</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

    const raw = buildRawEmail(adminEmail, subject, html, 'Alcohol Delivered');

    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    });

    const result = await res.json();
    return Response.json({ success: res.ok, store: store.name, sentTo: adminEmail, messageId: result.id });
  } catch (error) {
    console.error('notifyRetailerOnboarded error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});