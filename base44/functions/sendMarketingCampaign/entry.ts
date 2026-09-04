import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { buildMimeMessage, getGmailSender, sendGmail } from '../../shared/emailUtils.ts';

function buildCampaignHtml({ recipientName, isDriverProspect }) {
  const greeting = recipientName ? `Hi ${recipientName},` : `Hi there,`;

  const customerBlock = `
    <div style="background:#f0f4ff;border-radius:12px;padding:24px;margin-bottom:20px;">
      <h2 style="color:#1e2a6e;margin:0 0 10px;font-size:18px;">🍷 Thirsty? We'll Deliver.</h2>
      <p style="color:#444;font-size:14px;line-height:1.6;margin:0 0 12px;">
        Get your favorite beer, wine, and spirits delivered to your door in under 45 minutes.
        Fully licensed, legal, and ID-verified — no trip to the store needed.
      </p>
      <ul style="color:#444;font-size:14px;line-height:1.8;margin:0 0 12px;padding-left:20px;">
        <li><strong>Free trial membership</strong> — no monthly fee for your first month</li>
        <li><strong>$4.75 delivery fee</strong> — no surge pricing, no surprises</li>
        <li><strong>Shop local stores</strong> — support Arkansas retailers</li>
      </ul>
      <a href="https://alcoholdelivered.com/stores" style="display:inline-block;background:#f59e0b;color:#fff;font-weight:700;font-size:14px;padding:12px 28px;border-radius:8px;text-decoration:none;margin-top:4px;">Browse &amp; Order Now →</a>
    </div>`;

  const driverBlock = `
    <div style="background:#f0fff4;border-radius:12px;padding:24px;margin-bottom:20px;">
      <h2 style="color:#16a34a;margin:0 0 10px;font-size:18px;">🚗 Earn Money Driving</h2>
      <p style="color:#444;font-size:14px;line-height:1.6;margin:0 0 12px;">
        Become an Alcohol Delivered by SipSwift driver and earn on your own schedule.
        We're actively recruiting across Pulaski, Jefferson, Arkansas, and Cleveland Counties
        — including Little Rock, North Little Rock, Sherwood, Maumelle, Pine Bluff, Stuttgart, and Rison.
      </p>
      <ul style="color:#444;font-size:14px;line-height:1.8;margin:0 0 12px;padding-left:20px;">
        <li><strong>$4.75 per delivery</strong> + 100% of your tips</li>
        <li><strong>$1/mile bonus</strong> for deliveries over 7 miles</li>
        <li><strong>Flexible hours</strong> — drive when you want</li>
        <li><strong>Free training</strong> — alcohol safety certification included</li>
      </ul>
      <a href="https://alcoholdelivered.com/driver/signup" style="display:inline-block;background:#16a34a;color:#fff;font-weight:700;font-size:14px;padding:12px 28px;border-radius:8px;text-decoration:none;margin-top:4px;">Apply to Drive →</a>
    </div>`;

  const referralBlock = `
    <div style="background:#fefce8;border-radius:12px;padding:20px;margin-bottom:20px;text-align:center;">
      <p style="color:#444;font-size:14px;margin:0 0 6px;"><strong>🎁 Refer a friend, earn rewards!</strong></p>
      <p style="color:#666;font-size:13px;margin:0;">Share your referral code from your profile page — earn credit when friends place their first order.</p>
    </div>`;

  return `
<!DOCTYPE html>
<html>
<body style="font-family:'DM Sans',Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#1e2a6e,#f59e0b);padding:32px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:24px;font-weight:800;letter-spacing:-0.5px;">Alcohol Delivered <span style="color:#fbbf24;">by SipSwift</span></h1>
      <p style="color:rgba(255,255,255,0.9);margin:6px 0 0;font-size:14px;">Alcohol delivered to your door — Arkansas proud</p>
    </div>
    <div style="padding:28px 32px;">
      <p style="color:#333;font-size:15px;line-height:1.6;margin:0 0 24px;">${greeting}</p>
      ${customerBlock}
      ${driverBlock}
      ${referralBlock}
      <p style="color:#666;font-size:13px;line-height:1.5;margin:0 0 8px;">
        Alcohol Delivered by SipSwift is Arkansas's fully licensed alcohol delivery service — compliant with all ABC regulations,
        ID-verified at checkout and delivery, and serving Jefferson County and surrounding areas.
      </p>
    </div>
    <div style="padding:16px 32px;background:#f8f8f8;text-align:center;font-size:12px;color:#aaa;">
      Alcohol Delivered by SipSwift · Pine Bluff, AR · You're receiving this because you signed up at alcoholdelivered.com
    </div>
  </div>
</body>
</html>`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Collect all recipient emails: registered users + early signups
    const [users, earlySignups] = await Promise.all([
      base44.asServiceRole.entities.User.list('-created_date', 200),
      base44.asServiceRole.entities.EarlySignup.list('-created_date', 200)
    ]);

    // Deduplicate emails, exclude admins
    const emailMap = new Map();
    users.forEach(u => {
      if (u.email && u.role !== 'admin' && !emailMap.has(u.email)) {
        emailMap.set(u.email, { name: u.full_name || '', email: u.email, source: 'user' });
      }
    });
    earlySignups.forEach(s => {
      if (s.email && !emailMap.has(s.email)) {
        emailMap.set(s.email, { name: s.full_name || '', email: s.email, source: 'signup', role: s.role });
      }
    });

    const recipients = Array.from(emailMap.values());
    if (recipients.length === 0) {
      return Response.json({ success: true, message: 'No recipients found', sent: 0 });
    }

    const { accessToken, senderEmail } = await getGmailSender(base44);

    const subject = '🍷 Your Alcohol Delivered by SipSwift delivery is just a tap away + Earn money driving';

    let sent = 0;
    let failed = 0;
    const errors = [];

    for (const recipient of recipients) {
      try {
        const htmlBody = buildCampaignHtml({
          recipientName: recipient.name,
          isDriverProspect: recipient.role === 'driver'
        });
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

    console.log(`Marketing campaign sent: ${sent} success, ${failed} failed out of ${recipients.length} recipients`);
    if (errors.length) console.log('Errors:', errors.join('; '));

    return Response.json({
      success: true,
      sent,
      failed,
      total: recipients.length,
      recipients: recipients.map(r => r.email)
    });
  } catch (error) {
    console.error('Marketing campaign error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});