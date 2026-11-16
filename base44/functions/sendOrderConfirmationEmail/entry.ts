import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { assertAdmin } from '../../shared/authGuard.ts';

function buildMimeMessage({ to, subject, htmlBody, fromName }) {
  const boundary = 'boundary_' + Math.random().toString(36).slice(2);
  const lines = [
    `From: ${fromName} <me>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: quoted-printable`,
    ``,
    htmlBody,
    ``,
    `--${boundary}--`,
  ];
  const raw = lines.join('\r\n');
  return btoa(unescape(encodeURIComponent(raw)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const base44 = createClientFromRequest(req);
    const { authorized, response } = await assertAdmin(base44);
    if (!authorized) return response;
    const order = body.data || body.order;
    if (!order) {
      return Response.json({ error: 'No order data provided' }, { status: 400 });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');

    const storeManagerEmail = Deno.env.get('STORE_MANAGER_EMAIL');
    if (!storeManagerEmail) {
      return Response.json({ error: 'STORE_MANAGER_EMAIL secret not set' }, { status: 500 });
    }

    const recipients = [storeManagerEmail];

    const itemsHtml = (order.items || []).map(item =>
      `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;">${item.product_name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center;">${item.quantity}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;">$${(item.subtotal || item.price * item.quantity).toFixed(2)}</td>
      </tr>`
    ).join('');

    const htmlBody = `
<!DOCTYPE html>
<html>
<body style="font-family:'DM Sans',Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:#1e2a6e;padding:24px 32px;">
      <h1 style="color:#fff;margin:0;font-size:22px;">🍺 New Order Received</h1>
      <p style="color:#c9d3f0;margin:6px 0 0;font-size:14px;">Alcohol Delivered — Store Manager Notification</p>
    </div>
    <div style="padding:28px 32px;">
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <tr><td style="padding:6px 0;color:#888;font-size:13px;">Order #</td><td style="padding:6px 0;font-weight:600;">${order.order_number || order.id}</td></tr>
        <tr><td style="padding:6px 0;color:#888;font-size:13px;">Customer</td><td style="padding:6px 0;">${order.customer_name}</td></tr>
        <tr><td style="padding:6px 0;color:#888;font-size:13px;">Phone</td><td style="padding:6px 0;">${order.customer_phone || '—'}</td></tr>
        <tr><td style="padding:6px 0;color:#888;font-size:13px;">Store</td><td style="padding:6px 0;">${order.store_name || '—'}</td></tr>
        <tr><td style="padding:6px 0;color:#888;font-size:13px;">Delivery Address</td><td style="padding:6px 0;">${order.delivery_address}</td></tr>
        ${order.notes ? `<tr><td style="padding:6px 0;color:#888;font-size:13px;">Notes</td><td style="padding:6px 0;">${order.notes}</td></tr>` : ''}
      </table>

      <h3 style="font-size:15px;margin:0 0 10px;color:#333;">Order Items</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="background:#f8f8f8;">
            <th style="padding:8px 12px;text-align:left;color:#555;">Product</th>
            <th style="padding:8px 12px;text-align:center;color:#555;">Qty</th>
            <th style="padding:8px 12px;text-align:right;color:#555;">Subtotal</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
      </table>

      <div style="margin-top:20px;padding:16px;background:#f9fafb;border-radius:8px;">
        <div style="display:flex;justify-content:space-between;font-size:13px;color:#666;margin-bottom:4px;">
          <span>Subtotal</span><span>$${(order.subtotal || 0).toFixed(2)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:13px;color:#666;margin-bottom:4px;">
          <span>Delivery Fee</span><span>$${(order.delivery_fee || 3).toFixed(2)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:13px;color:#666;margin-bottom:8px;">
          <span>Tax</span><span>$${(order.tax || 0).toFixed(2)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:700;color:#1e2a6e;">
          <span>Total</span><span>$${(order.total || 0).toFixed(2)}</span>
        </div>
      </div>

      <div style="margin-top:20px;padding:14px;background:#fff8e1;border:1px solid #ffd54f;border-radius:8px;font-size:13px;color:#7a5c00;">
        <strong>Action Required:</strong> Please prepare this order and mark it as "Pickup Ready" in the admin dashboard when ready for driver pickup.
      </div>
    </div>
    <div style="padding:16px 32px;background:#f8f8f8;text-align:center;font-size:12px;color:#aaa;">
      Alcohol Delivered · Pine Bluff, AR · Powered by Base44
    </div>
  </div>
</body>
</html>`;

    const subject = `🍺 New Order ${order.order_number || order.id} — $${(order.total || 0).toFixed(2)} | ${order.store_name || ''}`;

    const sendResults = await Promise.all(recipients.map(async (to) => {
      const raw = buildMimeMessage({ to, subject, htmlBody, fromName: 'Alcohol Delivered' });
      const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw }),
      });
      if (!res.ok) {
        const err = await res.text();
        return { to, success: false, error: err };
      }
      return { to, success: true };
    }));

    const failed = sendResults.filter(r => !r.success);
    if (failed.length > 0) {
      return Response.json({ error: 'Some emails failed', details: failed }, { status: 500 });
    }

    return Response.json({ success: true, message: 'Order confirmation emails sent', recipients });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});