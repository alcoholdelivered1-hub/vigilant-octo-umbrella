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
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const order = payload.data;
    const newStatus = order?.status;

    if (!order || !['in_transit', 'delivered'].includes(newStatus)) {
      return Response.json({ skipped: true, reason: 'Not a relevant status' });
    }

    const isDelivered = newStatus === 'delivered';
    const subject = isDelivered
      ? `✅ Your Alcohol Delivered order #${order.order_number} has been delivered!`
      : `🚗 Your Alcohol Delivered order #${order.order_number} is out for delivery!`;

    const itemsHtml = (order.items || [])
      .map(i => `<tr>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${i.product_name}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center;">x${i.quantity}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">$${(i.subtotal || i.price * i.quantity).toFixed(2)}</td>
      </tr>`).join('');

    const body = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#f9fafb;padding:20px;">
      <div style="background:white;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <div style="background:#1e3a5f;padding:24px;text-align:center;">
          <h1 style="color:white;margin:0;font-size:24px;">Alcohol Delivered</h1>
          <p style="color:#f59e0b;margin:4px 0 0;">Order #${order.order_number}</p>
        </div>
        <div style="padding:24px;">
          <p style="color:#374151;">Hi <strong>${order.customer_name}</strong>,</p>
          ${isDelivered
            ? `<p style="font-size:18px;color:#16a34a;font-weight:bold;">Your order has been delivered! 🎉</p>
               <p>We hope you enjoy your order. Please remember to drink responsibly.</p>`
            : `<p style="font-size:18px;color:#1e3a5f;font-weight:bold;">Your order is on its way! 🚗</p>
               <p>Your driver <strong>${order.driver_name || 'your driver'}</strong> is heading to you now. Please have your ID ready for verification at delivery.</p>`
          }
          <div style="background:#f3f4f6;border-radius:8px;padding:16px;margin:20px 0;">
            <p style="margin:0 0 8px;font-weight:bold;color:#374151;">Delivery Address</p>
            <p style="margin:0;color:#6b7280;">${order.delivery_address}</p>
          </div>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <thead>
              <tr style="background:#f3f4f6;">
                <th style="padding:8px;text-align:left;font-size:12px;color:#6b7280;">ITEM</th>
                <th style="padding:8px;text-align:center;font-size:12px;color:#6b7280;">QTY</th>
                <th style="padding:8px;text-align:right;font-size:12px;color:#6b7280;">SUBTOTAL</th>
              </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
          </table>
          <div style="text-align:right;border-top:2px solid #e5e7eb;padding-top:12px;">
            <p style="margin:4px 0;color:#6b7280;">Subtotal: $${order.subtotal?.toFixed(2) || '0.00'}</p>
            <p style="margin:4px 0;color:#6b7280;">Delivery Fee: $${order.delivery_fee?.toFixed(2) || '0.00'}</p>
            <p style="margin:8px 0;font-size:18px;font-weight:bold;color:#1e3a5f;">Total: $${order.total?.toFixed(2)}</p>
          </div>
          ${isDelivered ? `<div style="background:#dcfce7;border-radius:8px;padding:12px;margin-top:16px;text-align:center;">
            <p style="margin:0;color:#16a34a;font-weight:bold;">Thank you for choosing Alcohol Delivered! 🙏</p>
          </div>` : ''}
        </div>
        <div style="background:#f3f4f6;padding:16px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">Alcohol Delivered — Fast, legal alcohol delivery in Arkansas</p>
          <p style="margin:4px 0 0;font-size:12px;color:#9ca3af;">Please drink responsibly. Must be 21+ to receive delivery.</p>
        </div>
      </div>
    </div>`;

    // Use Gmail to send — platform SendEmail only reaches registered app users
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
    const raw = buildRawEmail(order.customer_email, subject, body, 'Alcohol Delivered');

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

    console.log('Email sent | Status:', newStatus, '| To:', order.customer_email);
    return Response.json({ success: true });
  } catch (error) {
    console.error('sendOrderStatusEmail error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});