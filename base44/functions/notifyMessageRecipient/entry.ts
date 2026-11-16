import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';
import { assertAdmin } from '../../shared/authGuard.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const { authorized, response } = await assertAdmin(base44);
    if (!authorized) return response;

    const message = payload.data || payload;
    const { order_id, order_number, sender_role, sender_name, text } = message;

    if (!order_id || !sender_role) {
      return Response.json({ skipped: true, reason: 'Missing order_id or sender_role' });
    }

    // Fetch the order for driver_email, customer_email, store info
    const order = await base44.asServiceRole.entities.Order.get(order_id);
    if (!order) {
      return Response.json({ skipped: true, reason: 'Order not found' });
    }

    const orderNum = order_number || order.order_number;
    const msgPreview = (text || '').slice(0, 200);
    const senderLabel = sender_name || sender_role;

    // Fetch the store email
    let storeEmail = null;
    let storeName = order.store_name || 'Store';
    if (order.store_id) {
      const stores = await base44.asServiceRole.entities.Store.filter({ id: order.store_id });
      if (stores[0]) {
        storeEmail = stores[0].email;
        storeName = stores[0].name;
      }
    }

    const driverEmail = message.driver_email || order.driver_email;
    const driverName = order.driver_name || 'Driver';
    const driverId = order.driver_id || message.driver_id;
    const custEmail = message.customer_email || order.customer_email;
    const custName = order.customer_name || 'Customer';

    const notifications = [];

    async function sendEmail(to, subject, body) {
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({ to, subject, body });
        return { to, sent: true };
      } catch (e) {
        return { to, sent: false, error: e.message };
      }
    }

    // Notify the driver when someone else sends the message
    if (sender_role !== 'driver' && driverEmail) {
      notifications.push(await sendEmail(
        driverEmail,
        `💬 New message on order ${orderNum}`,
        `Hi ${driverName},\n\n${senderLabel} sent you a new message on order #${orderNum}:\n\n"${msgPreview}"\n\nPlease log in to the Alcohol Delivered driver app to reply.\n\n— Alcohol Delivered`
      ));

      // Best-effort FCM push to the driver
      try {
        if (driverId) {
          const tokens = await base44.asServiceRole.entities.FCMToken.filter({ driver_id: driverId });
          if (tokens.length > 0) {
            await base44.asServiceRole.functions.invoke('sendFCMPush', {
              tokens: tokens.map(t => t.token),
              title: `💬 New message on ${orderNum}`,
              body: msgPreview.slice(0, 100),
              data: { order_id, order_number: orderNum, type: 'chat_message' },
            });
          }
        }
      } catch (pushError) {
        console.warn('Driver push failed:', pushError.message);
      }
    }

    // Notify the store when someone else sends the message
    if (sender_role !== 'store' && storeEmail && message.channel !== 'customer_driver') {
      notifications.push(await sendEmail(
        storeEmail,
        `💬 New message on order ${orderNum}`,
        `Hi ${storeName},\n\n${senderLabel} sent a new message on order #${orderNum}:\n\n"${msgPreview}"\n\nLog in to your partner dashboard to reply.\n\n— Alcohol Delivered`
      ));
    }

    // Notify the customer when someone else sends the message
    if (sender_role !== 'customer' && custEmail && message.channel !== 'store_driver') {
      notifications.push(await sendEmail(
        custEmail,
        `💬 New message on your order ${orderNum}`,
        `Hi ${custName},\n\n${senderLabel} sent you a message about your order #${orderNum}:\n\n"${msgPreview}"\n\nLog in to the Alcohol Delivered app to view and reply.\n\n— Alcohol Delivered`
      ));
    }

    console.log(`Message notification for ${orderNum}:`, JSON.stringify(notifications));
    return Response.json({ success: true, order_number: orderNum, notifications });
  } catch (error) {
    console.error('notifyMessageRecipient error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}