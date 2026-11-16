import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { assertAdmin } from '../../shared/authGuard.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json().catch(() => ({}));
    const { authorized, response } = await assertAdmin(base44);
    if (!authorized) return response;

    const svc = base44.asServiceRole;

    // Date range: last 7 days
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekAgoISO = weekAgo.toISOString();

    // Fetch data
    const [orders, drivers, verifications] = await Promise.all([
      svc.entities.Order.list('-created_date', 500),
      svc.entities.Driver.list(),
      svc.entities.IDVerification.list('-created_date', 1000),
    ]);

    const weekOrders = orders.filter(o => o.created_date && new Date(o.created_date) >= weekAgo);
    const deliveredOrders = weekOrders.filter(o => o.status === 'delivered');
    const refusedOrders = weekOrders.filter(o => o.status === 'refused');

    // --- Build flags ---
    const flaggedOrders = [];

    for (const order of weekOrders) {
      if (order.status === 'cancelled') continue;

      const orderFlags = [];

      // Missing checkout ID verification
      const hasCheckoutVerif = verifications.some(
        v => v.order_id === order.id && v.verification_type === 'checkout' && v.is_verified
      );
      if (!hasCheckoutVerif && ['confirmed','preparing','pickup_ready','in_transit','delivered'].includes(order.status)) {
        orderFlags.push('Missing Checkout ID Verification');
      }

      // Missing delivery ID verification
      const hasDeliveryVerif = verifications.some(
        v => v.order_id === order.id && v.verification_type === 'delivery' && v.is_verified
      );
      if (!hasDeliveryVerif && order.status === 'delivered') {
        orderFlags.push('Missing Delivery ID Verification');
      }

      // Dry county / illegal zone
      if (order.is_in_legal_zone === false) {
        orderFlags.push('Dry County / Illegal Zone Delivery');
      }

      // Uncertified driver
      if (order.driver_id) {
        const driver = drivers.find(d => d.id === order.driver_id);
        if (driver && !driver.training_completed) {
          orderFlags.push(`Driver Not ACT 157 Certified (${driver.name})`);
        }
      }

      if (orderFlags.length > 0) {
        flaggedOrders.push({ order, flags: orderFlags });
      }
    }

    // --- Driver compliance ---
    const activeDrivers = drivers.filter(d => d.is_active && d.status !== 'suspended');
    const certifiedDrivers = activeDrivers.filter(d => d.training_completed);
    const uncertifiedDrivers = activeDrivers.filter(d => !d.training_completed);

    // --- Build email body ---
    const reportDate = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const weekStart = weekAgo.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const weekEnd = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    const flagRows = flaggedOrders.map(({ order, flags }) =>
      `  • Order ${order.order_number || order.id.slice(-8)} (${order.customer_name}, ${order.status}): ${flags.join('; ')}`
    ).join('\n') || '  ✅ No compliance flags this week.';

    const uncertRows = uncertifiedDrivers.map(d => `  • ${d.name} (${d.email})`).join('\n') || '  ✅ All active drivers are certified.';

    const emailBody = `
ALCOHOL DELIVERED, LLC
Weekly ABC Compliance Report
Generated: ${reportDate}
Period: ${weekStart} – ${weekEnd}
────────────────────────────────────────────────

EXECUTIVE SUMMARY
─────────────────
Total Orders This Week:        ${weekOrders.length}
Delivered:                     ${deliveredOrders.length}
Refused (ACT 157 compliance):  ${refusedOrders.length}
Compliance Flags:              ${flaggedOrders.length}
Active Drivers:                ${activeDrivers.length}
Certified Drivers (ACT 157):   ${certifiedDrivers.length} / ${activeDrivers.length} (${activeDrivers.length > 0 ? Math.round((certifiedDrivers.length / activeDrivers.length) * 100) : 0}%)


COMPLIANCE FLAGS — ORDERS REQUIRING REVIEW
────────────────────────────────────────────
${flagRows}


UNCERTIFIED DRIVERS (ACT 157 §3-4-1106)
─────────────────────────────────────────
${uncertRows}


ID VERIFICATION SUMMARY
────────────────────────
Checkout Verifications (this week): ${verifications.filter(v => v.verification_type === 'checkout' && new Date(v.created_date) >= weekAgo).length}
Delivery Verifications (this week): ${verifications.filter(v => v.verification_type === 'delivery' && new Date(v.created_date) >= weekAgo).length}


REFUSED DELIVERIES LOG
───────────────────────
${refusedOrders.length === 0
  ? '  ✅ No refused deliveries this week.'
  : refusedOrders.map(o => `  • ${o.order_number || o.id.slice(-8)}: ${o.customer_name} — ${o.refusal_reason || 'No reason recorded'}`).join('\n')
}


────────────────────────────────────────────────
This report is generated automatically each Friday by the Alcohol Delivered compliance system.
For questions: 870-209-9109 | alcohol-delivered.biz
Prepared for Arkansas Alcoholic Beverage Control (ABC) Division review.
© ${now.getFullYear()} Alcohol Delivered, LLC · Pine Bluff, AR · Jefferson County
`.trim();

    // Send to store manager / compliance officer
    const recipientEmail = Deno.env.get('STORE_MANAGER_EMAIL') || 'compliance@alcohol-delivered.biz';

    await svc.integrations.Core.SendEmail({
      to: recipientEmail,
      subject: `[ABC Compliance] Weekly Report — ${weekStart}–${weekEnd} · ${flaggedOrders.length} Flag${flaggedOrders.length !== 1 ? 's' : ''}`,
      body: emailBody,
      from_name: 'Alcohol Delivered Compliance',
    });

    console.log(`Weekly compliance report sent. Orders: ${weekOrders.length}, Flags: ${flaggedOrders.length}, Uncertified drivers: ${uncertifiedDrivers.length}`);

    return Response.json({
      success: true,
      period: `${weekStart}–${weekEnd}`,
      total_orders: weekOrders.length,
      flagged_orders: flaggedOrders.length,
      uncertified_drivers: uncertifiedDrivers.length,
      report_sent_to: recipientEmail,
    });
  } catch (error) {
    console.error('Weekly compliance report error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});