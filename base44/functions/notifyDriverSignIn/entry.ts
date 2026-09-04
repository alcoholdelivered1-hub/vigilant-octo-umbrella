import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

function buildRawEmail(to, subject, html, fromName) {
  const fromHeader = `${fromName} <alcohol.delivered1@gmail.com>`;
  const message = [
    `From: ${fromHeader}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=UTF-8`,
    ``,
    html,
  ].join('\r\n');
  return btoa(unescape(encodeURIComponent(message)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // Entity automation payload: { event, data, old_data }
    const driver = body?.data;
    if (!driver) {
      return Response.json({ skipped: true, reason: 'No driver data in payload' });
    }

    const driverName = driver.name || 'Unknown Driver';
    const driverEmail = driver.email || 'N/A';
    const driverPhone = driver.phone || 'N/A';
    const signInTime = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' });

    const managerEmail = Deno.env.get('STORE_MANAGER_EMAIL') || 'jpbsandiego@yahoo.com';

    // 1. Send email alert to admin via Gmail (manager email may not be a registered app user)
    const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #f9fafb; border-radius: 12px;">
          <h2 style="color: #1e3a5f; margin-bottom: 4px;">Driver Signed In for Deliveries 🚗</h2>
          <p style="color: #6b7280; font-size: 14px; margin-bottom: 20px;">A driver just went <strong>available</strong> on Alcohol Delivered.</p>

          <div style="background: white; border-radius: 10px; padding: 16px; margin-bottom: 16px; border: 1px solid #e5e7eb;">
            <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
              <tr><td style="padding: 6px 0; color: #6b7280; width: 120px;">Driver</td><td style="padding: 6px 0; font-weight: 600;">${driverName}</td></tr>
              <tr><td style="padding: 6px 0; color: #6b7280;">Email</td><td style="padding: 6px 0;">${driverEmail}</td></tr>
              <tr><td style="padding: 6px 0; color: #6b7280;">Phone</td><td style="padding: 6px 0;">${driverPhone}</td></tr>
              <tr><td style="padding: 6px 0; color: #6b7280;">Signed In</td><td style="padding: 6px 0;">${signInTime} CT</td></tr>
              <tr><td style="padding: 6px 0; color: #6b7280;">Status</td><td style="padding: 6px 0;"><span style="background: #dcfce7; color: #166534; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 600;">Available</span></td></tr>
            </table>
          </div>

          <p style="font-size: 12px; color: #9ca3af;">This alert was sent automatically from Alcohol Delivered · Pine Bluff, AR</p>
        </div>`;
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
    const raw = buildRawEmail(managerEmail, `🚗 Driver Signed In: ${driverName} is now available`, htmlBody, 'Alcohol Delivered');
    const gmailRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw }),
    });
    if (!gmailRes.ok) {
      const errBody = await gmailRes.text();
      throw new Error(`Gmail API error: ${gmailRes.status} — ${errBody}`);
    }

    // 2. Send FCM push to admin devices
    try {
      const adminTokens = await base44.asServiceRole.entities.FCMToken.filter({ user_role: 'admin' });
      if (adminTokens.length > 0) {
        const tokens = adminTokens.map(t => t.token);
        await base44.asServiceRole.functions.invoke('sendFCMPush', {
          tokens,
          title: '🚗 Driver Signed In',
          body: `${driverName} is now available for deliveries`,
          data: { type: 'driver_signin', driver_id: driver.id || '' },
        });
      }
    } catch (pushErr) {
      console.log('FCM push skipped:', pushErr.message);
    }

    console.log(`Driver sign-in alert sent for: ${driverName}`);
    return Response.json({ success: true, driver: driverName });
  } catch (error) {
    console.error('Driver sign-in notification error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});