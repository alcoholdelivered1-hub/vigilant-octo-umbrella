import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { assertAdmin } from '../../shared/authGuard.ts';

// Automation entrypoint for the "Order Status Notifications" workflow.
// Requires an authenticated admin: when an order transitions to a
// customer-facing status (preparing, pickup_ready, in_transit, cancelled),
// emails the customer a short update. The "delivered" transition is handled
// separately by completeOrderDelivery (rating email), and "paid" by
// onPaidOrderAutomation, so those are skipped here to avoid duplicate emails.
const MESSAGES = {
  preparing: (o) => `Hi ${o.customer_name || 'there'},\n\nYour order #${o.order_number} from ${o.store_name || 'our store'} is now being prepared. We'll let you know when it's on the way!\n\nTrack your order in the app.\n— The Alcohol Delivered Team`,
  pickup_ready: (o) => `Hi ${o.customer_name || 'there'},\n\nGood news! Your order #${o.order_number} from ${o.store_name || 'our store'} is ready for pickup and will be heading your way shortly.\n\n— The Alcohol Delivered Team`,
  in_transit: (o) => `Hi ${o.customer_name || 'there'},\n\nYour driver is on the way with your order #${o.order_number} from ${o.store_name || 'our store'}! 🚚\n\nTrack your delivery live in the app. Please have your government-issued ID ready — your driver will verify your age (21+) before completing the delivery.\n\n— The Alcohol Delivered Team`,
  cancelled: (o) => `Hi ${o.customer_name || 'there'},\n\nYour order #${o.order_number} from ${o.store_name || 'our store'} has been cancelled. If you have any questions, reply to this email or contact us.\n\n— The Alcohol Delivered Team`,
};
const SUBJECTS = {
  preparing: '👨‍🍳 Your order is being prepared',
  pickup_ready: '✅ Your order is ready for pickup',
  in_transit: '🚚 Your driver is on the way!',
  cancelled: 'Your order has been cancelled',
};

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
    if (!MESSAGES[order.status]) return Response.json({ skipped: true, reason: `Status '${order.status}' is not a notify status` });
    if (!order.customer_email) return Response.json({ skipped: true, reason: 'no customer email' });

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: order.customer_email,
      subject: `${SUBJECTS[order.status]} — Order #${order.order_number}`,
      body: MESSAGES[order.status](order),
    });

    return Response.json({ success: true, sent_to: order.customer_email, order: order.order_number, status: order.status });
  } catch (error) {
    console.error('notifyOrderStatusTransition error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}