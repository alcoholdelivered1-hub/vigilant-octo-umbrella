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

function buildDashboardSetupHTML(store, hasProducts) {
  const inventorySection = hasProducts
    ? `<div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:16px 20px;margin-bottom:12px;">
         <p style="margin:0;color:#065f46;font-size:14px;font-weight:600;">✅ Your products are already loaded — you're ready to go!</p>
       </div>`
    : `<div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:10px;padding:16px 20px;margin-bottom:12px;">
         <p style="margin:0 0 8px;color:#92400e;font-size:14px;font-weight:600;">⏳ Action Needed: Add Your Products</p>
         <p style="margin:0;color:#78350f;font-size:13px;line-height:1.5;">Customers can see your store but can't place orders until you add inventory. Here's how:</p>
         <ol style="margin:10px 0 0;padding-left:20px;color:#78350f;font-size:13px;line-height:1.8;">
           <li>Register at <a href="https://alcohol-delivered.biz/register" style="color:#1e3a5f;font-weight:600;">alcohol-delivered.biz/register</a> using <strong>${store.email}</strong></li>
           <li>Log in and go to your <a href="https://alcohol-delivered.biz/store/dashboard" style="color:#1e3a5f;font-weight:600;">Store Dashboard</a></li>
           <li>Click the <strong>"Inventory"</strong> tab</li>
           <li>Click <strong>"Add Product"</strong> and enter name, category, price, and stock</li>
           <li>Repeat for each product you want to sell</li>
         </ol>
         <p style="margin:10px 0 0;color:#78350f;font-size:12px;">Tip: You can also send us your product list (CSV or spreadsheet) and we'll upload it for you.</p>
       </div>`;

  const features = [
    { icon: '📦', title: 'Manage Inventory', desc: 'Add/edit products, update prices, toggle stock' },
    { icon: '🛒', title: 'Confirm Orders', desc: 'Accept incoming orders and mark ready for pickup' },
    { icon: '🗺️', title: 'Live Delivery Map', desc: 'Track orders from pickup to delivery' },
    { icon: '💬', title: 'Chat', desc: 'Message drivers and customers in real time' },
    { icon: '📊', title: 'Revenue & Analytics', desc: 'Track your sales and performance' },
    { icon: '⚙️', title: 'Settings', desc: 'Update store hours, contact info, and more' },
  ];

  const featuresHTML = features.map(f => `
    <tr>
      <td style="padding:10px 0;color:#475569;font-size:14px;line-height:1.5;">
        <span style="font-size:18px;margin-right:8px;">${f.icon}</span>
        <strong style="color:#1e3a5f;">${f.title}</strong> — ${f.desc}
      </td>
    </tr>`).join('');

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
            <p style="margin:4px 0 0;color:#f59e0b;font-size:13px;text-transform:uppercase;letter-spacing:1.5px;">Your Store Dashboard is Ready</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;">Hello ${store.name}! 🎉</h2>
            <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
              Your store is live on <strong>Alcohol Delivered</strong>! Customers can already find you in our app. This email will help you complete your setup so you can start receiving orders right away.
            </p>

            ${inventorySection}

            <!-- Access Steps -->
            <h3 style="margin:0 0 12px;color:#1e3a5f;font-size:16px;">How to Access Your Dashboard</h3>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
              <tr><td style="padding:4px 0;color:#1e293b;font-size:14px;line-height:1.8;">
                <strong>Step 1:</strong> Register at <a href="https://alcohol-delivered.biz/register" style="color:#1e3a5f;font-weight:600;">alcohol-delivered.biz/register</a><br>
                <span style="color:#64748b;font-size:13px;">Use this email: <strong>${store.email}</strong></span>
              </td></tr>
              <tr><td style="padding:4px 0;color:#1e293b;font-size:14px;line-height:1.8;">
                <strong>Step 2:</strong> Log in and go to your dashboard:<br>
                <a href="https://alcohol-delivered.biz/store/dashboard" style="color:#1e3a5f;font-weight:600;">alcohol-delivered.biz/store/dashboard</a>
              </td></tr>
            </table>

            <!-- Dashboard Features -->
            <h3 style="margin:0 0 12px;color:#1e3a5f;font-size:16px;">What You Can Do From Your Dashboard</h3>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              ${featuresHTML}
            </table>

            <!-- Contact -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:10px;padding:16px 20px;margin-bottom:8px;">
              <tr><td style="color:#1e3a5f;font-size:14px;font-weight:600;padding-bottom:8px;">Questions? We're here to help.</td></tr>
              <tr><td style="color:#475569;font-size:13px;padding:2px 0;">✉️ <a href="mailto:alcohol.delivered1@gmail.com" style="color:#1e3a5f;text-decoration:none;">alcohol.delivered1@gmail.com</a></td></tr>
              <tr><td style="color:#475569;font-size:13px;padding:2px 0;">🌐 <a href="https://alcohol-delivered.biz" style="color:#1e3a5f;text-decoration:none;">alcohol-delivered.biz</a></td></tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#1e3a5f;padding:20px 40px;text-align:center;">
            <p style="margin:0;color:#94a3b8;font-size:11px;line-height:1.5;">
              Alcohol Delivered, LLC · Pine Bluff, AR · alcohol-delivered.biz<br>
              This email was sent to ${store.email} as part of our retailer onboarding program.<br>
              Operating under Arkansas ACT 157 with a valid ABC Third-Party Delivery Permit.
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
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    // Get all stores with email addresses
    const allStores = await base44.asServiceRole.entities.Store.list();
    const storesWithEmail = allStores.filter(s => s.email && s.email.includes('@'));

    // Get Gmail OAuth access token
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');

    const results = [];

    for (const store of storesWithEmail) {
      // Check if store has products
      const products = await base44.asServiceRole.entities.Product.filter({ store_id: store.id }, '', 5);
      const hasProducts = products.length > 0;

      const subject = hasProducts
        ? `🎉 ${store.name} — Your Store Dashboard is Ready!`
        : `⏳ ${store.name} — Action Needed: Add Your Products to Start Receiving Orders`;

      const htmlBody = buildDashboardSetupHTML(store, hasProducts);

      try {
        const raw = buildRawEmail(store.email, subject, htmlBody, 'Alcohol Delivered');

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

        console.log(`Dashboard setup email sent to ${store.name} <${store.email}> (hasProducts: ${hasProducts})`);
        results.push({ store: store.name, email: store.email, status: 'sent', has_products: hasProducts });
      } catch (err) {
        console.error(`Failed to send to ${store.name}: ${err.message}`);
        results.push({ store: store.name, email: store.email, status: 'failed', error: err.message });
      }
    }

    const sent = results.filter(r => r.status === 'sent').length;
    const failed = results.filter(r => r.status === 'failed').length;

    return Response.json({ success: true, sent, failed, total: results.length, results });
  } catch (error) {
    console.error('Dashboard setup email error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});