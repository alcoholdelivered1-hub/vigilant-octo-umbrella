import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { assertAdmin } from '../../shared/authGuard.ts';

// Automation entrypoint for the "Paid Order Automation" workflow.
// Requires an authenticated admin: when an order becomes paid, emails
// the customer a confirmation with their items, total, delivery address, and
// the 21+ ID reminder. Re-fetches the order server-side; never trusts the
// request body for the recipient.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const access = await assertAdmin(base44);
    if (!access.authorized) return access.response;
    const body = await req.json().catch(() => ({}));
    const orderId = body.order_id || body.data?.id;
    if (!orderId) return Response.json({ error: 'order_id is required' }, { status: 400 });

    const order = await base44.entities.Order.get(orderId);
    if (!order) return Response.json({ skipped: true, reason: 'Order not found' });
    if (order.stripe_payment_status !== 'paid') return Response.json({ skipped: true, reason: 'payment not paid' });
    if (!order.customer_email) return Response.json({ skipped: true, reason: 'no customer email' });

    const itemRows = (order.items || []).map((i) => `${i.product_name} x${i.quantity} — $${((i.subtotal) || (i.price * i.quantity)).toFixed(2)}`).join('\n');
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: order.customer_email,
      subject: `Payment received — Order ${order.order_number}`, 
      body: `Hi ${order.customer_name || 'there'},\n\nYour order #${order.order_number} from ${order.store_name || 'our store'} has been paid and is awaiting the retailer’s acceptance. The retailer is the seller of record.\n\nItems:\n${itemRows}\n\nTotal Paid: $${(order.total || 0).toFixed(2)}\nDelivery to: ${order.delivery_address}\n\n⚠️ Reminder: Please have your government-issued ID ready at delivery. Your driver will verify your age (21+) before completing the delivery.\n\nTrack your order in the app. Thanks for choosing Alcohol Delivered!\n— The Alcohol Delivered Team`,
    });

    // Payment is not retailer acceptance or pickup readiness.
    // The existing pickup-ready workflow alerts the driver after the retailer prepares the order.

    return Response.json({ success: true, sent_to: order.customer_email, order: order.order_number });
  } catch (error) {
    console.error('onPaidOrderAutomation error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}