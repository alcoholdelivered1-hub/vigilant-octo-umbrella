/**
 * Sends a welcome email with driving perks to a newly-registered driver.
 * Called after a driver submits their application.
 *
 * POST body: { driver_name: string, email: string }
 * Any authenticated user can call (used by the driver themselves after signup).
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

function buildWelcomeHTML(driverName) {
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
            <p style="margin:4px 0 0;color:#f59e0b;font-size:13px;text-transform:uppercase;letter-spacing:1.5px;">🚗 Welcome to the Driver Team!</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;">Hey ${driverName}! 🎉</h2>
            <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
              Thank you for applying to drive with <strong>Alcohol Delivered</strong> — Arkansas's first licensed alcohol delivery platform. Your application has been received and our team is reviewing your documents and training results now. You'll be activated within 1–2 business days.
            </p>

            <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.6;">
              While you wait, here's a reminder of everything you get as a driver on our platform:
            </p>

            <!-- Perks Grid -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td width="50%" style="padding:0 8px 8px 0;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;">
                    <tr><td>
                      <p style="margin:0 0 4px;font-size:24px;">💰</p>
                      <p style="margin:0;color:#1e3a5f;font-size:14px;font-weight:700;">Keep 100% of Tips</p>
                      <p style="margin:2px 0 0;color:#64748b;font-size:12px;">Every tip is yours — we never take a cut.</p>
                    </td></tr>
                  </table>
                </td>
                <td width="50%" style="padding:0 0 8px 8px;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;">
                    <tr><td>
                      <p style="margin:0 0 4px;font-size:24px;">🛣️</p>
                      <p style="margin:0;color:#1e3a5f;font-size:14px;font-weight:700;">$1/Mile Bonus</p>
                      <p style="margin:2px 0 0;color:#64748b;font-size:12px;">Extra $1 per mile on deliveries over 7 miles.</p>
                    </td></tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td width="50%" style="padding:0 8px 8px 0;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;">
                    <tr><td>
                      <p style="margin:0 0 4px;font-size:24px;">📅</p>
                      <p style="margin:0;color:#1e3a5f;font-size:14px;font-weight:700;">Set Your Own Hours</p>
                      <p style="margin:2px 0 0;color:#64748b;font-size:12px;">Drive whenever you want — no schedules.</p>
                    </td></tr>
                  </table>
                </td>
                <td width="50%" style="padding:0 0 8px 8px;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;">
                    <tr><td>
                      <p style="margin:0 0 4px;font-size:24px;">🎓</p>
                      <p style="margin:0;color:#1e3a5f;font-size:14px;font-weight:700;">Free ABC Certification</p>
                      <p style="margin:2px 0 0;color:#64748b;font-size:12px;">Career-building credential, at no cost.</p>
                    </td></tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td width="50%" style="padding:0 8px 0 0;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;">
                    <tr><td>
                      <p style="margin:0 0 4px;font-size:24px;">⚡</p>
                      <p style="margin:0;color:#1e3a5f;font-size:14px;font-weight:700;">Priority Dispatch</p>
                      <p style="margin:2px 0 0;color:#64748b;font-size:12px;">Top-rated drivers get first picks.</p>
                    </td></tr>
                  </table>
                </td>
                <td width="50%" style="padding:0 0 0 8px;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;">
                    <tr><td>
                      <p style="margin:0 0 4px;font-size:24px;">💸</p>
                      <p style="margin:0;color:#1e3a5f;font-size:14px;font-weight:700;">Weekly Payouts</p>
                      <p style="margin:2px 0 0;color:#64748b;font-size:12px;">Fast Stripe transfers every Monday.</p>
                    </td></tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Earnings Highlight -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#1e3a5f,#2d4a7a);border-radius:12px;padding:20px;margin-bottom:24px;">
              <tr><td style="text-align:center;">
                <p style="margin:0 0 4px;color:#f59e0b;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Your Earnings</p>
                <p style="margin:0;color:#ffffff;font-size:15px;line-height:1.7;">
                  <strong style="font-size:18px;">$4.75</strong> per delivery base &nbsp;·&nbsp;
                  <strong style="font-size:18px;">100%</strong> of tips &nbsp;·&nbsp;
                  <strong style="font-size:18px;">+$1</strong>/mile over 7 miles
                </p>
              </td></tr>
            </table>

            <!-- What's Next -->
            <h3 style="margin:0 0 12px;color:#1e3a5f;font-size:16px;">What Happens Next?</h3>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 20px;margin-bottom:8px;">
                  <p style="margin:0;color:#1e293b;font-size:14px;line-height:1.6;"><strong style="color:#1e3a5f;">1. We review your docs</strong><br>
                  <span style="color:#64748b;font-size:13px;">Background check and document verification — usually 1–2 business days.</span></p>
                </td>
              </tr>
              <tr><td style="height:8px;"></td></tr>
              <tr>
                <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 20px;margin-bottom:8px;">
                  <p style="margin:0;color:#1e293b;font-size:14px;line-height:1.6;"><strong style="color:#1e3a5f;">2. You get activated</strong><br>
                  <span style="color:#64748b;font-size:13px;">You'll receive an email when your account is approved and ready to go.</span></p>
                </td>
              </tr>
              <tr><td style="height:8px;"></td></tr>
              <tr>
                <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 20px;">
                  <p style="margin:0;color:#1e293b;font-size:14px;line-height:1.6;"><strong style="color:#1e3a5f;">3. Start delivering</strong><br>
                  <span style="color:#64748b;font-size:13px;">Flip your availability on in the Driver Portal and start accepting orders!</span></p>
                </td>
              </tr>
            </table>

            <!-- CTA -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td style="background:#f59e0b;border-radius:10px;padding:20px;text-align:center;">
                  <a href="https://alcohol-delivered.biz/driver" style="display:inline-block;background:#1e3a5f;color:#ffffff;padding:14px 36px;border-radius:8px;text-decoration:none;font-size:16px;font-weight:700;">Go to Driver Portal →</a>
                </td>
              </tr>
            </table>

            <!-- Contact -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:10px;padding:16px 20px;">
              <tr><td style="color:#1e3a5f;font-size:14px;font-weight:600;padding-bottom:8px;">Questions? We're here to help.</td></tr>
              <tr><td style="color:#475569;font-size:13px;padding:2px 0;">✉️ <a href="mailto:alcohol.delivered1@gmail.com" style="color:#1e3a5f;text-decoration:none;">alcohol.delivered1@gmail.com</a></td></tr>
              <tr><td style="color:#475569;font-size:13px;padding:2px 0;">📍 Serving Pine Bluff, Little Rock, Sherwood, Cabot, Maumelle & surrounding areas</td></tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#1e3a5f;padding:20px 40px;text-align:center;">
            <p style="margin:0;color:#94a3b8;font-size:11px;line-height:1.5;">
              Alcohol Delivered, LLC · Pine Bluff, AR · alcohol-delivered.biz<br>
              Operating under Arkansas ACT 157 with a valid ABC Third-Party Delivery Permit.<br>
              You must be 21+ with a clean background to deliver alcohol.
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

    const user = await base44.auth.me().catch(() => null);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { driver_name, email } = await req.json();
    if (!driver_name || !email) {
      return Response.json({ error: 'driver_name and email are required' }, { status: 400 });
    }

    const subject = `🚗 Welcome to Alcohol Delivered, ${driver_name}! Here's What You'll Earn`;
    const htmlBody = buildWelcomeHTML(driver_name);

    // Get Gmail OAuth access token
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');

    const raw = buildRawEmail(email, subject, htmlBody, 'Alcohol Delivered');

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

    console.log(`Driver welcome email sent to ${driver_name} <${email}>`);
    return Response.json({ success: true, sent_to: email });
  } catch (error) {
    console.error('sendDriverWelcomeEmail error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});