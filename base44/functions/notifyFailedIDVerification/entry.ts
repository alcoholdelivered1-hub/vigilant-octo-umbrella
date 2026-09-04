import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function buildRawEmail(to, subject, htmlBody, senderEmail) {
  const message = [
    `From: Alcohol Delivered — Compliance Alert <${senderEmail}>`,
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
  const payload = await req.json();
  const verification = payload.data;

  // Only act on failed verifications
  if (!verification || verification.is_verified !== false) {
    return Response.json({ skipped: true, reason: 'Not a failed verification' });
  }

  const orderId = verification.order_id;
  if (!orderId) {
    return Response.json({ skipped: true, reason: 'No order_id on verification' });
  }

  // Fetch the related order
  const order = await base44.asServiceRole.entities.Order.get(orderId);
  if (!order) {
    return Response.json({ skipped: true, reason: 'Order not found' });
  }

  // Only alert for active (non-terminal) orders
  const terminalStatuses = ['delivered', 'cancelled', 'refused'];
  if (terminalStatuses.includes(order.status)) {
    return Response.json({ skipped: true, reason: 'Order is already in a terminal state' });
  }

  const store = order.store_id
    ? await base44.asServiceRole.entities.Store.get(order.store_id)
    : null;
  const storeName = store?.name || order.store_name || 'Unknown Store';

  const managerEmail = Deno.env.get('STORE_MANAGER_EMAIL');
  if (!managerEmail) {
    return Response.json({ error: 'STORE_MANAGER_EMAIL secret not set' }, { status: 500 });
  }

  const subject = `⚠️ ID Verification Failed — Order ${order.order_number || order.id}`;
  const htmlBody = `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
  <div style="background: #fee2e2; border: 1px solid #fca5a5; border-radius: 12px; padding: 16px 20px; margin-bottom: 24px;">
    <h2 style="color: #991b1b; margin: 0 0 4px;">⚠️ ID Verification Failed</h2>
    <p style="color: #b91c1c; margin: 0; font-size: 14px;">Immediate action may be required.</p>
  </div>
  <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 10px 0; color: #6b7280; width: 40%;">Order #</td>
      <td style="padding: 10px 0; font-weight: 600;">${order.order_number || order.id}</td>
    </tr>
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 10px 0; color: #6b7280;">Customer</td>
      <td style="padding: 10px 0;">${order.customer_name || 'N/A'} (${order.customer_email || 'N/A'})</td>
    </tr>
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 10px 0; color: #6b7280;">Store</td>
      <td style="padding: 10px 0;">${storeName}</td>
    </tr>
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 10px 0; color: #6b7280;">Order Status</td>
      <td style="padding: 10px 0;">${order.status}</td>
    </tr>
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 10px 0; color: #6b7280;">Verification Type</td>
      <td style="padding: 10px 0;">${verification.verification_type || 'N/A'}</td>
    </tr>
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 10px 0; color: #6b7280;">ID Type</td>
      <td style="padding: 10px 0;">${verification.id_type || 'N/A'}</td>
    </tr>
    <tr>
      <td style="padding: 10px 0; color: #6b7280;">Delivery Address</td>
      <td style="padding: 10px 0;">${order.delivery_address || 'N/A'}</td>
    </tr>
  </table>
  <div style="background: #fef9c3; border: 1px solid #fde047; border-radius: 10px; padding: 14px 18px; margin-top: 24px; font-size: 13px; color: #713f12;">
    <strong>Action Required:</strong> Review this order in the Admin Dashboard and determine whether the delivery should be halted or the order refused to maintain compliance with Arkansas ABC regulations.
  </div>
  <p style="font-size: 12px; color: #9ca3af; margin-top: 24px;">
    Alcohol Delivered · Pine Bluff, AR · Automated Compliance Alert
  </p>
</div>`.trim();

  // Send via Gmail API (supports external recipients)
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

  console.log(`Failed ID verification alert sent to ${managerEmail} for order ${order.order_number || order.id}`);
  return Response.json({ success: true, notified: managerEmail, order_id: orderId, order_number: order.order_number });
});