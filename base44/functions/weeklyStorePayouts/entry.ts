/**
 * Scheduled weekly function (runs every Monday 7 AM CT, after driver payouts)
 * that:
 *   1. Finds all delivered orders from the previous Mon–Sun pay period
 *   2. Groups them by store
 *   3. Calculates store revenue: subtotal + tax + alcohol_excise_tax
 *   4. Creates a Stripe Connect transfer to each store's Express account
 *   5. Saves a StorePayout record for every store (paid / skipped / failed)
 *
 * Money flow:
 *   - Store receives: subtotal + tax + alcohol_excise_tax
 *   - Driver receives: delivery_fee + tip + mileage_surcharge (handled by weeklyDriverPayouts)
 *   - Platform keeps: service_fee
 *
 * Triggered by a scheduled automation — not callable by regular users.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import Stripe from 'npm:stripe@17.4.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow both manual admin invocation and automated (workflow/scheduled) execution
    let currentUser = null;
    try { currentUser = await base44.auth.me(); } catch (_) { /* automated run — no user */ }
    if (currentUser && currentUser.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Optional: force payout for a specific store (used by credential-triggered workflows)
    const body = await req.json().catch(() => ({}));
    const forceStoreId = body.store_id || null;

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

    console.log(`Processing store payouts for week: ${weekStart} → ${weekEnd}`);

    // Fetch all delivered orders in the pay window
    const orderFilter = { status: 'delivered' };
    if (forceStoreId) orderFilter.store_id = forceStoreId;
    const allOrders = await base44.asServiceRole.entities.Order.filter(orderFilter, '-delivery_confirmed_at', 1000);
    const weekOrders = allOrders.filter(o => {
      const d = o.delivery_confirmed_at || o.updated_date;
      if (!d) return false;
      const ts = new Date(d);
      return ts >= lastMonday && ts <= lastSunday;
    });

    console.log(`Found ${weekOrders.length} delivered orders in period`);

    // Group by store_id
    const byStore = {};
    for (const order of weekOrders) {
      if (!order.store_id) continue;
      if (!byStore[order.store_id]) {
        byStore[order.store_id] = {
          store_id: order.store_id,
          store_name: order.store_name || '',
          store_email: '',
          orders: [],
        };
      }
      byStore[order.store_id].orders.push(order);
    }

    // Fetch store records to get Stripe Connect account IDs and emails
    const storeIds = Object.keys(byStore);
    const allStores = storeIds.length > 0
      ? await base44.asServiceRole.entities.Store.list('name', 500)
      : [];
    const storeMap = {};
    for (const s of allStores) {
      storeMap[s.id] = s;
    }

    const results = [];

    for (const storeId of storeIds) {
      const { store_name, orders } = byStore[storeId];
      const storeRecord = storeMap[storeId];
      const storeEmail = storeRecord?.email || '';
      const connectAccountId = storeRecord?.stripe_connect_account_id;

      const orderCount = orders.length;
      const grossRevenue = orders.reduce((s, o) => s + (o.subtotal || 0), 0);
      const taxCollected = orders.reduce((s, o) => s + (o.tax || 0) + (o.alcohol_excise_tax || 0), 0);
      const totalAmount = grossRevenue + taxCollected;
      const totalCents = Math.round(totalAmount * 100);

      const payoutRecord = {
        store_id: storeId,
        store_name,
        store_email: storeEmail,
        week_start: weekStart,
        week_end: weekEnd,
        order_count: orderCount,
        gross_revenue: grossRevenue,
        tax_collected: taxCollected,
        total_amount: totalAmount,
        stripe_connect_account_id: connectAccountId || null,
      };

      // Skip if nothing to pay
      if (totalCents <= 0) {
        results.push({ store_id: storeId, status: 'skipped', reason: 'zero revenue' });
        continue;
      }

      // Check if a payout record already exists for this week (idempotency)
      const existing = await base44.asServiceRole.entities.StorePayout.filter({
        store_id: storeId,
        week_start: weekStart,
      });
      if (existing.length > 0 && existing[0].status === 'paid') {
        console.log(`Skipping ${store_name} — already paid for ${weekStart}`);
        results.push({ store_id: storeId, status: 'already_paid' });
        continue;
      }

      // Skip if no Stripe Connect account
      if (!connectAccountId) {
        console.log(`Store ${store_name} has no Stripe Connect account — skipping payout`);
        await base44.asServiceRole.entities.StorePayout.create({
          ...payoutRecord,
          status: 'skipped',
          error_message: 'No Stripe Connect account linked. Retailer must complete onboarding.',
        });
        results.push({ store_id: storeId, status: 'skipped', reason: 'no_connect_account' });
        continue;
      }

      // Check that Connect account has completed onboarding
      try {
        const account = await stripe.accounts.retrieve(connectAccountId);
        if (!account.charges_enabled || !account.payouts_enabled) {
          await base44.asServiceRole.entities.StorePayout.create({
            ...payoutRecord,
            status: 'skipped',
            error_message: 'Stripe Connect account not fully verified.',
          });
          results.push({ store_id: storeId, status: 'skipped', reason: 'account_not_verified' });
          continue;
        }
      } catch (err) {
        console.error(`Failed to retrieve Stripe account for ${store_name}:`, err.message);
      }

      // Execute the transfer
      try {
        const transfer = await stripe.transfers.create({
          amount: totalCents,
          currency: 'usd',
          destination: connectAccountId,
          description: `SipSwift store revenue: week of ${weekStart}`,
          metadata: {
            store_id: storeId,
            store_name: storeName,
            week_start: weekStart,
            order_count: String(orderCount),
            base44_app_id: Deno.env.get('BASE44_APP_ID'),
          },
        });

        await base44.asServiceRole.entities.StorePayout.create({
          ...payoutRecord,
          status: 'paid',
          stripe_transfer_id: transfer.id,
          paid_at: new Date().toISOString(),
        });

        console.log(`Paid $${totalAmount.toFixed(2)} to ${store_name} (transfer: ${transfer.id})`);
        results.push({ store_id: storeId, store_name, status: 'paid', amount: totalAmount, transfer_id: transfer.id });

      } catch (stripeErr) {
        console.error(`Stripe transfer failed for ${storeName}:`, stripeErr.message);
        await base44.asServiceRole.entities.StorePayout.create({
          ...payoutRecord,
          status: 'failed',
          error_message: stripeErr.message,
        });
        results.push({ store_id: storeId, store_name, status: 'failed', error: stripeErr.message });
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
    console.error('weeklyStorePayouts fatal error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});