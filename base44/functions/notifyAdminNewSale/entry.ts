/**
 * Sends an instant FCM push notification to all admin devices
 * when a new order (sale) is created.
 *
 * Triggered automatically by the "New Sale Push Alert" workflow
 * on Order entity creation.
 *
 * Payload: { data: { ...order fields } }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { sendFCMToTokens } from '../../shared/fcmUtils.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const order = body.data || body.order;

    if (!order) {
      return Response.json({ error: 'No order data provided' }, { status: 400 });
    }

    // Get all admin users
    const users = await base44.asServiceRole.entities.User.list('-created_date', 500);
    const adminEmails = users
      .filter(u => u.role === 'admin' && u.email)
      .map(u => u.email);

    if (adminEmails.length === 0) {
      return Response.json({ skipped: true, reason: 'No admin users found' });
    }

    // Look up FCM tokens for all admin emails
    let fcmTokens = [];
    for (const email of adminEmails) {
      const records = await base44.asServiceRole.entities.FCMToken.filter({ user_email: email });
      fcmTokens.push(...records.map(r => r.token));
    }

    if (fcmTokens.length === 0) {
      console.log('No FCM tokens registered for admin users — skipping push. Admin must open the app on their phone to register.');
      return Response.json({
        skipped: true,
        reason: 'No FCM tokens registered for admins. Open the app on your phone and allow notifications to register your device.'
      });
    }

    const title = '🍺 New Sale!';
    const msgBody = `Order ${order.order_number || ''} — $${(order.total || 0).toFixed(2)} from ${order.store_name || 'a store'}`;

    const results = await sendFCMToTokens(fcmTokens, title, msgBody, {
      order_id: order.id || '',
      order_number: order.order_number || '',
      total: String(order.total || 0),
      store_name: order.store_name || '',
      type: 'new_sale',
    });

    console.log(`New sale push sent: ${fcmTokens.length} admin device(s) notified for order ${order.order_number || order.id}`);
    return Response.json({
      success: true,
      tokens_targeted: fcmTokens.length,
      admin_emails: adminEmails,
      results
    });
  } catch (error) {
    console.error('notifyAdminNewSale error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}