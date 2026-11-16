import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { assertAdmin } from '../../shared/authGuard.ts';

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
    const body = await req.json();
    const base44 = createClientFromRequest(req);
    const { authorized, response } = await assertAdmin(base44);
    if (!authorized) return response;

    const { event, data } = body;

    // Only act on update events where stripe_payment_status changed to 'paid'
    if (event?.type !== 'update') {
      return Response.json({ skipped: true, reason: 'not an update event' });
    }

    const order = data;

    if (!order || order.stripe_payment_status !== 'paid') {
      return Response.json({ skipped: true, reason: 'payment not paid' });
    }

    const customerEmail = order.customer_email;
    if (!customerEmail) {
      return Response.json({ skipped: true, reason: 'no customer email' });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');

    const itemRows = (order.items || []).map(item =>
      `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${item.product_name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">${item.quantity}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">$${(item.subtotal || item.price * item.quantity).toFixed(2)}</td>
      </tr>`
    ).join('');

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'DM Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:#1a2a6b;padding:32px 40px;text-align:center;">
            <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:700;">🍸 SipSwift</h1>
            <p style="color:#f0b429;margin:8px 0 0;font-size:14px;">Order Confirmed</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <h2 style="margin:0 0 8px;color:#1a2a6b;font-size:20px;">Thank you, ${order.customer_name}!</h2>
            <p style="color:#666;margin:0 0 24px;font-size:15px;">Your order <strong>${order.order_number}</strong> has been confirmed and is being prepared.</p>

            <!-- Order Details -->
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:8px;overflow:hidden;margin-bottom:24px;">
              <thead>
                <tr style="background:#f8f9fa;">
                  <th style="padding:10px 12px;text-align:left;font-size:12px;color:#888;font-weight:600;text-transform:uppercase;">Item</th>
                  <th style="padding:10px 12px;text-align:center;font-size:12px;color:#888;font-weight:600;text-transform:uppercase;">Qty</th>
                  <th style="padding:10px 12px;text-align:right;font-size:12px;color:#888;font-weight:600;text-transform:uppercase;">Total</th>
                </tr>
              </thead>
              <tbody>${itemRows}</tbody>
            </table>

            <!-- Price Summary -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr><td style="padding:4px 0;color:#666;font-size:14px;">Subtotal</td><td style="text-align:right;color:#333;font-size:14px;">$${(order.subtotal || 0).toFixed(2)}</td></tr>
              <tr><td style="padding:4px 0;color:#666;font-size:14px;">Delivery Fee</td><td style="text-align:right;color:#333;font-size:14px;">$${(order.delivery_fee || 0).toFixed(2)}</td></tr>
              <tr><td style="padding:4px 0;color:#666;font-size:14px;">Service Fee</td><td style="text-align:right;color:#333;font-size:14px;">$${(order.service_fee || 0).toFixed(2)}</td></tr>
              <tr><td style="padding:4px 0;color:#666;font-size:14px;">Tax</td><td style="text-align:right;color:#333;font-size:14px;">$${(order.tax || 0).toFixed(2)}</td></tr>
              ${order.tip > 0 ? `<tr><td style="padding:4px 0;color:#666;font-size:14px;">Driver Tip 💵</td><td style="text-align:right;color:#333;font-size:14px;">$${(order.tip || 0).toFixed(2)}</td></tr>` : ''}
              <tr>
                <td style="padding:12px 0 4px;border-top:2px solid #1a2a6b;font-weight:700;color:#1a2a6b;font-size:16px;">Total Paid</td>
                <td style="padding:12px 0 4px;border-top:2px solid #1a2a6b;text-align:right;font-weight:700;color:#1a2a6b;font-size:16px;">$${(order.total || 0).toFixed(2)}</td>
              </tr>
            </table>

            <!-- Delivery Info -->
            <div style="background:#f0f4ff;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
              <p style="margin:0 0 6px;font-weight:600;color:#1a2a6b;font-size:14px;">📦 Delivery Details</p>
              <p style="margin:0;color:#555;font-size:14px;"><strong>Store:</strong> ${order.store_name || 'N/A'}</p>
              <p style="margin:4px 0 0;color:#555;font-size:14px;"><strong>Address:</strong> ${order.delivery_address}</p>
            </div>

            <!-- Compliance notice -->
            <div style="background:#fff8e1;border-left:4px solid #f0b429;padding:12px 16px;border-radius:0 8px 8px 0;margin-bottom:24px;">
              <p style="margin:0;font-size:13px;color:#7a5c00;">⚠️ <strong>Reminder:</strong> Please have your government-issued ID ready at delivery. Your driver will verify your age (21+) before completing the delivery.</p>
            </div>

            <p style="color:#888;font-size:13px;margin:0;">Questions? Reply to this email or contact us. Thank you for choosing SipSwift!</p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f8f9fa;padding:20px 40px;text-align:center;border-top:1px solid #eee;">
            <p style="margin:0;color:#aaa;font-size:12px;">SipSwift · Pine Bluff, AR · Licensed & Compliant · 21+ Only</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const raw = buildEmail({
      to: customerEmail,
      subject: `✅ Your SipSwift Order ${order.order_number} is Confirmed!`,
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

    console.log(`Order confirmation sent to ${customerEmail} for order ${order.order_number}`);
    return Response.json({ success: true, sentTo: customerEmail });

  } catch (error) {
    console.error('sendOrderConfirmationGmail error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});