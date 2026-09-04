import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const { data: order, old_data } = payload;

    if (!order) {
      return Response.json({ skipped: true, reason: 'No order data' });
    }

    // Only fire when a driver is newly assigned (driver_id changed from empty to set)
    const driverAssigned = order.driver_id && order.driver_id !== old_data?.driver_id;
    if (!driverAssigned) {
      return Response.json({ skipped: true, reason: 'No new driver assignment' });
    }

    // Look up the driver record by entity ID (autoDispatchOrder sets driver_id to the Driver entity ID)
    let driver = null;
    try {
      driver = await base44.asServiceRole.entities.Driver.get(order.driver_id);
    } catch {
      // Fallback: try matching by email (some legacy orders may store email instead of ID)
      const drivers = await base44.asServiceRole.entities.Driver.filter({ email: order.driver_id });
      driver = drivers[0];
    }

    if (!driver?.email) {
      return Response.json({ skipped: true, reason: 'Driver email not found' });
    }

    const subject = '🚚 New Pickup Task Assigned';
    const body = `Hi ${driver.name || 'Driver'},

You have been assigned a new delivery!

Order #: ${order.order_number}
Store: ${order.store_name}
Pickup Address: Contact store for address
Delivery Address: ${order.delivery_address}
Order Total: $${order.total?.toFixed(2)}
Customer: ${order.customer_name}
Customer Phone: ${order.customer_phone || 'On file'}

Please open the Driver Portal to view full order details and confirm pickup.

⚠️ Reminder: You must verify the customer's government-issued ID at delivery.

— Alcohol Delivered`;

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: driver.email,
      subject,
      body,
    });

    // FCM push notification to driver
    const fcmTokens = await base44.asServiceRole.entities.FCMToken.filter({ driver_id: order.driver_id });
    if (fcmTokens.length > 0) {
      const tokens = fcmTokens.map(t => t.token);
      const fcmRes = await base44.asServiceRole.functions.invoke('sendFCMPush', {
        tokens,
        title: '🚚 New Delivery Assigned',
        body: `Order #${order.order_number} from ${order.store_name} — ${order.delivery_address}`,
        data: { order_id: order.id, order_number: order.order_number, type: 'driver_assignment' },
      });
      console.log('FCM push result:', JSON.stringify(fcmRes));
    } else {
      console.log('No FCM tokens for driver — push skipped');
    }

    console.log(`Sent assignment notification to driver ${driver.email} for order ${order.order_number}`);

    return Response.json({ success: true, driver: driver.email, order: order.order_number });
  } catch (error) {
    console.error('Error notifying driver:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});