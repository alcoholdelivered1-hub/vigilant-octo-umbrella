import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

function buildEmail({ to, subject, html }) {
  const boundary = 'boundary_sipswift_' + Date.now();
  const message = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    html,
    '',
    `--${boundary}--`,
  ].join('\r\n');

  return btoa(unescape(encodeURIComponent(message)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { order_id } = await req.json();
    if (!order_id) return Response.json({ error: 'order_id is required' }, { status: 400 });

    const order = await base44.asServiceRole.entities.Order.get(order_id);
    if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });

    const stores = await base44.asServiceRole.entities.Store.filter({ id: order.store_id });
    const store = stores[0];
    if (!store) return Response.json({ error: 'Store not found' }, { status: 404 });
    if (!store.email) return Response.json({ skipped: true, reason: 'Store has no email' });

    const driverName = order.driver_name || 'Your driver';

    const itemRows = (order.items || []).map(item =>
      `<tr><td style="padding:6px 0;">${item.quantity}x ${item.product_name}</td><td style="padding:6px 0;text-align:right;">$${(item.subtotal || item.price * item.quantity).toFixed(2)}</td></tr>`
    ).join('');

    const html = `
<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'DM Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#1a2a6b;padding:28px 40px;text-align:center;">
            <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;">🚚 Driver On The Way</h1>
            <p style="color:#f0b429;margin:6px 0 0;font-size:14px;">Alcohol Delivered</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <p style="color:#333;font-size:15px;margin:0 0 20px;">Hi ${store.name} team,</p>
            <p style="color:#333;font-size:15px;margin:0 0 24px;">Your delivery driver <strong>${driverName}</strong> is on the way to your store to pick up order <strong>#${order.order_number}</strong>. Please have the order ready for handoff.</p>

            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:8px;overflow:hidden;margin-bottom:20px;">
              <tr style="background:#f8f9fa;">
                <td style="padding:12px 16px;font-size:13px;color:#888;font-weight:600;text-transform:uppercase;">Order Summary</td>
                <td style="padding:12px 16px;text-align:right;font-size:13px;color:#888;font-weight:600;">#${order.order_number}</td>
              </tr>
              <tr><td colspan="2" style="padding:12px 16px;">
                ${itemRows}
              </td></tr>
            </table>

            <div style="background:#f0f4ff;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
              <p style="margin:0 0 4px;font-weight:600;color:#1a2a6b;font-size:14px;">Customer</p>
              <p style="margin:0;color:#555;font-size:14px;">${order.customer_name} — ${order.delivery_address}</p>
            </div>

            <p style="color:#888;font-size:13px;margin:0;">The driver will arrive shortly. Thank you for your partnership!</p>
          </td>
        </tr>
        <tr>
          <td style="background:#f8f9fa;padding:16px 40px;text-align:center;border-top:1px solid #eee;">
            <p style="margin:0;color:#aaa;font-size:12px;">Alcohol Delivered · Pine Bluff, AR · Licensed & Compliant · 21+ Only</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const raw = buildEmail({
      to: store.email,
      subject: `🚚 Driver On The Way — Order #${order.order_number}`,
      html,
    });

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');

    const sendRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    });

    if (!sendRes.ok) {
      const err = await sendRes.text();
      console.error('Gmail send error:', err);
      return Response.json({ error: err }, { status: 500 });
    }

    console.log(`Driver en route email sent to ${store.email} for order ${order.order_number}`);
    return Response.json({ success: true, sentTo: store.email, store: store.name });
  } catch (error) {
    console.error('notifyStoreDriverEnRoute error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});