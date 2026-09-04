import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

function buildRawEmail(to, subject, html, fromName) {
  const fromHeader = `${fromName} <alcohol.delivered1@gmail.com>`;
  const message = [
    `From: ${fromHeader}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=UTF-8`,
    ``,
    html,
  ].join('\r\n');
  return btoa(unescape(encodeURIComponent(message)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);

    // Scheduled tasks must only run as admin
    const user = await base44.auth.me().catch(() => null);
    if (user && user.role !== 'admin') {
        return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Fetch all delivered orders from the past 7 days
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const allOrders = await base44.asServiceRole.entities.Order.filter({ status: 'delivered' });
    const orders = allOrders.filter(o => o.created_date >= since);

    if (orders.length === 0) {
        return Response.json({ success: true, message: 'No delivered orders this week, no report sent.' });
    }

    // Aggregate: { storeId -> { storeName, products: { productName -> { qty, revenue } } } }
    const storeMap = {};

    for (const order of orders) {
        const storeId = order.store_id || 'unknown';
        const storeName = order.store_name || storeId;

        if (!storeMap[storeId]) {
            storeMap[storeId] = { storeName, products: {}, orderCount: 0, storeTotal: 0 };
        }

        storeMap[storeId].orderCount += 1;
        storeMap[storeId].storeTotal += order.total || 0;

        for (const item of (order.items || [])) {
            const key = item.product_name || item.product_id || 'Unknown Product';
            if (!storeMap[storeId].products[key]) {
                storeMap[storeId].products[key] = { qty: 0, revenue: 0 };
            }
            storeMap[storeId].products[key].qty += item.quantity || 0;
            storeMap[storeId].products[key].revenue += item.subtotal || (item.price * item.quantity) || 0;
        }
    }

    // Calculate grand totals
    const grandTotal = orders.reduce((sum, o) => sum + (o.total || 0), 0);
    const weekLabel = `${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

    // Build HTML report
    let storeRows = '';
    for (const [, store] of Object.entries(storeMap)) {
        const productRows = Object.entries(store.products)
            .sort((a, b) => b[1].revenue - a[1].revenue)
            .map(([name, data]) => `
                <tr>
                    <td style="padding: 8px 12px; color: #374151;">${name}</td>
                    <td style="padding: 8px 12px; text-align: center; color: #374151;">${data.qty}</td>
                    <td style="padding: 8px 12px; text-align: right; color: #374151;">$${data.revenue.toFixed(2)}</td>
                </tr>
            `).join('');

        storeRows += `
            <div style="margin-bottom: 32px;">
                <div style="background: #1e3a5f; color: white; padding: 12px 16px; border-radius: 8px 8px 0 0; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight: 700; font-size: 15px;">🏪 ${store.storeName}</span>
                    <span style="font-size: 13px; opacity: 0.85;">${store.orderCount} orders · $${store.storeTotal.toFixed(2)}</span>
                </div>
                <table style="width: 100%; border-collapse: collapse; background: white; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; overflow: hidden;">
                    <thead>
                        <tr style="background: #f9fafb;">
                            <th style="padding: 8px 12px; text-align: left; font-size: 12px; color: #6b7280; font-weight: 600; border-bottom: 1px solid #e5e7eb;">Product</th>
                            <th style="padding: 8px 12px; text-align: center; font-size: 12px; color: #6b7280; font-weight: 600; border-bottom: 1px solid #e5e7eb;">Units Sold</th>
                            <th style="padding: 8px 12px; text-align: right; font-size: 12px; color: #6b7280; font-weight: 600; border-bottom: 1px solid #e5e7eb;">Revenue</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${productRows}
                    </tbody>
                </table>
            </div>
        `;
    }

    const html = `
<div style="font-family: sans-serif; max-width: 680px; margin: 0 auto; padding: 24px; color: #111827;">
    <div style="text-align: center; margin-bottom: 28px;">
        <h1 style="font-size: 22px; font-weight: 700; margin: 0 0 4px;">📊 Weekly Sales Report</h1>
        <p style="color: #6b7280; font-size: 14px; margin: 0;">${weekLabel}</p>
    </div>

    <div style="display: flex; gap: 16px; margin-bottom: 28px; background: #f0f4ff; border-radius: 10px; padding: 16px 20px;">
        <div style="flex: 1; text-align: center;">
            <p style="margin: 0; font-size: 24px; font-weight: 700; color: #1e3a5f;">$${grandTotal.toFixed(2)}</p>
            <p style="margin: 4px 0 0; font-size: 12px; color: #6b7280;">Total Revenue</p>
        </div>
        <div style="flex: 1; text-align: center;">
            <p style="margin: 0; font-size: 24px; font-weight: 700; color: #1e3a5f;">${orders.length}</p>
            <p style="margin: 4px 0 0; font-size: 12px; color: #6b7280;">Delivered Orders</p>
        </div>
        <div style="flex: 1; text-align: center;">
            <p style="margin: 0; font-size: 24px; font-weight: 700; color: #1e3a5f;">${Object.keys(storeMap).length}</p>
            <p style="margin: 4px 0 0; font-size: 12px; color: #6b7280;">Active Stores</p>
        </div>
    </div>

    ${storeRows}

    <p style="font-size: 12px; color: #9ca3af; text-align: center; margin-top: 32px;">
        Alcohol Delivered · Pine Bluff, AR · Automated Weekly Report
    </p>
</div>
    `.trim();

    const adminEmail = Deno.env.get('STORE_MANAGER_EMAIL');
    if (!adminEmail) {
        return Response.json({ error: 'STORE_MANAGER_EMAIL secret not set' }, { status: 500 });
    }

    // Use Gmail to send — admin email may not be a registered app user
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
    const raw = buildRawEmail(adminEmail, `📊 Weekly Sales Report — ${weekLabel}`, html, 'Alcohol Delivered — Weekly Report');
    const gmailRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw }),
    });
    if (!gmailRes.ok) {
        const errBody = await gmailRes.text();
        throw new Error(`Gmail API error: ${gmailRes.status} — ${errBody}`);
    }

    return Response.json({
        success: true,
        week: weekLabel,
        orders_included: orders.length,
        stores: Object.keys(storeMap).length,
        grand_total: grandTotal.toFixed(2),
        notified: adminEmail,
    });
});