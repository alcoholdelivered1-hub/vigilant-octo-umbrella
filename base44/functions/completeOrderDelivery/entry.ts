import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { assertAdmin } from '../../shared/authGuard.ts';

// Admin-authorized entrypoint for the post-delivery chain.
// Workflow callers must also provide an authenticated admin identity.
// Mirrors the admin-gated syncInventoryOnOrderComplete / awardLoyaltyPoints /
// sendRatingRequestEmail logic, but as a single service-role function so a
// workflow can drive it end-to-end. Re-fetches the order server-side; never
// trusts the request body for the data it writes or the email recipient.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const access = await assertAdmin(base44);
    if (!access.authorized) return access.response;
    const body = await req.json().catch(() => ({}));
    const orderId = body.order_id || body.data?.id || body.event?.entity_id;
    if (!orderId) return Response.json({ error: 'order_id is required' }, { status: 400 });

    const order = await base44.entities.Order.get(orderId);
    if (!order) return Response.json({ skipped: true, reason: 'Order not found' });
    if (order.status !== 'delivered') return Response.json({ skipped: true, reason: `Order status is ${order.status}` });

    const summary = { order_id: order.id, order_number: order.order_number, inventory: [], loyalty: null, rating_email: null };

    // 1. Decrement inventory for each line item
    for (const item of order.items || []) {
      if (!item.product_id) continue;
      const product = await base44.entities.Product.get(item.product_id);
      if (!product) { summary.inventory.push({ product_id: item.product_id, skipped: true }); continue; }
      const currentQty = product.stock_quantity ?? null;
      if (currentQty === null) { summary.inventory.push({ product_id: item.product_id, name: product.name, skipped: true }); continue; }
      const newQty = Math.max(0, currentQty - (item.quantity || 1));
      await base44.entities.Product.update(item.product_id, { stock_quantity: newQty, in_stock: newQty > 0 });
      summary.inventory.push({ product_id: item.product_id, name: product.name, prev_qty: currentQty, new_qty: newQty });
    }

    // Admin-only cross-user maintenance; the recipient is taken from the authorized order.
    // 2. Award loyalty points (1 pt per $1 spent) to the registered customer
    if (order.customer_email) {
      const users = await base44.asServiceRole.entities.User.filter({ email: order.customer_email });
      const user = users?.[0];
      if (user) {
        const points = Math.floor(order.total || 0);
        if (points > 0) {
          await base44.asServiceRole.entities.User.update(user.id, {
            loyalty_points: (user.loyalty_points || 0) + points,
            loyalty_total_spent: (user.loyalty_total_spent || 0) + (order.total || 0),
          });
          summary.loyalty = { points_awarded: points, new_total: (user.loyalty_points || 0) + points };
        }
      }
    }

    // 3. Email the customer a driver-rating link
    if (order.customer_email && order.driver_id) {
      const token = btoa(`${order.id}:${order.driver_id}`);
      const appId = Deno.env.get('BASE44_APP_ID') || '';
      const appUrl = appId ? `https://${appId}.base44.app` : 'https://app.base44.app';
      const ratingUrl = `${appUrl}/rate-delivery?token=${token}`;
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: order.customer_email,
        subject: '⭐ How was your delivery? Rate your driver',
        body: `Hi ${order.customer_name || 'there'},\n\nYour order #${order.order_number} from ${order.store_name || 'our store'} was just delivered!\n\nWe'd love to know how it went. It only takes 10 seconds:\n\n👉 Rate your delivery: ${ratingUrl}\n\nYour feedback helps us improve and reward great drivers.\n\nThanks for choosing Alcohol Delivered!\n— The Alcohol Delivered Team`,
      });
      summary.rating_email = { sent_to: order.customer_email };
    }

    return Response.json({ success: true, ...summary });
  } catch (error) {
    console.error('completeOrderDelivery error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}