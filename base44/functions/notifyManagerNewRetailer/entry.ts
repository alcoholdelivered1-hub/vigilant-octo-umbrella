import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { getGmailSender, sendGmail } from '../../shared/emailUtils.ts';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const payload = await req.json();

  const store = payload.data;
  if (!store) {
    return Response.json({ skipped: true, reason: 'No store data in payload' });
  }

  const secretEmail = Deno.env.get('STORE_MANAGER_EMAIL')?.trim();
  const managerEmail = (secretEmail && secretEmail.includes('@')) ? secretEmail : 'madhouserecords@yahoo.com';

  const subject = `🏪 New Retailer Onboarded — ${store.name}`;
  const htmlBody = `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
  <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5494 100%); border-radius: 12px; padding: 20px 24px; margin-bottom: 24px;">
    <h2 style="color: white; margin: 0 0 4px; font-size: 20px;">🏪 New Retailer Onboarded</h2>
    <p style="color: #93c5fd; margin: 0; font-size: 13px;">A new store has been added to Alcohol Delivered</p>
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
      <td style="padding: 10px 0; color: #6b7280;">Address</td>
      <td style="padding: 10px 0;">${store.address || ''}, ${store.city || ''}, ${store.county || ''} County</td>
    </tr>
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 10px 0; color: #6b7280;">Phone</td>
      <td style="padding: 10px 0;">${store.phone || 'Not provided'}</td>
    </tr>
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 10px 0; color: #6b7280;">Contact Email</td>
      <td style="padding: 10px 0;">${store.email || 'Not provided'}</td>
    </tr>
    <tr>
      <td style="padding: 10px 0; color: #6b7280;">Placement Tier</td>
      <td style="padding: 10px 0;">${store.placement_tier || 'standard'}</td>
    </tr>
  </table>

  <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 10px; padding: 14px 18px; margin-top: 24px; font-size: 13px; color: #166534;">
    An onboarding email has been automatically sent to the retailer. Review their profile in the Admin Dashboard to complete setup.
  </div>

  <p style="font-size: 12px; color: #9ca3af; margin-top: 24px;">
    Alcohol Delivered · Pine Bluff, AR · Admin Alert
  </p>
</div>`.trim();

  const { accessToken, senderEmail } = await getGmailSender(base44);
  const sendRes = await sendGmail(accessToken, managerEmail, senderEmail, subject, htmlBody);

  if (!sendRes.ok) {
    const errText = await sendRes.text();
    console.error('Gmail send failed:', errText);
    return Response.json({ error: `Gmail send failed: ${errText}` }, { status: 500 });
  }

  console.log(`New retailer alert sent to ${managerEmail} for store: ${store.name}`);
  return Response.json({ success: true, store_name: store.name, notified: managerEmail });
});