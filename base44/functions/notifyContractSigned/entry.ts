import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { assertAdmin } from '../../shared/authGuard.ts';

function buildRawEmail(to, subject, htmlBody, senderEmail) {
  const message = [
    `From: Alcohol Delivered — Admin Alerts <${senderEmail}>`,
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
    const { authorized, response } = await assertAdmin(base44);
    if (!authorized) return response;
    const payload = await req.json();

    const store = payload.data;
    const oldStore = payload.old_data;
    if (!store) {
      return Response.json({ skipped: true, reason: 'No store data in payload' });
    }

    // Only fire when onboarding_status just became "contract_signed"
    const becameSigned = store.onboarding_status === 'contract_signed'
      && oldStore?.onboarding_status !== 'contract_signed';
    if (!becameSigned) {
      return Response.json({ skipped: true, reason: 'Status did not change to contract_signed' });
    }

    const managerEmail = (Deno.env.get('STORE_MANAGER_EMAIL') || '').trim().replace(/^["']|["']$/g, '');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(managerEmail)) {
      console.error('Invalid STORE_MANAGER_EMAIL:', JSON.stringify(Deno.env.get('STORE_MANAGER_EMAIL')));
      return Response.json({ error: 'STORE_MANAGER_EMAIL is missing or invalid — set a valid email address in app secrets' }, { status: 500 });
    }

    const subject = `✅ Contract Signed — ${store.name}`;
    const htmlBody = `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
  <div style="background: linear-gradient(135deg, #166534 0%, #16a34a 100%); border-radius: 12px; padding: 20px 24px; margin-bottom: 24px;">
    <h2 style="color: white; margin: 0 0 4px; font-size: 20px;">✅ Contract Signed</h2>
    <p style="color: #bbf7d0; margin: 0; font-size: 13px;">A retailer has completed their partner agreement</p>
  </div>

  <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 10px 0; color: #6b7280; width: 35%;">Store Name</td>
      <td style="padding: 10px 0; font-weight: 600;">${store.name}</td>
    </tr>
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 10px 0; color: #6b7280;">ABC License #</td>
      <td style="padding: 10px 0;">${store.license_number || 'Not provided'}</td>
    </tr>
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 10px 0; color: #6b7280;">Contact Email</td>
      <td style="padding: 10px 0;">${store.email || 'Not provided'}</td>
    </tr>
    <tr>
      <td style="padding: 10px 0; color: #6b7280;">Phone</td>
      <td style="padding: 10px 0;">${store.phone || 'Not provided'}</td>
    </tr>
  </table>

  <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 10px; padding: 14px 18px; margin-top: 24px; font-size: 13px; color: #166534;">
    Next step: help this retailer add their inventory so they can go live. Open the Retailer Onboarding board to advance them.
  </div>

  <p style="font-size: 12px; color: #9ca3af; margin-top: 24px;">
    Alcohol Delivered · Pine Bluff, AR · Admin Alert
  </p>
</div>`.trim();

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
    const profileRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const { emailAddress } = await profileRes.json();

    const raw = buildRawEmail(managerEmail, subject, htmlBody, emailAddress);
    const sendRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw }),
    });

    if (!sendRes.ok) {
      const errText = await sendRes.text();
      console.error('Gmail send failed:', errText);
      return Response.json({ error: `Gmail send failed: ${errText}` }, { status: 500 });
    }

    console.log(`Contract-signed alert sent to ${managerEmail} for store: ${store.name}`);
    return Response.json({ success: true, store_name: store.name, notified: managerEmail });
  } catch (error) {
    console.error('Contract signed notify error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});