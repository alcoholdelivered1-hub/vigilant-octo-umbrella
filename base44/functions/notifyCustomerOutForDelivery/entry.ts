import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function buildEmail({ to, subject, html }) {
  const boundary = 'boundary_ad_' + Date.now();
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
    const payload = await req.json();

    const { event, data: order, old_data } = payload;

    // Only act on update events
    if (event?.type && event.type !== 'update') {
      return Response.json({ skipped: true, reason: 'not an update event' });
    }

    if (!order || !order.customer_email) {
      return Response.json({ skipped: true, reason: 'no order data or customer email' });
    }

    // Only fire when status transitions TO in_transit
    const newStatus = order.status;
    const oldStatus = old_data?.status;
    if (newStatus !== 'in_transit' || newStatus === oldStatus) {
      return Response.json({ skipped: true, reason: `status ${oldStatus} → ${newStatus}, not out-for-delivery` });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'DM Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#1a2a6b;padding:32px 40px;text-align:center;">
            <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:700;">🍸 Alcohol Delivered</h1>
            <p style="color:#f0b429;margin:8px 0 0;font-size:14px;">Out for Delivery</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <h2 style="margin:0 0 8px;color:#1a2a6b;font-size:20px;">Your order is on its way, ${order.customer_name}!</h2>
            <p style="color:#666;margin:0 0 24px;font-size:15px;">Your order <strong>${order.order_number}</strong> from <strong>${order.store_name || 'your store'}</strong> is out for delivery right now.</p>

            <div style="background:#f0f4ff;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
              <p style="margin:0 0 6px;font-weight:600;color:#1a2a6b;font-size:14px;">🚗 Delivery Details</p>
              <p style="margin:0;color:#555;font-size:14px;"><strong>Driver:</strong> ${order.driver_name || 'Your assigned driver'}</p>
              <p style="margin:4px 0 0;color:#555;font-size:14px;"><strong>Delivery Address:</strong> ${order.delivery_address}</p>
              <p style="margin:4px 0 0;color:#555;font-size:14px;"><strong>Estimated Arrival:</strong> 15–25 minutes</p>
            </div>

            <div style="background:#fff8e1;border-left:4px solid #f0b429;padding:12px 16px;border-radius:0 8px 8px 0;margin-bottom:24px;">
              <p style="margin:0;font-size:13px;color:#7a5c00;">⚠️ <strong>ID Required at Delivery:</strong> Please have your valid government-issued photo ID ready. Your driver is required to verify your age (21+) before completing the delivery. Unattended or contactless alcohol delivery is not permitted.</p>
            </div>

            <p style="color:#888;font-size:13px;margin:0;">Track your order in real time in the app. Questions? Reply to this email. Thank you for choosing Alcohol Delivered!</p>
          </td>
        </tr>
        <tr>
          <td style="background:#f8f9fa;padding:20px 40px;text-align:center;border-top:1px solid #eee;">
            <p style="margin:0;color:#aaa;font-size:12px;">Alcohol Delivered · Pine Bluff, AR · Licensed & Compliant · 21+ Only</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const raw = buildEmail({
      to: order.customer_email,
      subject: `🚚 Your Alcohol Delivered order #${order.order_number} is out for delivery!`,
      html,
    });

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

    console.log(`Out-for-delivery email sent to ${order.customer_email} for order ${order.order_number}`);
    return Response.json({ success: true, sentTo: order.customer_email });

  } catch (error) {
    console.error('notifyCustomerOutForDelivery error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});