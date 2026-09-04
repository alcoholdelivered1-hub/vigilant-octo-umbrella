import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { getGmailSender, sendGmail } from '../../shared/emailUtils.ts';

function buildSalesVolumeHtml({ storeName }) {
  return `
<!DOCTYPE html>
<html>
<body style="font-family:'DM Sans',Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#1e2a6e,#f59e0b);padding:32px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:24px;font-weight:800;letter-spacing:-0.5px;">Boost Your Sales Volume</h1>
      <p style="color:rgba(255,255,255,0.9);margin:6px 0 0;font-size:14px;">Reach customers who can't come to you</p>
    </div>
    <div style="padding:28px 32px;">
      <p style="color:#333;font-size:15px;line-height:1.6;margin:0 0 20px;">Dear ${storeName} Team,</p>

      <p style="color:#333;font-size:15px;line-height:1.6;margin:0 0 20px;">
        Every day, potential customers in your area <strong>can't walk into your store</strong> — not because they
        don't want your products, but because they physically can't get there. We're talking about:
      </p>

      <div style="background:#f0f4ff;border-radius:12px;padding:20px;margin-bottom:20px;">
        <ul style="color:#333;font-size:14px;line-height:2;margin:0;padding-left:20px;">
          <li><strong>Disabled &amp; mobility-impaired</strong> customers who use wheelchairs, walkers, or canes</li>
          <li><strong>Homebound seniors</strong> who no longer drive but still enjoy wine with dinner</li>
          <li><strong>Non-driving adults</strong> in areas with limited public transit</li>
          <li><strong>Recovering patients</strong> home from surgery or illness</li>
          <li><strong>Busy parents</strong> hosting events who can't leave the house</li>
        </ul>
      </div>

      <p style="color:#333;font-size:15px;line-height:1.6;margin:0 0 20px;">
        These are <strong>real customers with real money</strong> who want to buy from stores like yours —
        and right now, they have no way to reach you. <strong>Alcohol Delivered by SipSwift</strong> connects
        your store to these customers through our licensed, ID-verified delivery platform.
      </p>

      <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:12px;padding:20px;margin-bottom:20px;">
        <h3 style="color:#166534;margin:0 0 10px;font-size:16px;">What You Get</h3>
        <ul style="color:#333;font-size:14px;line-height:1.8;margin:0;padding-left:20px;">
          <li><strong>New revenue stream</strong> — orders you'd never capture otherwise</li>
          <li><strong>Zero upfront cost</strong> — standard listing is free, no monthly fees</li>
          <li><strong>We handle delivery</strong> — our licensed drivers bring orders to customers</li>
          <li><strong>You keep your margins</strong> — you set your prices, we add a small service fee</li>
          <li><strong>Sync your inventory</strong> — update prices via Google Sheet or POS integration</li>
        </ul>
      </div>

      <div style="background:#fefce8;border:1px solid #fde68a;border-radius:12px;padding:16px;margin-bottom:20px;">
        <p style="color:#92400e;font-size:14px;margin:0;">
          <strong>Don't leave money on the table.</strong> Your competitors will reach these customers first
          if you don't. Partner with us today and start capturing the sales you're currently missing.
        </p>
      </div>

      <div style="text-align:center;margin:28px 0;">
        <a href="https://alcoholdelivered.com/retailer-onboarding" style="display:inline-block;background:#f59e0b;color:#fff;font-weight:700;font-size:16px;padding:14px 36px;border-radius:10px;text-decoration:none;">Start Onboarding Now →</a>
      </div>

      <p style="color:#666;font-size:13px;line-height:1.5;margin:0 0 8px;">
        Already received an onboarding email? Just reply with your completed form and we'll get you live within 48 hours.
        Questions? Call us or reply to this email — we're here to help you grow.
      </p>
    </div>
    <div style="padding:16px 32px;background:#f8f8f8;text-align:center;font-size:12px;color:#aaa;">
      Alcohol Delivered by SipSwift · Pine Bluff, AR · Serving Pulaski, Jefferson, Arkansas &amp; Cleveland Counties
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

    const stores = await base44.asServiceRole.entities.Store.list('-created_date', 200);
    const storesWithEmails = stores.filter(s => s.email && s.is_active !== false);

    if (storesWithEmails.length === 0) {
      return Response.json({ success: true, message: 'No stores with emails found', sent: 0 });
    }

    const { accessToken, senderEmail } = await getGmailSender(base44);

    const subject = '📈 Boost Your Sales — Reach Customers Who Can’t Come to You';

    let sent = 0;
    let failed = 0;
    const results = [];

    for (const store of storesWithEmails) {
      try {
        const htmlBody = buildSalesVolumeHtml({ storeName: store.name });
        const gmailRes = await sendGmail(accessToken, store.email, senderEmail, subject, htmlBody);
        if (gmailRes.ok) {
          sent++;
          results.push({ store: store.name, email: store.email, status: 'sent' });
        } else {
          failed++;
          const errText = await gmailRes.text();
          results.push({ store: store.name, email: store.email, status: 'failed', error: errText.substring(0, 100) });
        }
      } catch (err) {
        failed++;
        results.push({ store: store.name, email: store.email, status: 'failed', error: err.message });
      }
    }

    console.log(`Sales volume email sent: ${sent} success, ${failed} failed out of ${storesWithEmails.length} stores`);
    return Response.json({ success: true, sent, failed, total: storesWithEmails.length, results });
  } catch (error) {
    console.error('Sales volume email error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});