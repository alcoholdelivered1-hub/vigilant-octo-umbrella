import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function buildRawEmail(to, subject, htmlBody, senderEmail) {
  const message = [
    `From: Alcohol Delivered — Daily Reports <${senderEmail}>`,
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
  const base44 = createClientFromRequest(req);

  const managerEmail = Deno.env.get('STORE_MANAGER_EMAIL');
  if (!managerEmail) {
    return Response.json({ error: 'STORE_MANAGER_EMAIL secret not set' }, { status: 500 });
  }

  // Yesterday's date range (Central Time offset -5/-6)
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const reportDate = yesterday.toISOString().split('T')[0];

  // Fetch all delivered orders from yesterday
  const allOrders = await base44.asServiceRole.entities.Order.filter({ status: 'delivered' });
  const dayOrders = allOrders.filter(o => {
    const d = (o.delivery_confirmed_at || o.updated_date || '').slice(0, 10);
    return d === reportDate;
  });

  // Aggregate by store
  const storeMap = {};
  for (const order of dayOrders) {
    const key = order.store_id || 'unknown';
    if (!storeMap[key]) {
      storeMap[key] = {
        store_name: order.store_name || 'Unknown Store',
        order_count: 0,
        revenue: 0,
        delivery_fees: 0,
        tips: 0,
      };
    }
    storeMap[key].order_count += 1;
    storeMap[key].revenue += order.total || 0;
    storeMap[key].delivery_fees += order.delivery_fee || 0;
    storeMap[key].tips += order.tip || 0;
  }

  const stores = Object.values(storeMap).sort((a, b) => b.revenue - a.revenue);
  const totalOrders = dayOrders.length;
  const totalRevenue = dayOrders.reduce((s, o) => s + (o.total || 0), 0);
  const totalTips = dayOrders.reduce((s, o) => s + (o.tip || 0), 0);
  const totalDeliveryFees = dayOrders.reduce((s, o) => s + (o.delivery_fee || 0), 0);

  const fmt = (n) => `$${n.toFixed(2)}`;

  const storeRows = stores.length > 0
    ? stores.map(s => `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 10px 12px; font-weight: 500;">${s.store_name}</td>
        <td style="padding: 10px 12px; text-align: center;">${s.order_count}</td>
        <td style="padding: 10px 12px; text-align: right;">${fmt(s.revenue)}</td>
        <td style="padding: 10px 12px; text-align: right;">${fmt(s.delivery_fees)}</td>
        <td style="padding: 10px 12px; text-align: right;">${fmt(s.tips)}</td>
      </tr>`).join('')
    : `<tr><td colspan="5" style="padding: 16px; text-align: center; color: #6b7280;">No delivered orders on this date.</td></tr>`;

  const formattedDate = new Date(reportDate + 'T12:00:00Z').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const htmlBody = `
<div style="font-family: sans-serif; max-width: 680px; margin: 0 auto; padding: 24px; color: #111827;">
  <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5494 100%); border-radius: 12px; padding: 24px; margin-bottom: 28px;">
    <h1 style="color: white; margin: 0 0 4px; font-size: 22px;">📊 Daily Revenue Report</h1>
    <p style="color: #93c5fd; margin: 0; font-size: 14px;">${formattedDate}</p>
  </div>

  <!-- Summary Cards -->
  <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 28px;">
    <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 10px; padding: 16px;">
      <p style="margin: 0 0 4px; font-size: 12px; color: #16a34a; text-transform: uppercase; font-weight: 600;">Total Revenue</p>
      <p style="margin: 0; font-size: 28px; font-weight: 700; color: #15803d;">${fmt(totalRevenue)}</p>
    </div>
    <div style="background: #eff6ff; border: 1px solid #93c5fd; border-radius: 10px; padding: 16px;">
      <p style="margin: 0 0 4px; font-size: 12px; color: #2563eb; text-transform: uppercase; font-weight: 600;">Orders Delivered</p>
      <p style="margin: 0; font-size: 28px; font-weight: 700; color: #1d4ed8;">${totalOrders}</p>
    </div>
    <div style="background: #fefce8; border: 1px solid #fde047; border-radius: 10px; padding: 16px;">
      <p style="margin: 0 0 4px; font-size: 12px; color: #ca8a04; text-transform: uppercase; font-weight: 600;">Delivery Fees</p>
      <p style="margin: 0; font-size: 24px; font-weight: 700; color: #a16207;">${fmt(totalDeliveryFees)}</p>
    </div>
    <div style="background: #fdf4ff; border: 1px solid #e9d5ff; border-radius: 10px; padding: 16px;">
      <p style="margin: 0 0 4px; font-size: 12px; color: #9333ea; text-transform: uppercase; font-weight: 600;">Driver Tips</p>
      <p style="margin: 0; font-size: 24px; font-weight: 700; color: #7e22ce;">${fmt(totalTips)}</p>
    </div>
  </div>

  <!-- Store Breakdown Table -->
  <h2 style="font-size: 16px; font-weight: 700; margin-bottom: 12px;">Store Breakdown</h2>
  <table style="width: 100%; border-collapse: collapse; font-size: 14px; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden;">
    <thead>
      <tr style="background: #f9fafb;">
        <th style="padding: 10px 12px; text-align: left; color: #6b7280; font-weight: 600; font-size: 12px; text-transform: uppercase;">Store</th>
        <th style="padding: 10px 12px; text-align: center; color: #6b7280; font-weight: 600; font-size: 12px; text-transform: uppercase;">Orders</th>
        <th style="padding: 10px 12px; text-align: right; color: #6b7280; font-weight: 600; font-size: 12px; text-transform: uppercase;">Revenue</th>
        <th style="padding: 10px 12px; text-align: right; color: #6b7280; font-weight: 600; font-size: 12px; text-transform: uppercase;">Del. Fees</th>
        <th style="padding: 10px 12px; text-align: right; color: #6b7280; font-weight: 600; font-size: 12px; text-transform: uppercase;">Tips</th>
      </tr>
    </thead>
    <tbody>${storeRows}</tbody>
  </table>

  <p style="font-size: 12px; color: #9ca3af; margin-top: 28px; text-align: center;">
    Alcohol Delivered · Pine Bluff, AR · Automated Daily Report
  </p>
</div>`.trim();

  const subject = `📊 Daily Report — ${formattedDate} · ${totalOrders} orders · ${fmt(totalRevenue)}`;

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

  console.log(`Daily revenue report sent to ${managerEmail} for ${reportDate}: ${totalOrders} orders, ${fmt(totalRevenue)}`);
  return Response.json({ success: true, report_date: reportDate, total_orders: totalOrders, total_revenue: totalRevenue });
});