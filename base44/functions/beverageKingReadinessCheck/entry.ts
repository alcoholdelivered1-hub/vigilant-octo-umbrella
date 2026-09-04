/**
 * beverageKingReadinessCheck
 * Admin-only. PURE READ-ONLY diagnostic for Beverage King go-live readiness.
 *
 * Does NOT contact the retailer. Does NOT create, update, refund, void, or
 * delete any record, order, charge, or Clover object. Every external call is a
 * GET (Clover) or a retrieve (Stripe). No entity writes anywhere.
 *
 * POST body: { store_id?: string, driver_id?: string }  (defaults to
 * Beverage King store + the known Justin Bess driver id).
 *
 * Reports the exact blockers preventing one controlled test order.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import Stripe from 'npm:stripe@17.4.0';
import {
  resolveCloverCredentials,
  assertMerchantScopedToken,
  findActiveCloverEnvironment,
  autoDiscoverMerchantId,
} from '../../shared/cloverCredentials.ts';

const BEVERAGE_KING_STORE_ID = '6a32d14d09b760f592dbf19e';
const JUSTIN_DRIVER_ID = '6a5e1ad1bf14297b3613d055';

function ctNow() {
  // Current time in America/Chicago as a Date-like object with day-of-week + HH:MM.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const get = (t) => parts.find(p => p.type === t)?.value;
  return { weekday: get('weekday'), hhmm: get('hour') + ':' + get('minute') };
}

function toMinutes(hhmm) {
  if (!hhmm || !hhmm.includes(':')) return null;
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function isOpenNow(store) {
  const now = ctNow();
  const cur = toMinutes(now.hhmm);
  if (cur === null) return { open: null, reason: 'cannot determine current time' };
  const day = now.weekday; // Mon..Sun short
  let start, end, closed;
  if (day === 'Sat') {
    start = toMinutes(store.saturday_hours_start);
    end = toMinutes(store.saturday_hours_end);
    closed = false;
  } else if (day === 'Sun') {
    closed = store.sunday_closed !== false; // default true
    start = toMinutes(store.sunday_hours_start);
    end = toMinutes(store.sunday_hours_end);
  } else {
    start = toMinutes(store.operating_hours_start);
    end = toMinutes(store.operating_hours_end);
    closed = false;
  }
  if (closed) return { open: false, reason: 'closed on Sunday', day, current_time: now.hhmm };
  if (start == null || end == null) return { open: null, reason: 'hours not configured for today', day, current_time: now.hhmm };
  // Handle overnight end (e.g. 01:00 = 60, less than start 07:00=420) -> end is next day
  let openNow;
  if (end > start) {
    openNow = cur >= start && cur < end;
  } else {
    // overnight window: from start to midnight, OR midnight to end
    openNow = cur >= start || cur < end;
  }
  return { open: openNow, day, current_time: now.hhmm, hours: `${store.operating_hours_start||'??'}–${store.operating_hours_end||'??'}` };
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const storeId = body.store_id || BEVERAGE_KING_STORE_ID;
    const driverId = body.driver_id || JUSTIN_DRIVER_ID;

    // ---------- DB reads (all read-only) ----------
    const store = await base44.asServiceRole.entities.Store.get(storeId);

    const creds = await base44.asServiceRole.entities.StorePosCredential.filter(
      { store_id: storeId }, 'name', 50
    );
    const cred = creds[0] || null;

    const products = await base44.asServiceRole.entities.Product.filter(
      { store_id: storeId }, '-updated_date', 1000
    );

    const orders = await base44.asServiceRole.entities.Order.filter(
      { store_id: storeId }, '-created_date', 50
    );

    const cloverPosOrders = await base44.asServiceRole.entities.CloverPosOrder.filter(
      { store_id: storeId }, '-created_date', 50
    );

    const invConfigs = await base44.asServiceRole.entities.InventorySyncConfig.list('name', 10);
    const invConfig = invConfigs[0] || null;

    let driver = null;
    try { driver = await base44.asServiceRole.entities.Driver.get(driverId); } catch (_) {}

    const fcmTokens = await base44.asServiceRole.entities.FCMToken.list('name', 200);

    // ---------- Store status / hours ----------
    const openState = store ? isOpenNow(store) : null;

    // ---------- Clover connection (read-only) ----------
    let clover = {
      environment: cred?.environment || null,
      stored_merchant_id: cred?.merchant_id || null,
      credential_token_present: !!(cred && cred.api_token && cred.api_token.trim()),
      is_configured: cred?.is_configured || false,
      token_source: null,
      token_authenticates: false,
      merchant_name: null,
      live_item_count: null,
      live_order_count_30d: null,
      reason: null,
    };

    const resolved = await resolveCloverCredentials(base44, storeId);
    clover.token_source = resolved.tokenSource;

    if (resolved.apiToken) {
      const targetMerchantId = resolved.credMerchantId || resolved.merchantId;
      const auth = await assertMerchantScopedToken(resolved.apiToken, targetMerchantId);
      clover.token_authenticates = auth.ok;
      clover.merchant_name = auth.merchantName || null;
      clover.environment = auth.environment || clover.environment;
      clover.reason = auth.reason || null;

      if (auth.ok) {
        // Live read-only: item count
        try {
          const env = await findActiveCloverEnvironment(resolved.apiToken, targetMerchantId);
          if (env.baseUrl) {
            const headers = { Authorization: `Bearer ${resolved.apiToken}`, 'Content-Type': 'application/json' };
            let count = 0, offset = 0, guard = 0;
            while (guard < 300) {
              const r = await fetch(`${env.baseUrl}/items?limit=200&offset=${offset}`, { headers });
              if (!r.ok) break;
              const d = await r.json();
              const arr = d.elements || [];
              count += arr.length;
              if (arr.length < 200) break;
              offset += 200; guard++;
            }
            clover.live_item_count = count;

            // Live read-only: recent order count (last 30d). GET only, NO save.
            const sinceMs = Date.now() - 30 * 24 * 60 * 60 * 1000;
            const or = await fetch(`${env.baseUrl}/orders?limit=100&offset=0&filter=createdTime>${sinceMs}`, { headers });
            if (or.ok) {
              const od = await or.json();
              clover.live_order_count_30d = (od.elements || []).length;
            }
          }
        } catch (e) {
          clover.reason = clover.reason || e.message;
        }
      }
    } else {
      clover.reason = 'No Clover API token configured for this store (credential token empty and no env fallback)';
    }

    // ---------- Stripe Connect account (read-only retrieve) ----------
    let stripe = { connect_account_id: store?.stripe_connect_account_id || null, charges_enabled: null, payouts_enabled: null, details_submitted: null, requirements_pending: [], disabled_reason: null, error: null };
    try {
      if (store?.stripe_connect_account_id) {
        const stripeClient = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
        const acct = await stripeClient.accounts.retrieve(store.stripe_connect_account_id);
        stripe.charges_enabled = acct.charges_enabled;
        stripe.payouts_enabled = acct.payouts_enabled;
        stripe.details_submitted = acct.details_submitted;
        stripe.requirements_pending = acct.requirements?.currently_due || [];
        stripe.disabled_reason = acct.requirements?.disabled_reason || null;
      } else {
        stripe.error = 'No Stripe Connect account id on store';
      }
    } catch (e) {
      stripe.error = e.message;
    }

    // ---------- Notifications (read-only: presence of FCM tokens) ----------
    const adminTokens = fcmTokens.filter(t => t.user_role === 'admin');
    const driverTokens = fcmTokens.filter(t => t.driver_id === driverId || t.user_email === driver?.email);
    const storeTokens = fcmTokens.filter(t => t.store_id === storeId || t.user_email === store?.email);
    const notifications = {
      admin_push_registered: adminTokens.length > 0,
      admin_token_count: adminTokens.length,
      driver_push_registered: driverTokens.length > 0,
      driver_token_count: driverTokens.length,
      retailer_push_registered: storeTokens.length > 0,
      retailer_token_count: storeTokens.length,
      email_backend_functions_deployed: true, // notifyRetailerNewOrder, notifyDriverPickupReady, notifyAdminNewSale exist
    };

    // ---------- Orders: clover order id + waiting to push ----------
    const lastOrder = orders[0] || null;
    const waitingToPush = orders.filter(o => !o.clover_order_id);

    // ---------- Blockers ----------
    const blockers = [];
    if (!store) blockers.push('Beverage King store record not found');
    if (store && !store.is_active) blockers.push('Store is_active = false');
    if (store && store.compliance_status !== 'compliant') blockers.push(`Store compliance_status = ${store.compliance_status}`);
    if (!resolved.apiToken) blockers.push('No Clover API token configured (credential token empty, no env fallback)');
    if (resolved.apiToken && !clover.token_authenticates) blockers.push('Clover token does not authenticate for Beverage King\'s merchant — merchant-specific OAuth/token missing');
    if (stripe.charges_enabled === false) blockers.push('Stripe Connect charges_enabled = false');
    if (stripe.payouts_enabled === false) blockers.push('Stripe Connect payouts_enabled = false');
    if (stripe.details_submitted === false) blockers.push('Stripe Connect onboarding (details_submitted) not complete');
    if (!driver) blockers.push('Justin Bess driver record not found');
    if (driver && driver.status !== 'available') blockers.push(`Justin Bess status = ${driver.status} (not 'available')`);
    if (driver && !driver.is_active) blockers.push('Justin Bess is_active = false');
    if (driver && !driver.training_completed) blockers.push('Justin Bess alcohol-safety training not completed');
    if (!notifications.admin_push_registered) blockers.push('No admin FCM push token registered (admin sale alert would not fire)');
    if (!notifications.driver_push_registered) blockers.push('No FCM push token registered for Justin Bess');
    if (products.length === 0) blockers.push('Beverage King has 0 products in catalog');
    if (lastOrder && !lastOrder.clover_order_id && lastOrder.stripe_payment_status !== 'paid') blockers.push(`Last order ${lastOrder.order_number} is not paid on Stripe and has no Clover order id`);

    return Response.json({
      generated_at: new Date().toISOString(),
      store: {
        id: store?.id, name: store?.name, is_active: store?.is_active,
        compliance_status: store?.compliance_status,
        onboarding_status: store?.onboarding_status,
        open_now: openState,
        configured_hours: {
          weekday: `${store?.operating_hours_start || '—'} – ${store?.operating_hours_end || '—'}`,
          saturday: `${store?.saturday_hours_start || '—'} – ${store?.saturday_hours_end || '—'}`,
          sunday_closed: store?.sunday_closed,
          sunday: store?.sunday_closed ? 'closed' : `${store?.sunday_hours_start || '—'} – ${store?.sunday_hours_end || '—'}`,
        },
      },
      clover: {
        environment: clover.environment,
        stored_merchant_id: clover.stored_merchant_id,
        credential_token_present: clover.credential_token_present,
        is_configured: clover.is_configured,
        token_source: clover.token_source,
        token_authenticates: clover.token_authenticates,
        connected_merchant_name: clover.merchant_name,
        reason: clover.reason,
        live_item_count: clover.live_item_count,
        live_order_count_30d: clover.live_order_count_30d,
      },
      inventory: {
        db_product_count: products.length,
        inventory_sync_config_last_synced_at: invConfig?.last_synced_at || null,
        inventory_sync_last_status: invConfig?.last_sync_status || null,
        last_product_updated: products[0]?.updated_date || null,
      },
      orders: {
        recent_clover_pos_orders_recorded: cloverPosOrders.length,
        last_alcohol_delivered_order: lastOrder ? {
          order_number: lastOrder.order_number,
          status: lastOrder.status,
          stripe_payment_status: lastOrder.stripe_payment_status,
          has_clover_order_id: !!lastOrder.clover_order_id,
          clover_order_id: lastOrder.clover_order_id || null,
          created_date: lastOrder.created_date,
        } : null,
        orders_waiting_to_push_to_clover: waitingToPush.length,
        waiting_order_numbers: waitingToPush.slice(0, 5).map(o => o.order_number),
      },
      stripe: {
        connect_account_id: stripe.connect_account_id,
        charges_enabled: stripe.charges_enabled,
        payouts_enabled: stripe.payouts_enabled,
        details_submitted: stripe.details_submitted,
        requirements_pending: stripe.requirements_pending,
        disabled_reason: stripe.disabled_reason,
        error: stripe.error,
      },
      driver: {
        id: driver?.id, name: driver?.name, email: driver?.email,
        status: driver?.status, is_active: driver?.is_active,
        training_completed: driver?.training_completed,
        background_check_status: driver?.background_check_status,
      },
      notifications,
      blockers,
      ready_for_controlled_test_order: blockers.length === 0,
    });
  } catch (error) {
    console.error('[beverageKingReadinessCheck] error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}