/**
 * Sends a targeted driver recruitment email blast to all contacts
 * (registered users + early signups). Highlights the new $4.75/delivery
 * pay and the Beverage King partnership launch.
 *
 * Triggered manually from the admin dashboard.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getGmailSender, sendGmail } from '../../shared/emailUtils.ts';

function buildRecruitmentHTML(recipientName) {
  const greeting = recipientName ? `Hey ${recipientName},` : `Hey there,`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'DM Sans',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1e3a5f,#2d4a7a);padding:36px 40px;text-align:center;">
            <p style="margin:0 0 8px;color:#fbbf24;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:2px;">🚨 Now Hiring — $4.75/Delivery</p>
            <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:800;letter-spacing:-0.5px;line-height:1.2;">We Need Drivers.<br>Beverage King Just Went Live.</h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 40px;">
            <p style="margin:0 0 20px;color:#1e293b;font-size:15px;line-height:1.6;">${greeting}</p>
            <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
              We just launched our partnership with <strong>Beverage King</strong> — one of Central Arkansas's largest beverage retailers —
              and orders are rolling in <strong>today</strong>. We need licensed, reliable drivers across
              <strong>Pine Bluff, Little Rock, Sherwood, Cabot, Maumelle, and surrounding areas</strong> to keep up with demand.
            </p>

            <!-- Pay Highlight -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#f59e0b,#fbbf24);border-radius:12px;padding:24px;margin-bottom:24px;">
              <tr><td style="text-align:center;">
                <p style="margin:0 0 4px;color:#ffffff;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;">Your Earnings</p>
                <p style="margin:0;color:#ffffff;font-size:16px;line-height:1.8;">
                  <strong style="font-size:22px;">$4.75</strong> per delivery &nbsp;·&nbsp;
                  <strong style="font-size:22px;">100%</strong> of tips &nbsp;·&nbsp;
                  <strong style="font-size:22px;">+$1</strong>/mile over 7 mi
                </p>
                <p style="margin:8px 0 0;color:rgba(255,255,255,0.9);font-size:13px;">Weekly Stripe payouts every Monday · No startup fees</p>
              </td></tr>
            </table>

            <!-- What You Get -->
            <h3 style="margin:0 0 12px;color:#1e3a5f;font-size:16px;">What You Get as a Driver</h3>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr><td style="padding:0 0 8px 0;">
                <p style="margin:0;color:#1e293b;font-size:14px;line-height:1.6;">✅ <strong>$4.75 base pay</strong> per delivery — just increased!</p>
              </td></tr>
              <tr><td style="padding:0 0 8px 0;">
                <p style="margin:0;color:#1e293b;font-size:14px;line-height:1.6;">✅ <strong>Keep 100% of your tips</strong> — we never take a cut</p>
              </td></tr>
              <tr><td style="padding:0 0 8px 0;">
                <p style="margin:0;color:#1e293b;font-size:14px;line-height:1.6;">✅ <strong>$1/mile bonus</strong> on deliveries over 7 miles</p>
              </td></tr>
              <tr><td style="padding:0 0 8px 0;">
                <p style="margin:0;color:#1e293b;font-size:14px;line-height:1.6;">✅ <strong>Set your own hours</strong> — drive whenever you want</p>
              </td></tr>
              <tr><td style="padding:0 0 8px 0;">
                <p style="margin:0;color:#1e293b;font-size:14px;line-height:1.6;">✅ <strong>Free ABC certification</strong> — career-building credential</p>
              </td></tr>
              <tr><td style="padding:0 0 0 0;">
                <p style="margin:0;color:#1e293b;font-size:14px;line-height:1.6;">✅ <strong>Weekly payouts</strong> via Stripe — no waiting weeks</p>
              </td></tr>
            </table>

            <!-- Requirements -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:24px;">
              <tr><td>
                <h3 style="margin:0 0 10px;color:#1e3a5f;font-size:15px;">📋 Do You Qualify? Check This List:</h3>
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr><td style="padding:3px 0;color:#475569;font-size:13px;">☑ Age 21 or older</td></tr>
                  <tr><td style="padding:3px 0;color:#475569;font-size:13px;">☑ Valid driver's license (clean record, no recent DUIs)</td></tr>
                  <tr><td style="padding:3px 0;color:#475569;font-size:13px;">☑ Reliable vehicle in safe working condition</td></tr>
                  <tr><td style="padding:3px 0;color:#475569;font-size:13px;">☑ Current auto insurance</td></tr>
                  <tr><td style="padding:3px 0;color:#475569;font-size:13px;">☑ Clean background (no felonies — required by AR ACT 157)</td></tr>
                  <tr><td style="padding:3px 0;color:#475569;font-size:13px;">☑ Smartphone (iPhone or Android)</td></tr>
                </table>
                <p style="margin:12px 0 0;color:#64748b;font-size:12px;line-height:1.5;">
                  If you checked all six boxes, you're pre-qualified! The application takes about 10 minutes.
                </p>
              </td></tr>
            </table>

            <!-- CTA -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td style="background:#1e3a5f;border-radius:12px;padding:24px;text-align:center;">
                  <a href="https://alcohol-delivered.biz/driver/signup" style="display:inline-block;background:#f59e0b;color:#ffffff;padding:16px 40px;border-radius:8px;text-decoration:none;font-size:17px;font-weight:800;">🚗 Apply to Drive Now →</a>
                  <p style="margin:10px 0 0;color:rgba(255,255,255,0.8);font-size:12px;">Application takes ~10 min · Free ABC training included · Activated in 1–2 days</p>
                </td>
              </tr>
            </table>

            <!-- Urgency -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef3c7;border:1px solid #fbbf24;border-radius:10px;padding:16px 20px;margin-bottom:20px;">
              <tr><td style="color:#92400e;font-size:13px;line-height:1.6;text-align:center;">
                ⚡ <strong>We're hiring all qualified drivers — no cap on positions.</strong> Orders are surging with Beverage King live. Apply now to get activated and start earning this week!
              </td></tr>
            </table>

            <p style="margin:0;color:#64748b;font-size:12px;line-height:1.5;text-align:center;">
              Know someone who'd be a great driver? Forward this email to them!<br>
              Questions? Reply to this email or visit <a href="https://alcohol-delivered.biz/drive" style="color:#1e3a5f;">alcohol-delivered.biz/drive</a>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#1e3a5f;padding:20px 40px;text-align:center;">
            <p style="margin:0;color:#94a3b8;font-size:11px;line-height:1.5;">
              Alcohol Delivered, LLC · Pine Bluff, AR · alcohol-delivered.biz<br>
              Operating under Arkansas ACT 157 with a valid ABC Third-Party Delivery Permit.<br>
              You're receiving this because you signed up at alcohol-delivered.biz
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
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });

    // Collect all recipient emails: registered users + early signups
    const [users, earlySignups] = await Promise.all([
      base44.asServiceRole.entities.User.list('-created_date', 500),
      base44.asServiceRole.entities.EarlySignup.list('-created_date', 500)
    ]);

    // Deduplicate emails, exclude admins
    const emailMap = new Map();
    users.forEach(u => {
      if (u.email && u.role !== 'admin' && !emailMap.has(u.email)) {
        emailMap.set(u.email, { name: u.full_name || '', email: u.email });
      }
    });
    earlySignups.forEach(s => {
      if (s.email && !emailMap.has(s.email)) {
        emailMap.set(s.email, { name: s.full_name || '', email: s.email });
      }
    });

    // Validate email format — filter out typos that would bounce
    const validEmail = (email) => {
      if (!email || typeof email !== 'string') return false;
      const trimmed = email.trim().toLowerCase();
      const valid = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(trimmed);
      if (!valid) return false;
      const tld = trimmed.split('.').pop();
      const badTlds = ['con', 'cim', 'cm', 'co', 'ent', 'ner', 'ne'];
      if (badTlds.includes(tld) && !trimmed.endsWith('.com')) return false;
      return true;
    };

    const allRecipients = Array.from(emailMap.values());
    const recipients = allRecipients.filter(r => validEmail(r.email));
    const skipped = allRecipients.filter(r => !validEmail(r.email)).map(r => r.email);

    if (recipients.length === 0) {
      return Response.json({ success: true, message: 'No valid recipients found', sent: 0, skipped });
    }

    const { accessToken, senderEmail } = await getGmailSender(base44);

    const subject = '🚨 We\'re Hiring Drivers — $4.75/Delivery + Beverage King Just Went Live!';

    let sent = 0;
    let failed = 0;
    const errors = [];

    for (const recipient of recipients) {
      try {
        const htmlBody = buildRecruitmentHTML(recipient.name);
        const gmailRes = await sendGmail(accessToken, recipient.email, senderEmail, subject, htmlBody);
        if (gmailRes.ok) {
          sent++;
        } else {
          failed++;
          const errText = await gmailRes.text();
          errors.push(`${recipient.email}: ${errText.substring(0, 100)}`);
        }
      } catch (err) {
        failed++;
        errors.push(`${recipient.email}: ${err.message}`);
      }
    }

    console.log(`Driver recruitment blast: ${sent} success, ${failed} failed, ${skipped.length} skipped (invalid) out of ${allRecipients.length} total`);
    if (errors.length) console.log('Errors:', errors.join('; '));
    if (skipped.length) console.log('Skipped invalid emails:', skipped.join(', '));

    return Response.json({
      success: true,
      sent,
      failed,
      skipped,
      total: allRecipients.length,
      recipients: recipients.map(r => r.email)
    });
  } catch (error) {
    console.error('sendDriverRecruitmentBlast error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});