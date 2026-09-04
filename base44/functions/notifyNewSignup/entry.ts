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

    // Accept automation payload or admin call
    const isAutomation = body?.event?.type === 'create';
    const user = isAutomation ? null : await base44.auth.me();
    if (!isAutomation && user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const newUser = body?.data;
    const email = newUser?.email || 'Unknown';
    const name = newUser?.full_name || 'New User';
    const role = newUser?.role || 'user';
    const signupDate = newUser?.created_date
      ? new Date(newUser.created_date).toLocaleString('en-US', { timeZone: 'America/Chicago' })
      : new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' });

    const managerEmail = Deno.env.get('STORE_MANAGER_EMAIL') || 'jpbsandiego@yahoo.com';

    const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #f9fafb; border-radius: 12px;">
          <h2 style="color: #1e3a5f; margin-bottom: 4px;">New User Sign-Up 🍷</h2>
          <p style="color: #6b7280; font-size: 14px; margin-bottom: 20px;">Someone just created an account on <strong>Alcohol Delivered</strong>!</p>
          
          <div style="background: white; border-radius: 10px; padding: 16px; margin-bottom: 16px; border: 1px solid #e5e7eb;">
            <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
              <tr><td style="padding: 6px 0; color: #6b7280; width: 120px;">Name</td><td style="padding: 6px 0; font-weight: 600;">${name}</td></tr>
              <tr><td style="padding: 6px 0; color: #6b7280;">Email</td><td style="padding: 6px 0;">${email}</td></tr>
              <tr><td style="padding: 6px 0; color: #6b7280;">Role</td><td style="padding: 6px 0; text-transform: capitalize;">${role}</td></tr>
              <tr><td style="padding: 6px 0; color: #6b7280;">Signed Up</td><td style="padding: 6px 0;">${signupDate} CT</td></tr>
            </table>
          </div>

          <p style="font-size: 12px; color: #9ca3af;">This alert was sent automatically from Alcohol Delivered · Pine Bluff, AR</p>
        </div>`;

    // Use Gmail to send — platform SendEmail only reaches registered app users
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
    const raw = buildRawEmail(managerEmail, `🎉 New Sign-Up: ${name} just joined Alcohol Delivered!`, htmlBody, 'Alcohol Delivered');

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

    console.log(`Sign-up alert sent for: ${email}`);
    return Response.json({ success: true });
  } catch (error) {
    console.error('Sign-up notification error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});