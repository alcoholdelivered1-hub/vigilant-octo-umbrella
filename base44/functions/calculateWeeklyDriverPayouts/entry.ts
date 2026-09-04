import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Auth: must be authenticated via platform (admin user or automation)
    const authenticated = await base44.auth.isAuthenticated().catch(() => false);
    if (!authenticated) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }
    const currentUser = await base44.auth.me().catch(() => null);
    if (currentUser && currentUser.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Calculate week: Mon–Sun ending this past week (run on Friday, covers Mon–Fri so far)
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun, 5=Fri
    const daysSinceMonday = (dayOfWeek + 6) % 7;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - daysSinceMonday);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(now);
    weekEnd.setHours(23, 59, 59, 999);

    const weekStartStr = weekStart.toISOString().split('T')[0];
    const weekEndStr = weekEnd.toISOString().split('T')[0];

    console.log(`Calculating payouts for week ${weekStartStr} to ${weekEndStr}`);

    // Fetch all delivered orders this week
    const allOrders = await base44.asServiceRole.entities.Order.list('-created_date', 500);
    const weekOrders = allOrders.filter(o =>
      o.status === 'delivered' &&
      o.driver_id &&
      new Date(o.created_date) >= weekStart &&
      new Date(o.created_date) <= weekEnd
    );

    if (weekOrders.length === 0) {
      console.log('No delivered orders found for this week.');
      return Response.json({ success: true, message: 'No deliveries this week', payouts_created: 0 });
    }

    // Group by driver
    const driverMap = {};
    for (const order of weekOrders) {
      const dId = order.driver_id;
      if (!driverMap[dId]) {
        driverMap[dId] = {
          driver_id: dId,
          driver_name: order.driver_name || '',
          orders: [],
        };
      }
      driverMap[dId].orders.push(order);
    }

    // Fetch driver emails
    const drivers = await base44.asServiceRole.entities.Driver.list();
    const driverEmailMap = {};
    for (const d of drivers) {
      driverEmailMap[d.id] = d.email || '';
    }

    let payoutsCreated = 0;
    let payoutsSkipped = 0;

    for (const [driverId, info] of Object.entries(driverMap)) {
      // Skip if a payout record already exists for this driver/week
      const existing = await base44.asServiceRole.entities.DriverPayout.filter({
        driver_id: driverId,
        week_start: weekStartStr,
      });
      if (existing && existing.length > 0) {
        console.log(`Payout already exists for driver ${driverId} week ${weekStartStr}, skipping.`);
        payoutsSkipped++;
        continue;
      }

      const orders = info.orders;
      const deliveryCount = orders.length;
      const deliveryFees = deliveryCount * 4.75; // $4.75 per delivery
      const tips = orders.reduce((s, o) => s + (o.tip || 0), 0);
      const mileageSurcharge = orders.reduce((s, o) => s + (o.mileage_surcharge || 0), 0);
      const totalAmount = deliveryFees + tips + mileageSurcharge;

      await base44.asServiceRole.entities.DriverPayout.create({
        driver_id: driverId,
        driver_name: info.driver_name,
        driver_email: driverEmailMap[driverId] || '',
        week_start: weekStartStr,
        week_end: weekEndStr,
        delivery_count: deliveryCount,
        delivery_fees: deliveryFees,
        tips: tips,
        mileage_surcharge: mileageSurcharge,
        total_amount: totalAmount,
        status: 'pending',
      });

      console.log(`Created payout for ${info.driver_name || driverId}: $${totalAmount.toFixed(2)} (${deliveryCount} deliveries)`);
      payoutsCreated++;
    }

    return Response.json({
      success: true,
      week_start: weekStartStr,
      week_end: weekEndStr,
      payouts_created: payoutsCreated,
      payouts_skipped: payoutsSkipped,
      drivers_processed: Object.keys(driverMap).length,
    });
  } catch (error) {
    console.error('calculateWeeklyDriverPayouts fatal error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});