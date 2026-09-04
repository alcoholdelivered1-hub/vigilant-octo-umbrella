import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

function toBase64Url(str) {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function encodeSubject(subject) {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(subject);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return `=?UTF-8?B?${btoa(binary)}?=`;
}

function buildMimeMessage({ to, from, subject, htmlBody }) {
  const mime = [
    `From: Alcohol Delivered <${from}>`,
    `To: ${to}`,
    `Subject: ${encodeSubject(subject)}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: quoted-printable`,
    ``,
    htmlBody,
  ].join('\r\n');
  return toBase64Url(mime);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Fetch last 7 days metrics
    const orders = await base44.asServiceRole.entities.Order.list('-created_date', 200);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const weekOrders = orders.filter(o => new Date(o.created_date) >= weekAgo);
    const delivered = weekOrders.filter(o => o.status === 'delivered');
    const totalRevenue = delivered.reduce((s, o) => s + (o.total || 0), 0);
    const refused = weekOrders.filter(o => o.status === 'refused').length;

    // Top products this week
    const productCounts = {};
    delivered.forEach(o => (o.items || []).forEach(item => {
      productCounts[item.product_name] = (productCounts[item.product_name] || 0) + item.quantity;
    }));
    const topProducts = Object.entries(productCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const topProductsHtml = topProducts.length
      ? topProducts.map(([name, qty], i) =>
          `<tr>
            <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;">${i + 1}. ${name}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600;">${qty} sold</td>
          </tr>`
        ).join('')
      : `<tr><td colspan="2" style="padding:12px;text-align:center;color:#aaa;">No data yet</td></tr>`;

    const weekLabel = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    const htmlBody = `
<!DOCTYPE html>
<html>
<body style="font-family:'DM Sans',Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#1e2a6e,#f59e0b);padding:28px 32px;">
      <h1 style="color:#fff;margin:0;font-size:24px;">📊 Weekly Performance Report</h1>
      <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:14px;">Week ending ${weekLabel}</p>
    </div>
    <div style="padding:28px 32px;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:28px;">
        <div style="background:#f0f4ff;border-radius:10px;padding:18px;text-align:center;">
          <div style="font-size:28px;font-weight:700;color:#1e2a6e;">${weekOrders.length}</div>
          <div style="font-size:12px;color:#666;margin-top:4px;">Total Orders</div>
        </div>
        <div style="background:#f0fff4;border-radius:10px;padding:18px;text-align:center;">
          <div style="font-size:28px;font-weight:700;color:#16a34a;">$${totalRevenue.toFixed(2)}</div>
          <div style="font-size:12px;color:#666;margin-top:4px;">Revenue Delivered</div>
        </div>
        <div style="background:#fefce8;border-radius:10px;padding:18px;text-align:center;">
          <div style="font-size:28px;font-weight:700;color:#ca8a04;">${delivered.length}</div>
          <div style="font-size:12px;color:#666;margin-top:4px;">Successful Deliveries</div>
        </div>
        <div style="background:#fff1f2;border-radius:10px;padding:18px;text-align:center;">
          <div style="font-size:28px;font-weight:700;color:#dc2626;">${refused}</div>
          <div style="font-size:12px;color:#666;margin-top:4px;">Refused Deliveries</div>
        </div>
      </div>

      <h3 style="font-size:15px;margin:0 0 12px;color:#333;">🏆 Top Products This Week</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px;">
        <tbody>${topProductsHtml}</tbody>
      </table>

      <div style="background:#f0f4ff;border-radius:10px;padding:20px;text-align:center;">
        <p style="margin:0 0 12px;font-size:14px;color:#444;">Keep the momentum going! Share with your customers:</p>
        <div style="font-size:22px;font-weight:700;color:#1e2a6e;letter-spacing:1px;">alcoholdelivered.com</div>
        <p style="margin:10px 0 0;font-size:12px;color:#888;">Fast, legal alcohol delivery in Jefferson County, AR</p>
      </div>
    </div>
    <div style="padding:16px 32px;background:#f8f8f8;text-align:center;font-size:12px;color:#aaa;">
      Alcohol Delivered · Pine Bluff, AR · Unsubscribe anytime
    </div>
  </div>
</body>
</html>`;

    const storeManagerEmail = (Deno.env.get('STORE_MANAGER_EMAIL') || '').trim();
    if (!storeManagerEmail) {
      return Response.json({ error: 'STORE_MANAGER_EMAIL not set' }, { status: 500 });
    }
    if (!storeManagerEmail.includes('@')) {
      return Response.json({ error: `STORE_MANAGER_EMAIL is not a valid email: "${storeManagerEmail}"` }, { status: 500 });
    }

    const subjectLine = `Weekly Alcohol Delivered Report - ${weekOrders.length} orders, $${totalRevenue.toFixed(2)} revenue`;

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');

    const profileRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const profile = await profileRes.json();
    const senderEmail = profile.emailAddress;
    if (!senderEmail) throw new Error('Could not resolve Gmail sender address');

    const raw = buildMimeMessage({ to: storeManagerEmail, from: senderEmail, subject: subjectLine, htmlBody });
    const gmailRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw }),
    });

    if (!gmailRes.ok) {
      const errText = await gmailRes.text();
      throw new Error(`Gmail send failed: ${errText}`);
    }

    console.log(`Weekly marketing email sent to ${storeManagerEmail}`);
    return Response.json({ success: true, message: 'Weekly marketing email sent' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});