import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const order = payload.data;
    const oldData = payload.old_data;

    if (!order?.driver_id) {
      return Response.json({ skipped: 'no driver assigned' });
    }

    // Only fire when driver_id is newly set on this order
    if (oldData?.driver_id === order.driver_id) {
      return Response.json({ skipped: 'driver already assigned, no change' });
    }

    const distanceMiles = parseFloat(order.distance_miles) || 0;
    if (distanceMiles <= 7) {
      return Response.json({ skipped: `Distance ${distanceMiles.toFixed(1)} mi is within 7-mile threshold` });
    }

    const extraMiles = distanceMiles - 7;
    const bonusPay = parseFloat((extraMiles * 1.0).toFixed(2));

    console.log(`Mileage bonus triggered: order=${order.order_number}, distance=${distanceMiles}mi, bonus=$${bonusPay}`);

    // Look up driver info and FCM tokens in parallel
    const [drivers, fcmTokens] = await Promise.all([
      base44.asServiceRole.entities.Driver.filter({ id: order.driver_id }, 'name', 1),
      base44.asServiceRole.entities.FCMToken.filter({ driver_id: order.driver_id }, 'created_date', 10),
    ]);

    const driver = drivers[0];
    const pushTitle = `🛣️ Mileage Bonus: +$${bonusPay.toFixed(2)}`;
    const pushBody = `Order ${order.order_number} is ${distanceMiles.toFixed(1)} mi away — you earn $${bonusPay.toFixed(2)} extra in mileage pay!`;

    // Send FCM push to all registered driver devices
    const pushPromises = fcmTokens.map(tokenRecord =>
      base44.asServiceRole.functions.invoke('sendFCMPush', {
        token: tokenRecord.token,
        title: pushTitle,
        body: pushBody,
      }).catch(e => console.warn(`FCM push failed for token ${tokenRecord.token}: ${e.message}`))
    );
    await Promise.all(pushPromises);

    // Send email notification to driver
    if (driver?.email) {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: driver.email,
        subject: `🛣️ Long Route Bonus — Order ${order.order_number}`,
        body: `Hi ${driver.name || 'Driver'},

Great news! You've been assigned a delivery that qualifies for a mileage bonus.

📦 Order: ${order.order_number}
📍 Distance: ${distanceMiles.toFixed(1)} miles
🛣️ Miles over threshold: ${extraMiles.toFixed(1)} miles (${distanceMiles.toFixed(1)} – 7)
💵 Mileage Bonus: +$${bonusPay.toFixed(2)} (extra $1.00/mile over 7 miles)

This bonus is paid directly to you on top of your standard $4.75 delivery fee${order.tip > 0 ? ` and the $${parseFloat(order.tip).toFixed(2)} customer tip` : ''}.

Deliver to: ${order.delivery_address}

Safe driving!
The Sandi's Spirits Team`,
      });
    }

    return Response.json({
      success: true,
      driver_name: driver?.name,
      distance_miles: distanceMiles,
      extra_miles: extraMiles,
      bonus_pay: bonusPay,
      push_notifications_sent: fcmTokens.length,
      email_sent: !!driver?.email,
    });

  } catch (error) {
    console.error('notifyDriverMileageBonus error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});