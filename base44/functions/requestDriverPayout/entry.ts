import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

/**
 * Driver-initiated on-demand payout request.
 * Creates a PENDING DriverPayout record for the current week's completed
 * deliveries (Mon → now), flagged for admin approval on the Payouts Overview
 * page. Does NOT move money — only queues an approval record.
 *
 * Dedup: the Friday scheduled run (calculateWeeklyDriverPayouts) skips any
 * driver who already has a payout for the current week_start, so a driver who
 * requests early is not double-counted on Friday.
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Current week window (Monday 00:00 → now) — matches the Friday scheduled run.
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

    // This driver's delivered orders in the current week (user-scoped → RLS
    // returns only orders where driver_email == their email).
    const delivered = await base44.entities.Order.filter(
      { status: 'delivered' }, '-created_date', 500
    );
    const myOrders = delivered.filter(o =>
      o.driver_email === user.email &&
      new Date(o.created_date) >= weekStart &&
      new Date(o.created_date) <= weekEnd
    );

    if (myOrders.length === 0) {
      return Response.json({
        success: false,
        message: 'You have no completed deliveries to pay out this week yet.',
      });
    }

    // Use the driver_id value present on the orders (consistent with the
    // Friday run's dedup key, regardless of whether it's a Driver entity id
    // or user id).
    const driverId = myOrders[0].driver_id || user.id;
    const driverName = myOrders[0].driver_name || user.full_name;

    // Idempotency: a payout already queued for this driver/week?
    const existing = await base44.asServiceRole.entities.DriverPayout.filter({
      driver_id: driverId,
      week_start: weekStartStr,
    });
    if (existing && existing.length > 0) {
      const prior = existing[0];
      return Response.json({
        success: false,
        message: `You already have a ${prior.status} payout for the week of ${weekStartStr}.`,
        payout_id: prior.id,
        status: prior.status,
        total_amount: prior.total_amount,
      });
    }

    const deliveryCount = myOrders.length;
    const deliveryFees = deliveryCount * 3; // $3 per delivery
    const tips = myOrders.reduce((s, o) => s + (o.tip || 0), 0);
    const mileageSurcharge = myOrders.reduce((s, o) => s + (o.mileage_surcharge || 0), 0);
    const totalAmount = deliveryFees + tips + mileageSurcharge;

    if (totalAmount <= 0) {
      return Response.json({
        success: false,
        message: 'Nothing to pay out yet.',
      });
    }

    const payout = await base44.asServiceRole.entities.DriverPayout.create({
      driver_id: driverId,
      driver_name: driverName,
      driver_email: user.email,
      week_start: weekStartStr,
      week_end: weekEndStr,
      delivery_count: deliveryCount,
      delivery_fees: deliveryFees,
      tips,
      mileage_surcharge: mileageSurcharge,
      total_amount: totalAmount,
      status: 'pending',
      description: 'On-demand payout requested by driver — awaiting admin approval.',
    });

    console.log(`On-demand payout requested by ${user.email}: $${totalAmount.toFixed(2)} (${deliveryCount} deliveries, week of ${weekStartStr})`);

    return Response.json({
      success: true,
      message: 'Payout requested. An admin will review and approve it on the Payouts Overview page.',
      payout_id: payout.id,
      total_amount: totalAmount,
      delivery_count: deliveryCount,
      week_start: weekStartStr,
    });
  } catch (error) {
    console.error('requestDriverPayout error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}