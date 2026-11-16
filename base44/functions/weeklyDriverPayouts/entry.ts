/**
 * Scheduled weekly function (runs every Monday 6 AM CT) that:
 *  1. Finds all delivered orders from the previous Mon–Sun pay period
 *  2. Groups them by driver
 *  3. Calculates earnings: (deliveries × $3.00) + tips + mileage surcharge ($1/mile over 7 miles, kept entirely by driver)
 *  4. Creates a Stripe Connect transfer to each driver's Express account
 *  5. Saves a DriverPayout record for every driver (paid / skipped / failed)
 *
 * Triggered by a scheduled automation — not callable by regular users.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import Stripe from 'npm:stripe@17.4.0';
import { assertAdmin } from '../../shared/authGuard.ts';

const DELIVERY_FEE_CENTS = 300; // $3.00

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { authorized, response } = await assertAdmin(base44);
    if (!authorized) return response;

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

    // Determine last week's Mon–Sun window (US Central, approx UTC-5/6)
    const now = new Date();
    const dayOfWeek = now.getUTCDay(); // 0=Sun, 1=Mon
    const daysToLastMonday = dayOfWeek === 0 ? 6 : dayOfWeek + 6;
    const lastMonday = new Date(now);
    lastMonday.setUTCDate(now.getUTCDate() - daysToLastMonday);
    lastMonday.setUTCHours(6, 0, 0, 0); // 6 AM UTC ≈ 1 AM CT

    const lastSunday = new Date(lastMonday);
    lastSunday.setUTCDate(lastMonday.getUTCDate() + 6);
    lastSunday.setUTCHours(29, 59, 59, 999); // end of Sunday

    const weekStart = lastMonday.toISOString().slice(0, 10);
    const weekEnd = lastSunday.toISOString().slice(0, 10);

    console.log(`Processing payouts for week: ${weekStart} → ${weekEnd}`);

    // Fetch all delivered orders in the pay window
    const allOrders = await base44.asServiceRole.entities.Order.filter({ status: 'delivered' }, '-delivery_confirmed_at', 1000);
    const weekOrders = allOrders.filter(o => {
      const d = o.delivery_confirmed_at || o.updated_date;
      if (!d) return false;
      const ts = new Date(d);
      return ts >= lastMonday && ts <= lastSunday;
    });

    console.log(`Found ${weekOrders.length} delivered orders in period`);

    // Group by driver_id
    const byDriver = {};
    for (const order of weekOrders) {
      if (!order.driver_id) continue;
      if (!byDriver[order.driver_id]) {
        byDriver[order.driver_id] = {
          driver_id: order.driver_id,
          driver_name: order.driver_name || '',
          orders: [],
        };
      }
      byDriver[order.driver_id].orders.push(order);
    }

    // Fetch all driver user records to get their Stripe Connect account IDs
    const driverIds = Object.keys(byDriver);
    const allUsers = driverIds.length > 0
      ? await base44.asServiceRole.entities.User.list('-created_date', 500)
      : [];
    const userMap = {};
    for (const u of allUsers) {
      userMap[u.id] = u;
    }

    const results = [];

    for (const driverId of driverIds) {
      const { driver_name, orders } = byDriver[driverId];
      const driverUser = userMap[driverId];
      const driverEmail = driverUser?.email || '';
      const connectAccountId = driverUser?.stripe_connect_account_id;

      const deliveryCount = orders.length;
      const deliveryFees = deliveryCount * 3.00;
      const tips = orders.reduce((s, o) => s + (o.tip || 0), 0);
      // Mileage surcharge: $1/mile over 7 miles — kept entirely by the driver
      const mileageSurcharge = orders.reduce((s, o) => s + (o.mileage_surcharge || 0), 0);
      const totalAmount = deliveryFees + tips + mileageSurcharge;
      const totalCents = Math.round(totalAmount * 100);

      // Skip if nothing to pay
      if (totalCents <= 0) {
        results.push({ driver_id: driverId, status: 'skipped', reason: 'zero earnings' });
        continue;
      }

      // Check if a payout record already exists for this week (idempotency)
      const existing = await base44.asServiceRole.entities.DriverPayout.filter({
        driver_id: driverId,
        week_start: weekStart,
      });
      if (existing.length > 0 && existing[0].status === 'paid') {
        console.log(`Skipping ${driverEmail} — already paid for ${weekStart}`);
        results.push({ driver_id: driverId, status: 'already_paid' });
        continue;
      }

      let payoutRecord = {
        driver_id: driverId,
        driver_email: driverEmail,
        driver_name,
        week_start: weekStart,
        week_end: weekEnd,
        delivery_count: deliveryCount,
        delivery_fees: deliveryFees,
        tips,
        mileage_surcharge: mileageSurcharge,
        total_amount: totalAmount,
        stripe_connect_account_id: connectAccountId || null,
        description: mileageSurcharge > 0
          ? `Includes $${mileageSurcharge.toFixed(2)} mileage bonus ($1/mile over 7 miles) kept entirely by driver.`
          : undefined,
      };

      // Skip if no Stripe Connect account
      if (!connectAccountId) {
        console.log(`Driver ${driverEmail} has no Stripe Connect account — skipping payout`);
        await base44.asServiceRole.entities.DriverPayout.create({
          ...payoutRecord,
          status: 'skipped',
          error_message: 'No Stripe Connect account linked. Driver must complete onboarding.',
        });
        results.push({ driver_id: driverId, status: 'skipped', reason: 'no_connect_account' });
        continue;
      }

      // Check that Connect account has completed onboarding
      try {
        const account = await stripe.accounts.retrieve(connectAccountId);
        if (!account.charges_enabled || !account.payouts_enabled) {
          await base44.asServiceRole.entities.DriverPayout.create({
            ...payoutRecord,
            status: 'skipped',
            error_message: 'Stripe Connect account not fully verified.',
          });
          results.push({ driver_id: driverId, status: 'skipped', reason: 'account_not_verified' });
          continue;
        }
      } catch (err) {
        console.error(`Failed to retrieve Stripe account for ${driverEmail}:`, err.message);
      }

      // Execute the transfer
      try {
        const transfer = await stripe.transfers.create({
          amount: totalCents,
          currency: 'usd',
          destination: connectAccountId,
          description: `SipSwift driver earnings: week of ${weekStart}`,
          metadata: {
            driver_id: driverId,
            driver_email: driverEmail,
            week_start: weekStart,
            delivery_count: String(deliveryCount),
            mileage_surcharge: mileageSurcharge.toFixed(2),
            base44_app_id: Deno.env.get('BASE44_APP_ID'),
          },
        });

        await base44.asServiceRole.entities.DriverPayout.create({
          ...payoutRecord,
          status: 'paid',
          stripe_transfer_id: transfer.id,
          paid_at: new Date().toISOString(),
        });

        console.log(`Paid $${totalAmount.toFixed(2)} to ${driverEmail} (transfer: ${transfer.id})`);
        results.push({ driver_id: driverId, email: driverEmail, status: 'paid', amount: totalAmount, transfer_id: transfer.id });

      } catch (stripeErr) {
        console.error(`Stripe transfer failed for ${driverEmail}:`, stripeErr.message);
        await base44.asServiceRole.entities.DriverPayout.create({
          ...payoutRecord,
          status: 'failed',
          error_message: stripeErr.message,
        });
        results.push({ driver_id: driverId, email: driverEmail, status: 'failed', error: stripeErr.message });
      }
    }

    return Response.json({
      success: true,
      week_start: weekStart,
      week_end: weekEnd,
      processed: results.length,
      results,
    });

  } catch (error) {
    console.error('weeklyDriverPayouts fatal error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});