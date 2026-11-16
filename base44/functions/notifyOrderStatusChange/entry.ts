import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { assertAdmin } from '../../shared/authGuard.ts';

const STATUS_MESSAGES = {
  confirmed: {
    subject: '✅ Your Order Has Been Confirmed!',
    body: (order) => `Hi ${order.customer_name},\n\nGreat news! Your order #${order.order_number} from ${order.store_name} has been confirmed and is being prepared.\n\nOrder Total: $${order.total?.toFixed(2)}\nDelivery Address: ${order.delivery_address}\n\nWe'll notify you when your order is out for delivery!\n\n— Alcohol Delivered`,
  },
  preparing: {
    subject: '📦 Your Order is Being Packed',
    body: (order) => `Hi ${order.customer_name},\n\nYour order #${order.order_number} from ${order.store_name} is currently being packed and will be ready for pickup soon.\n\n— Alcohol Delivered`,
  },
  pickup_ready: {
    subject: '🚗 Driver is Heading to Pick Up Your Order',
    body: (order) => `Hi ${order.customer_name},\n\nYour order #${order.order_number} is ready! Your driver${order.driver_name ? ` (${order.driver_name})` : ''} is on the way to pick it up from ${order.store_name}.\n\nEstimated delivery: 15–30 minutes.\n\nPlease have your ID ready for verification at the door.\n\n— Alcohol Delivered`,
  },
  in_transit: {
    subject: '🚚 Your Order is Out for Delivery!',
    body: (order) => `Hi ${order.customer_name},\n\nYour order #${order.order_number} is on the way!\n\nDriver: ${order.driver_name || 'Assigned driver'}\nDelivery Address: ${order.delivery_address}\n\n⚠️ Please have a valid government-issued ID ready — your driver is required to verify your age at delivery.\n\nExpected arrival: 15–25 minutes.\n\n— Alcohol Delivered`,
  },
  delivered: {
    subject: '🎉 Your Order Has Been Delivered!',
    body: (order) => `Hi ${order.customer_name},\n\nYour order #${order.order_number} from ${order.store_name} has been delivered. Enjoy!\n\nOrder Total: $${order.total?.toFixed(2)}\nDelivered to: ${order.delivery_address}\n\nThank you for choosing Alcohol Delivered. We hope to see you again soon!\n\n— Alcohol Delivered`,
  },
  cancelled: {
    subject: '❌ Your Order Has Been Cancelled',
    body: (order) => `Hi ${order.customer_name},\n\nUnfortunately your order #${order.order_number} has been cancelled.\n\n${order.refusal_reason ? `Reason: ${order.refusal_reason}\n\n` : ''}If you have questions, please contact us.\n\n— Alcohol Delivered`,
  },
  refused: {
    subject: '⚠️ Delivery Could Not Be Completed',
    body: (order) => `Hi ${order.customer_name},\n\nYour delivery for order #${order.order_number} was unable to be completed.\n\nReason: ${order.refusal_reason || 'Delivery refused by driver'}\n\nCommon reasons include: unable to verify ID, customer appeared intoxicated, or wrong person at delivery.\n\nPlease contact us if you have questions.\n\n— Alcohol Delivered`,
  },
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const { authorized, response } = await assertAdmin(base44);
    if (!authorized) return response;

    const { event, data: order, old_data } = payload;

    if (!order || !order.customer_email) {
      return Response.json({ skipped: true, reason: 'No order data or customer email' });
    }

    const newStatus = order.status;
    const oldStatus = old_data?.status;

    // Only notify on meaningful status transitions
    if (newStatus === oldStatus) {
      return Response.json({ skipped: true, reason: 'Status unchanged' });
    }

    const template = STATUS_MESSAGES[newStatus];
    if (!template) {
      return Response.json({ skipped: true, reason: `No template for status: ${newStatus}` });
    }

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: order.customer_email,
      subject: template.subject,
      body: template.body(order),
    });

    console.log(`Sent ${newStatus} notification to ${order.customer_email} for order ${order.order_number}`);

    return Response.json({ success: true, status: newStatus, recipient: order.customer_email });
  } catch (error) {
    console.error('Error sending notification:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});