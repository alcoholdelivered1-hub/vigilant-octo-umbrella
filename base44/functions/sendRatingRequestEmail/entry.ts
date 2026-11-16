import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { assertAdmin } from '../../shared/authGuard.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { authorized, response } = await assertAdmin(base44);
    if (!authorized) return response;
    const payload = await req.json();

    const eventData = payload.data;
    const oldStatus = payload.old_data?.status;

    if (!eventData || eventData.status !== 'delivered' || oldStatus === 'delivered') {
      return Response.json({ skipped: true, reason: 'Not a delivery transition' });
    }

    // Fetch the order server-side by ID — never trust the request body for the recipient
    const orders = await base44.asServiceRole.entities.Order.filter({ id: eventData.id });
    const order = orders[0];
    if (!order) {
      return Response.json({ skipped: true, reason: 'Order not found' });
    }
    if (order.status !== 'delivered') {
      return Response.json({ skipped: true, reason: 'Order is not delivered' });
    }
    if (!order.customer_email || !order.driver_id) {
      return Response.json({ skipped: true, reason: 'Missing customer email or driver' });
    }

    // Simple token = base64 of order_id:driver_id (no crypto needed, not security-sensitive)
    const token = btoa(`${order.id}:${order.driver_id}`);
    // Derive app URL from the BASE44_APP_ID to build a stable public URL
    const appId = Deno.env.get('BASE44_APP_ID') || '';
    const appUrl = appId ? `https://${appId}.base44.app` : 'https://app.base44.app';
    const ratingUrl = `${appUrl}/rate-delivery?token=${token}`;

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: order.customer_email,
      subject: '⭐ How was your delivery? Rate your driver',
      body: `Hi ${order.customer_name || 'there'},

Your order #${order.order_number} from ${order.store_name} was just delivered!

We'd love to know how it went. It only takes 10 seconds:

👉 Rate your delivery: ${ratingUrl}

Your feedback helps us improve and reward great drivers.

Thanks for choosing Alcohol Delivered!
— The Alcohol Delivered Team`,
    });

    console.log(`Rating request sent to ${order.customer_email} for order ${order.order_number}`);
    return Response.json({ success: true, recipient: order.customer_email, order: order.order_number });
  } catch (error) {
    console.error('sendRatingRequestEmail error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});