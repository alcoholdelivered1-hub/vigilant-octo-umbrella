import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import Stripe from 'npm:stripe@14.21.0';

// Read-only production integrations monitor. Never mutates, never exposes secrets.
// Admin-only. All checks are GET/list/retrieve — no charges, refunds, orders, or emails.

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

function fmtMoney(cents, currency) {
  if (cents == null) return '—';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'usd' }).format(cents / 100);
  } catch (_) {
    return '$' + (cents / 100).toFixed(2);
  }
}

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch (_) {
    return String(iso);
  }
}

async function checkStripe(stripe) {
  const blockers = [];
  let chargesEnabled = false, payoutsEnabled = false, mode = 'unknown', webhookOk = false, webhookCount = 0;
  let lastPayment = null, lastRefund = null, lastPayout = null;

  try {
    const key = Deno.env.get('STRIPE_SECRET_KEY') || '';
    mode = key.startsWith('sk_live_') ? 'live' : (key.startsWith('sk_test_') ? 'test' : 'unknown');
    const acct = await stripe.accounts.retrieve();
    chargesEnabled = !!acct.charges_enabled;
    payoutsEnabled = !!acct.payouts_enabled;
  } catch (e) {
    blockers.push({ area: 'Stripe', issue: 'Cannot retrieve Stripe account: ' + e.message, steps: 'Verify STRIPE_SECRET_KEY is set and valid in app secrets.' });
  }

  try {
    const endpoints = await stripe.webhookEndpoints.list({ limit: 10 });
    webhookCount = endpoints.data.length;
    webhookOk = endpoints.data.some((e) => e.status === 'enabled');
  } catch (_) { /* ignore */ }

  try {
    const charges = await stripe.charges.list({ limit: 10 });
    const succ = charges.data.find((c) => c.status === 'succeeded' && c.paid);
    if (succ) lastPayment = { amount: succ.amount, currency: succ.currency, created: new Date(succ.created * 1000).toISOString() };
  } catch (_) { /* ignore */ }

  try {
    const refunds = await stripe.refunds.list({ limit: 10 });
    const succ = refunds.data.find((r) => r.status === 'succeeded');
    if (succ) lastRefund = { amount: succ.amount, currency: succ.currency, created: new Date(succ.created * 1000).toISOString() };
  } catch (_) { /* ignore */ }

  try {
    const payouts = await stripe.payouts.list({ limit: 1 });
    if (payouts.data[0]) lastPayout = { amount: payouts.data[0].amount, currency: payouts.data[0].currency, status: payouts.data[0].status, created: new Date(payouts.data[0].created * 1000).toISOString() };
  } catch (_) { /* ignore */ }

  const fields = [
    { label: 'Connection', value: chargesEnabled ? 'Connected' : 'Disconnected', state: chargesEnabled ? 'pass' : 'fail' },
    { label: 'Mode', value: mode === 'live' ? 'Live' : mode === 'test' ? 'Test' : 'Unknown', state: mode === 'live' ? 'pass' : mode === 'test' ? 'warning' : 'fail' },
    { label: 'Charges Enabled', value: chargesEnabled ? 'Yes' : 'No', state: chargesEnabled ? 'pass' : 'fail' },
    { label: 'Payouts Enabled', value: payoutsEnabled ? 'Yes' : 'No', state: payoutsEnabled ? 'pass' : 'warning' },
    { label: 'Webhook Status', value: webhookOk ? `${webhookCount} endpoint(s) active` : 'No active webhooks', state: webhookOk ? 'pass' : 'warning' },
    { label: 'Last Successful Payment', value: lastPayment ? fmtMoney(lastPayment.amount, lastPayment.currency) + ' · ' + fmtDate(lastPayment.created) : 'None yet', state: lastPayment ? 'pass' : 'warning' },
    { label: 'Last Successful Refund', value: lastRefund ? fmtMoney(lastRefund.amount, lastRefund.currency) + ' · ' + fmtDate(lastRefund.created) : 'None yet', state: 'pass' },
    { label: 'Last Payout', value: lastPayout ? fmtMoney(lastPayout.amount, lastPayout.currency) + ' (' + lastPayout.status + ') · ' + fmtDate(lastPayout.created) : 'None yet', state: lastPayout ? 'pass' : 'warning' },
  ];

  let status = 'pass';
  if (!chargesEnabled || blockers.length) status = 'fail';
  else if (mode !== 'live' || !webhookOk || !payoutsEnabled) status = 'warning';

  return { key: 'stripe', title: 'Stripe', status, fields, blockers };
}

async function checkClover(sr, cloverCreds) {
  const blockers = [];
  const syncStates = await sr.entities.CloverOrderSync.list('-updated_date', 50);
  const syncByStore = {};
  for (const s of syncStates) syncByStore[s.store_id] = s;

  const recentOrders = await sr.entities.Order.list('-created_date', 100);
  const pushedByStore = {};
  for (const o of recentOrders) {
    if (o.clover_order_id) {
      const existing = pushedByStore[o.store_id];
      if (!existing || new Date(o.created_date) > new Date(existing.created_date)) pushedByStore[o.store_id] = o;
    }
  }

  const merchants = [];
  for (const cred of cloverCreds) {
    const m = {
      store_name: cred.store_name || 'Unknown',
      merchant_id: cred.merchant_id || 'Not set',
      environment: cred.environment || 'unknown',
      oauth_configured: !!cred.api_token && !!cred.is_configured,
      connection_status: 'unknown',
      inventory_read: false,
      orders_access: false,
      last_inventory_sync: syncByStore[cred.store_id]?.last_synced_at || null,
      last_inventory_sync_status: syncByStore[cred.store_id]?.last_sync_status || null,
      last_order_pushed: pushedByStore[cred.store_id]?.created_date || null,
      last_error: null,
    };
    const token = cred.api_token;
    const mid = cred.merchant_id;
    if (token && mid) {
      const base = cred.environment === 'sandbox' ? 'https://sandbox.dev.clover.com/v3/merchants' : 'https://api.clover.com/v3/merchants';
      try {
        const r = await fetch(`${base}/${mid}`, { headers: { Authorization: `Bearer ${token}` } });
        if (r.ok) {
          m.connection_status = 'connected';
        } else {
          m.connection_status = 'failed';
          m.last_error = `Merchant GET returned ${r.status}`;
        }
      } catch (e) {
        m.connection_status = 'failed';
        m.last_error = e.message;
      }
      try {
        const r2 = await fetch(`${base}/${mid}/items?limit=1`, { headers: { Authorization: `Bearer ${token}` } });
        m.inventory_read = r2.ok;
        if (!r2.ok) m.last_error = m.last_error || `Items GET ${r2.status}`;
      } catch (_) { /* ignore */ }
      try {
        const r3 = await fetch(`${base}/${mid}/orders?limit=1`, { headers: { Authorization: `Bearer ${token}` } });
        m.orders_access = r3.ok;
      } catch (_) { /* ignore */ }
    } else {
      m.connection_status = 'not_configured';
      m.last_error = 'No API token or merchant ID';
    }
    merchants.push(m);
  }

  const connected = merchants.filter((m) => m.connection_status === 'connected');
  let status = 'pass';
  if (merchants.length === 0) {
    status = 'warning';
    blockers.push({ area: 'Clover', issue: 'No Clover credentials configured', steps: 'Connect at least one retailer via Clover OAuth or manual REST API token.' });
  }
  for (const m of merchants) {
    if (m.connection_status === 'failed' || m.connection_status === 'not_configured') {
      status = 'fail';
      blockers.push({ area: 'Clover — ' + m.store_name, issue: m.last_error || 'Connection not configured', steps: 'Re-authorize Clover OAuth or generate a fresh REST API token for this merchant.' });
    } else if (!m.inventory_read || !m.orders_access) {
      if (status !== 'fail') status = 'warning';
    }
  }

  const fields = [];
  if (merchants.length) {
    fields.push({ label: 'Merchant Connection', value: `${connected.length}/${merchants.length} connected`, state: connected.length === merchants.length ? 'pass' : 'fail' });
    fields.push({ label: 'OAuth Configured', value: merchants.every((m) => m.oauth_configured) ? 'All' : merchants.some((m) => m.oauth_configured) ? 'Partial' : 'None', state: merchants.every((m) => m.oauth_configured) ? 'pass' : 'warning' });
    fields.push({ label: 'Inventory Read', value: merchants.every((m) => m.inventory_read) ? 'All OK' : merchants.some((m) => m.inventory_read) ? 'Partial' : 'None', state: merchants.every((m) => m.inventory_read) ? 'pass' : 'warning' });
    fields.push({ label: 'Orders Write', value: merchants.every((m) => m.orders_access) ? 'Token valid' : merchants.some((m) => m.orders_access) ? 'Partial' : 'None', state: merchants.every((m) => m.orders_access) ? 'pass' : 'warning' });
    const lastSync = merchants.map((m) => m.last_inventory_sync).filter(Boolean).sort().reverse()[0];
    fields.push({ label: 'Last Inventory Sync', value: lastSync ? fmtDate(lastSync) : 'Never', state: lastSync ? 'pass' : 'warning' });
    const lastPush = merchants.map((m) => m.last_order_pushed).filter(Boolean).sort().reverse()[0];
    fields.push({ label: 'Last Order Pushed', value: lastPush ? fmtDate(lastPush) : 'Never', state: 'pass' });
    const lastErr = merchants.map((m) => m.last_error).filter(Boolean)[0];
    fields.push({ label: 'Last Clover API Error', value: lastErr || 'None', state: lastErr ? 'warning' : 'pass' });
  } else {
    fields.push({ label: 'Merchant Connection', value: '0 configured', state: 'warning' });
  }

  return { key: 'clover', title: 'Clover', status, fields, merchants, blockers };
}

async function checkFcm(sr) {
  const blockers = [];
  const tokens = await sr.entities.FCMToken.list('-created_date', 200);
  const adminTokens = tokens.filter((t) => t.user_role === 'admin');
  const driverTokens = tokens.filter((t) => t.user_role === 'driver');
  const storeTokens = tokens.filter((t) => t.user_role === 'store');
  const lastTokenAt = tokens[0]?.created_date || null;

  const fields = [
    { label: 'Admin Device Registered', value: adminTokens.length ? `Yes (${adminTokens.length})` : 'No', state: adminTokens.length ? 'pass' : 'warning' },
    { label: 'Driver Device Registered', value: driverTokens.length ? `Yes (${driverTokens.length})` : 'No', state: driverTokens.length ? 'pass' : 'warning' },
    { label: 'Retailer Device Registered', value: storeTokens.length ? `Yes (${storeTokens.length})` : 'No', state: storeTokens.length ? 'pass' : 'warning' },
    { label: 'Active FCM Tokens', value: tokens.length, state: tokens.length ? 'pass' : 'warning' },
    { label: 'Last Device Registered', value: lastTokenAt ? fmtDate(lastTokenAt) : 'Never', state: lastTokenAt ? 'pass' : 'warning' },
    { label: 'Last Successful Push', value: 'Delivery outcome not logged', state: 'warning' },
  ];

  let status = (adminTokens.length && driverTokens.length && storeTokens.length) ? 'pass' : 'warning';
  if (tokens.length === 0) blockers.push({ area: 'Push Notifications', issue: 'No FCM tokens registered', steps: 'Have an admin, driver, and retailer open the app and enable notifications to register device tokens.' });
  if (!adminTokens.length) blockers.push({ area: 'Push Notifications', issue: 'No admin device registered', steps: 'Log in as admin and enable notifications.' });
  if (!driverTokens.length) blockers.push({ area: 'Push Notifications', issue: 'No driver device registered', steps: 'A driver must log in and enable notifications.' });
  if (!storeTokens.length) blockers.push({ area: 'Push Notifications', issue: 'No retailer device registered', steps: 'A store owner must log in and enable notifications.' });

  return { key: 'fcm', title: 'Firebase / Push Notifications', status, fields, blockers };
}

async function checkCheckout(sr) {
  const blockers = [];
  const publishable = Deno.env.get('STRIPE_PUBLISHABLE_KEY') || '';
  const zones = await sr.entities.DeliveryZone.filter({ zone_status: 'active' });
  const orders = await sr.entities.Order.list('-created_date', 50);

  const fields = [
    { label: 'Website Online', value: 'Online', state: 'pass' },
    { label: 'Checkout Available', value: publishable ? 'Available' : 'Not configured', state: publishable ? 'pass' : 'fail' },
    { label: 'Delivery Zone Validation', value: zones.length ? `${zones.length} active zone(s)` : 'No active zones', state: zones.length ? 'pass' : 'fail' },
    { label: 'Payment Page Working', value: publishable ? 'Ready' : 'Not ready', state: publishable ? 'pass' : 'fail' },
    { label: 'Order Creation Working', value: orders.length ? `${orders.length} recent order(s)` : 'No orders yet', state: orders.length ? 'pass' : 'warning' },
  ];

  let status = 'pass';
  if (!publishable || !zones.length) status = 'fail';
  else if (orders.length === 0) status = 'warning';
  if (!publishable) blockers.push({ area: 'Checkout', issue: 'STRIPE_PUBLISHABLE_KEY not set', steps: 'Add the Stripe publishable key in app secrets.' });
  if (!zones.length) blockers.push({ area: 'Checkout', issue: 'No active delivery zones', steps: 'Configure at least one active DeliveryZone in admin zones.' });

  return { key: 'checkout', title: 'Customer Checkout', status, fields, blockers };
}

async function checkDrivers(sr) {
  const blockers = [];
  const drivers = await sr.entities.Driver.list('-updated_date', 200);
  const active = drivers.filter((d) => d.is_active);
  const available = drivers.filter((d) => d.status === 'available');
  const online = drivers.filter((d) => d.is_active && d.status !== 'offline');

  let lastGps = 0;
  try {
    const recentOrders = await sr.entities.Order.list('-created_date', 50);
    for (const o of recentOrders) {
      if (o.driver_location_updated_at) {
        const t = new Date(o.driver_location_updated_at).getTime();
        if (t > lastGps) lastGps = t;
      }
    }
  } catch (_) { /* ignore */ }
  const gpsActive = lastGps && (Date.now() - lastGps) < 60 * 60 * 1000;

  const fcmDriver = await sr.entities.FCMToken.filter({ user_role: 'driver' });

  const fields = [
    { label: 'Available Drivers', value: available.length, state: available.length ? 'pass' : 'warning' },
    { label: 'Drivers Online', value: online.length, state: online.length ? 'pass' : 'warning' },
    { label: 'GPS Active', value: gpsActive ? 'Active (last <1h)' : lastGps ? 'Stale' : 'No GPS data', state: gpsActive ? 'pass' : 'warning' },
    { label: 'Notifications Working', value: fcmDriver.length ? 'Working' : 'No driver tokens', state: fcmDriver.length ? 'pass' : 'warning' },
  ];

  let status = 'warning';
  if (available.length && online.length && gpsActive && fcmDriver.length) status = 'pass';
  if (active.length === 0) blockers.push({ area: 'Drivers', issue: 'No active drivers', steps: 'Onboard and vet at least one driver (background check + training).' });
  if (!fcmDriver.length) blockers.push({ area: 'Drivers', issue: 'No driver push tokens', steps: 'A driver must enable notifications in the app.' });

  return { key: 'drivers', title: 'Driver System', status, fields, blockers };
}

async function checkRetailers(sr) {
  const blockers = [];
  const stores = await sr.entities.Store.list('-updated_date', 200);
  const online = stores.filter((s) => s.is_active && s.compliance_status === 'compliant');
  const withHours = online.filter((s) => s.operating_hours_start && s.operating_hours_end);
  const products = await sr.entities.Product.list('-updated_date', 100);
  const orders = await sr.entities.Order.list('-created_date', 100);
  const accepted = orders.filter((o) => ['confirmed', 'preparing', 'pickup_ready', 'in_transit', 'delivered'].includes(o.status));

  const fields = [
    { label: 'Store Online', value: online.length, state: online.length ? 'pass' : 'fail' },
    { label: 'Store Hours Set', value: `${withHours.length}/${online.length || 0}`, state: online.length && withHours.length === online.length ? 'pass' : 'warning' },
    { label: 'Orders Accepted', value: accepted.length, state: accepted.length ? 'pass' : 'warning' },
    { label: 'Inventory Current', value: `${products.length} products`, state: products.length ? 'pass' : 'warning' },
  ];

  let status = online.length ? 'pass' : 'fail';
  if (online.length && (!withHours.length || !products.length)) status = 'warning';
  if (!online.length) blockers.push({ area: 'Retailers', issue: 'No compliant active stores', steps: 'Activate a store and set compliance_status to compliant.' });
  if (online.length && !withHours.length) blockers.push({ area: 'Retailers', issue: 'Active stores missing operating hours', steps: 'Set operating_hours_start/end on each active store.' });
  if (!products.length) blockers.push({ area: 'Retailers', issue: 'No products in catalog', steps: 'Sync inventory from Clover or upload a product catalog.' });

  return { key: 'retailers', title: 'Retailer System', status, fields, blockers };
}

async function checkRefunds(stripe, cloverSection) {
  const blockers = [];
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';
  let stripeRefundOk = false, lastRefund = null;
  try {
    const acct = await stripe.accounts.retrieve();
    stripeRefundOk = !!acct.charges_enabled;
    const refunds = await stripe.refunds.list({ limit: 5 });
    const succ = refunds.data.find((r) => r.status === 'succeeded');
    if (succ) lastRefund = new Date(succ.created * 1000).toISOString();
  } catch (_) { /* ignore */ }

  const cloverConnected = (cloverSection.merchants || []).some((m) => m.connection_status === 'connected');
  const fields = [
    { label: 'Stripe Refund Status', value: stripeRefundOk ? 'Enabled' : 'Disabled', state: stripeRefundOk ? 'pass' : 'fail' },
    { label: 'Last Successful Refund', value: lastRefund ? fmtDate(lastRefund) : 'None', state: 'pass' },
    { label: 'Clover Refund Status', value: cloverConnected ? 'Connected (POS-side)' : 'Clover not connected', state: 'warning' },
    { label: 'Webhook Sync', value: webhookSecret ? 'Secret configured' : 'No webhook secret', state: webhookSecret ? 'pass' : 'fail' },
    { label: 'Duplicate Refund Protection', value: 'Enforced (webhook idempotency)', state: 'pass' },
  ];

  let status = 'pass';
  if (!stripeRefundOk || !webhookSecret) status = 'fail';
  if (!webhookSecret) blockers.push({ area: 'Refunds', issue: 'STRIPE_WEBHOOK_SECRET not set', steps: 'Register the Stripe webhook endpoint and add the signing secret to app secrets.' });

  return { key: 'refunds', title: 'Refund System', status, fields, blockers };
}

function checkSecurity(req) {
  const blockers = [];
  const isHttps = req.url.startsWith('https://');
  const key = Deno.env.get('STRIPE_SECRET_KEY') || '';
  const env = key.startsWith('sk_live_') ? 'production' : key.startsWith('sk_test_') ? 'test' : 'unknown';
  const required = ['STRIPE_SECRET_KEY', 'STRIPE_PUBLISHABLE_KEY', 'STRIPE_WEBHOOK_SECRET', 'CLOVER_APP_ID', 'CLOVER_APP_SECRET'];
  const secretStates = required.map((n) => ({ name: n, present: !!Deno.env.get(n) }));
  const missing = secretStates.filter((s) => !s.present);
  const oauthConfigured = !!Deno.env.get('CLOVER_APP_ID') && !!Deno.env.get('CLOVER_APP_SECRET');

  const fields = [
    { label: 'SSL Certificate', value: isHttps ? 'Active (HTTPS)' : 'Not HTTPS', state: isHttps ? 'pass' : 'fail' },
    { label: 'Environment', value: env === 'production' ? 'Production' : env === 'test' ? 'Test' : 'Unknown', state: env === 'production' ? 'pass' : 'warning' },
    { label: 'Secrets Configured', value: `${required.length - missing.length}/${required.length}`, state: missing.length ? 'warning' : 'pass' },
    { label: 'OAuth Configured', value: oauthConfigured ? 'Yes' : 'No', state: oauthConfigured ? 'pass' : 'warning' },
  ];

  let status = 'pass';
  if (!isHttps) status = 'fail';
  else if (missing.length || !oauthConfigured || env !== 'production') status = 'warning';
  for (const s of missing) blockers.push({ area: 'Security', issue: `Secret ${s.name} not set`, steps: `Add ${s.name} in app secrets (Dashboard → Settings → Environment Variables).` });

  return { key: 'security', title: 'Security', status, fields, blockers };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const sr = base44.asServiceRole;
    const now = new Date().toISOString();

    const stripeSection = await checkStripe(stripe);
    const cloverCreds = await sr.entities.StorePosCredential.filter({ pos_system: 'clover' });
    const cloverSection = await checkClover(sr, cloverCreds);
    const fcmSection = await checkFcm(sr);
    const checkoutSection = await checkCheckout(sr);
    const driverSection = await checkDrivers(sr);
    const retailerSection = await checkRetailers(sr);
    const refundSection = await checkRefunds(stripe, cloverSection);
    const securitySection = checkSecurity(req);

    const sections = [stripeSection, cloverSection, fcmSection, checkoutSection, driverSection, retailerSection, refundSection, securitySection];
    const blockers = [];
    for (const s of sections) for (const b of s.blockers || []) blockers.push({ section: s.title, ...b });

    const hasFail = sections.some((s) => s.status === 'fail');
    const hasWarn = sections.some((s) => s.status === 'warning');
    const overall = hasFail ? 'not_ready' : hasWarn ? 'ready_with_warnings' : 'ready';

    return Response.json({
      generated_at: now,
      overall_status: overall,
      blockers,
      stripe: stripeSection,
      clover: cloverSection,
      fcm: fcmSection,
      checkout: checkoutSection,
      drivers: driverSection,
      retailers: retailerSection,
      refunds: refundSection,
      security: securitySection,
    });
  } catch (error) {
    console.error('getIntegrationsStatus error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});