/**
 * Sends an email alert to the admin when a new driver applies.
 * Triggered by a workflow on Driver entity creation.
 *
 * Accepts automation payload: { event: { type: 'create' }, data: { ...driverFields } }
 * or a direct admin call with { driver_name, email, phone, ... } in the body.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getGmailSender, sendGmail } from '../../shared/emailUtils.ts';

function buildAlertHTML(driver) {
  const name = driver.name || 'Unknown';
  const email = driver.email || 'N/A';
  const phone = driver.phone || 'N/A';
  const dob = driver.date_of_birth || 'N/A';
  const license = driver.license_number || 'N/A';
  const vehicle = driver.vehicle_info || 'N/A';
  const trainingDate = driver.training_completed_date || 'N/A';
  const submittedAt = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' });

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'DM Sans',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

        <tr>
          <td style="background:linear-gradient(135deg,#1e3a5f,#2d4a7a);padding:28px 40px;text-align:center;">
            <p style="margin:0 0 4px;color:#fbbf24;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:2px;">🚗 New Driver Application</p>
            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:800;">${name} Just Applied!</h1>
          </td>
        </tr>

        <tr>
          <td style="padding:32px 40px;">
            <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.6;">
              A new driver has submitted their application and completed ABC training. Review their details below and activate them from the admin dashboard when ready.
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:20px;">
              <tr><td style="padding:4px 0;color:#64748b;font-size:13px;width:140px;">Name</td><td style="padding:4px 0;color:#1e293b;font-size:14px;font-weight:600;">${name}</td></tr>
              <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Email</td><td style="padding:4px 0;color:#1e293b;font-size:14px;">${email}</td></tr>
              <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Phone</td><td style="padding:4px 0;color:#1e293b;font-size:14px;">${phone}</td></tr>
              <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Date of Birth</td><td style="padding:4px 0;color:#1e293b;font-size:14px;">${dob}</td></tr>
              <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">License #</td><td style="padding:4px 0;color:#1e293b;font-size:14px;">${license}</td></tr>
              <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Vehicle</td><td style="padding:4px 0;color:#1e293b;font-size:14px;">${vehicle}</td></tr>
              <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">ABC Training</td><td style="padding:4px 0;color:#16a34a;font-size:14px;font-weight:600;">✅ Completed (${trainingDate})</td></tr>
              <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Submitted</td><td style="padding:4px 0;color:#1e293b;font-size:14px;">${submittedAt} CT</td></tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
              <tr>
                <td style="background:#f59e0b;border-radius:10px;padding:18px;text-align:center;">
                  <a href="https://alcohol-delivered.biz/admin/drivers" style="display:inline-block;background:#1e3a5f;color:#ffffff;padding:14px 36px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:700;">Review & Activate Driver →</a>
                </td>
              </tr>
            </table>

            <p style="margin:0;color:#64748b;font-size:12px;line-height:1.5;text-align:center;">
              This alert was sent automatically when the driver submitted their application.
            </p>
          </td>
        </tr>

        <tr>
          <td style="background:#1e3a5f;padding:16px 40px;text-align:center;">
            <p style="margin:0;color:#94a3b8;font-size:11px;">Alcohol Delivered, LLC · Pine Bluff, AR</p>
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
    const body = await req.json().catch(() => ({}));

    // Accept automation payload { event: { type: 'create' }, data: {...} }
    // or direct call { name, email, phone, ... }
    const isAutomation = body?.event?.type === 'create';
    const driver = isAutomation ? body.data : body;

    if (!driver || !driver.email) {
      return Response.json({ error: 'Driver data missing' }, { status: 400 });
    }

    const secretEmail = (Deno.env.get('STORE_MANAGER_EMAIL') || '').trim();
    const isValidEmail = (e) => /^\S+@\S+\.\S+$/.test(e);
    const managerEmail = isValidEmail(secretEmail) ? secretEmail : 'jpbsandiego@yahoo.com';
    const subject = `🚗 New Driver Application: ${driver.name || 'Unknown'}`;

    const htmlBody = buildAlertHTML(driver);

    const { accessToken, senderEmail } = await getGmailSender(base44);
    const res = await sendGmail(accessToken, managerEmail, senderEmail, subject, htmlBody);

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Gmail API error: ${res.status} — ${errBody}`);
    }

    console.log(`Driver signup alert sent for: ${driver.email}`);
    return Response.json({ success: true, sent_to: managerEmail });
  } catch (error) {
    console.error('notifyNewDriverSignup error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});