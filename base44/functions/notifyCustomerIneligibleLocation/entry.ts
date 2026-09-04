/**
 * Notifies a customer that their order could not be fulfilled because their
 * delivery address is outside the active delivery zones. Marks the order as
 * cancelled so it doesn't sit pending forever.
 *
 * POST body: { order_id: string }
 * Uses the built-in SendEmail integration (registered app users only).
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';

function buildEmail(order, rejectionReason) {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'DM Sans',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
<tr><td style="background:#1e3a5f;padding:32px 40px;text-align:center;">
  <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">Alcohol Delivered</h1>
  <p style="margin:4px 0 0;color:#f59e0b;font-size:13px;text-transform:uppercase;letter-spacing:1.5px;">Delivery Area Check</p>
</td></tr>
<tr><td style="padding:36px 40px;">
  <h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;">Hi ${order.customer_name || 'there'},</h2>
  <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.6;">
    Thanks for your order <strong>#${order.order_number}</strong>! Unfortunately, we weren't able to accept it because the delivery address you entered is outside our current delivery zones.
  </p>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px 20px;margin-bottom:20px;">
    <tr><td style="color:#475569;font-size:14px;line-height:1.6;">
      <strong style="color:#1e3a5f;">Delivery address:</strong> ${order.delivery_address}<br>
      <strong style="color:#1e3a5f;">Reason:</strong> ${rejectionReason}
    </td></tr>
  </table>
  <p style="margin:0 0 12px;color:#475569;font-size:15px;line-height:1.6;">
    Your order has been cancelled and you have <strong>not been charged</strong>. If you believe this is a mistake, or if you'd like to try a different address, please reply to this email or place a new order with an address inside our service area.
  </p>
  <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.6;">
    We're expanding quickly — check back soon as we add more zones across Arkansas.
  </p>
</td></tr>
<tr><td style="background:#1e3a5f;padding:20px 40px;text-align:center;">
  <p style="margin:0;color:#94a3b8;font-size:11px;">Alcohol Delivered, LLC · Pine Bluff, AR · alcohol-delivered.biz</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const orderId = body.order_id || body.event?.entity_id || body.data?.id;

    if (!orderId) {
      return Response.json({ error: 'order_id is required' }, { status: 400 });
    }

    const order = await base44.asServiceRole.entities.Order.get(orderId);
    if (!order) {
      return Response.json({ error: 'Order not found' }, { status: 404 });
    }
    if (!order.customer_email) {
      return Response.json({ skipped: true, reason: 'Order has no customer email' });
    }

    const rejectionReason = body.rejection_reason || 'Delivery address is outside our active delivery zones.';

    // Email the customer
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: order.customer_email,
      subject: `Order #${order.order_number} — We can't deliver to this address`,
      body: buildEmail(order, rejectionReason),
    });

    // Mark the order cancelled so it doesn't sit pending
    await base44.asServiceRole.entities.Order.update(orderId, {
      status: 'cancelled',
      refusal_reason: rejectionReason,
    });

    console.log(`Customer ${order.customer_email} notified of ineligibility for order ${order.order_number}`);
    return Response.json({ success: true, order_id: orderId, customer_email: order.customer_email });
  } catch (error) {
    console.error('notifyCustomerIneligibleLocation error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});