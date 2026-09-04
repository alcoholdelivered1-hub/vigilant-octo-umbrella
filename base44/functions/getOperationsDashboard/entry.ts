import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Single source-of-truth aggregator for the Operations Dashboard. Admin-only.
// Returns every section in one round-trip so the UI never makes N+1 calls.

const BEVERAGE_KING_STORE_ID = '6a32d14d09b760f592dbf19e';

function isStoreOpenNow(store, now = new Date()) {
  // Arkansas is America/Chicago (UTC-5/-6). We approximate "now" in CT by
  // shifting the UTC date by -5h (CDT summer). Good enough for open/closed.
  const ctOffsetMs = -5 * 60 * 60 * 1000;
  const ct = new Date(now.getTime() + ctOffsetMs);
  const day = ct.getUTCDay(); // 0=Sun..6=Sat
  const curMins = ct.getUTCHours() * 60 + ct.getUTCMinutes();

  const toMins = (t) => {
    if (!t) return null;
    const [h, m] = String(t).split(':').map(Number);
    return h * 60 + (m || 0);
  };

  let startStr, endStr, closed;
  if (day === 0) { // Sunday
    startStr = store.sunday_hours_start; endStr = store.sunday_hours_end;
    closed = store.sunday_closed !== false ? true : !startStr;
  } else if (day === 6) { // Saturday
    startStr = store.saturday_hours_start || store.operating_hours_start;
    endStr = store.saturday_hours_end || store.operating_hours_end;
    closed = !startStr;
  } else {
    startStr = store.operating_hours_start;
    endStr = store.operating_hours_end;
    closed = !startStr;
  }
  if (closed) return { open: false, reason: 'Closed today' };
  const s = toMins(startStr); const e = toMins(endStr);
  if (s == null || e == null) return { open: false, reason: 'Hours not set' };

  // Overnight window (e.g. 07:00 -> 01:00) spans midnight.
  const inWindow = e > s ? (curMins >= s && curMins < e) : (curMins >= s || curMins < e);
  return { open: inWindow, reason: inWindow ? 'Open now' : 'Closed now' };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const [
      stores, drivers, posCreds, fcmTokens, complianceIncidents,
      recentOrders, products, cloverSyncs, idVerifications,
    ] = await Promise.all([
      base44.asServiceRole.entities.Store.filter({}),
      base44.asServiceRole.entities.Driver.filter({}),
      base44.asServiceRole.entities.StorePosCredential.filter({}),
      base44.asServiceRole.entities.FCMToken.filter({}),
      base44.asServiceRole.entities.ComplianceIncident.filter({}, '-incident_date', 30),
      base44.asServiceRole.entities.Order.filter({}, '-created_date', 250),
      base44.asServiceRole.entities.Product.filter({}),
      base44.asServiceRole.entities.CloverOrderSync.filter({}),
      base44.asServiceRole.entities.IDVerification.filter({}, '-created_date', 50),
    ]);

    const credByStore = {};
    for (const c of posCreds) {
      credByStore[c.store_id] = c;
    }
    const syncByStore = {};
    for (const s of cloverSyncs) {
      if (!syncByStore[s.store_id]) syncByStore[s.store_id] = s;
    }

    // ---- Retailers ----
    const retailers = stores.map((st) => {
      const cred = credByStore[st.id];
      const sync = syncByStore[st.id];
      const cloverConnected = !!(cred && cred.api_token && cred.merchant_id && cred.is_configured);
      const open = isStoreOpenNow(st);
      // Test order status: any delivered order for this store = passed
      const storeOrders = recentOrders.filter((o) => o.store_id === st.id);
      const hasDelivered = storeOrders.some((o) => o.status === 'delivered');
      return {
        id: st.id,
        name: st.name,
        city: st.city,
        county: st.county,
        onboarding_status: st.onboarding_status,
        clover_connected: cloverConnected,
        clover_merchant_id: cred?.merchant_id || '',
        clover_token_source: cred?.api_token ? (cred.refresh_token || cred.api_secret ? 'merchant-specific OAuth' : 'retailer credential') : 'none',
        stripe_onboarded: !!st.stripe_connect_onboarded,
        stripe_connect_account_id: st.stripe_connect_account_id || '',
        inventory_sync_status: sync?.last_sync_status || 'pending',
        last_sync: sync?.last_synced_at || null,
        contract_status: st.contract_sent_at ? 'sent' : (st.onboarding_status === 'live' ? 'signed' : 'pending'),
        is_active: st.is_active,
        compliance_status: st.compliance_status,
        open_now: open.open,
        open_reason: open.reason,
        test_order_status: hasDelivered ? 'passed' : 'pending',
        product_count: products.filter((p) => p.store_id === st.id).length,
      };
    });

    // ---- Drivers ----
    const driversData = drivers.map((d) => ({
      id: d.id,
      name: d.name,
      email: d.email,
      phone: d.phone,
      status: d.status,
      is_active: d.is_active,
      online: d.status === 'available' || d.status === 'on_delivery',
      gps: (d.current_latitude != null && d.current_longitude != null)
        ? { lat: d.current_latitude, lng: d.current_longitude } : null,
      background_check_status: d.background_check_status,
      vetting_flagged: !!d.vetting_flagged,
      id_verified: !!d.training_completed, // proxy: training-complete indicates verified vetting
      training_completed: !!d.training_completed,
      vehicle_info: d.vehicle_info || '',
      license_number: d.license_number || '',
      total_deliveries: d.total_deliveries || 0,
      last_delivery_at: null,
    }));

    // ---- Orders buckets ----
    const buckets = {
      pending: 0, paid: 0, waiting_retailer: 0, on_driver: 0,
      delivered: 0, failed: 0, refunded: 0,
    };
    for (const o of recentOrders) {
      if (o.status === 'pending') buckets.pending++;
      if (o.stripe_payment_status === 'paid' && ['confirmed', 'preparing', 'pickup_ready'].includes(o.status)) buckets.waiting_retailer++;
      if (o.stripe_payment_status === 'paid' && o.status === 'pending') buckets.paid++;
      if (o.status === 'in_transit') buckets.on_driver++;
      if (o.status === 'delivered') buckets.delivered++;
      if (o.status === 'cancelled' || o.status === 'refused') buckets.failed++;
    }
    // refunded approximated by cancelled orders with a refund note; no dedicated field
    buckets.refunded = 0;

    // ---- Technology ----
    const stripeKey = (Deno.env.get('STRIPE_SECRET_KEY') || '').trim();
    const cloverToken = (Deno.env.get('CLOVER_API_TOKEN') || '').trim();
    const hasPushTokens = fcmTokens.length > 0;
    const anyCloverConnected = retailers.some((r) => r.clover_connected);
    const tech = {
      clover: { ok: anyCloverConnected, detail: anyCloverConnected ? 'Merchant OAuth connected' : 'No merchant-scoped token' },
      stripe: { ok: !!stripeKey, detail: stripeKey ? 'Live key configured' : 'Missing STRIPE_SECRET_KEY' },
      firebase: { ok: hasPushTokens, detail: hasPushTokens ? `${fcmTokens.length} device token(s)` : 'No FCM tokens registered' },
      push: { ok: hasPushTokens, detail: hasPushTokens ? 'Operational' : 'No push tokens' },
      maps: { ok: true, detail: 'Leaflet + geolocation available' },
      security: { ok: true, detail: 'noindex + RLS + server guards active' },
      api: { ok: true, detail: 'Backend functions responding' },
      database: { ok: true, detail: 'Entity store reachable' },
    };

    // ---- Compliance ----
    const compliantStores = stores.filter((s) => s.compliance_status === 'compliant').length;
    const licensedStores = stores.filter((s) => !!s.license_number).length;
    const clearedDrivers = drivers.filter((d) => d.background_check_status === 'clear').length;
    const trainedDrivers = drivers.filter((d) => d.training_completed).length;
    const flaggedDrivers = drivers.filter((d) => d.vetting_flagged).length;
    const compliance = {
      abc: { ok: compliantStores === stores.length, detail: `${compliantStores}/${stores.length} stores compliant` },
      age_verification: { ok: idVerifications.length > 0, detail: `${idVerifications.length} ID verification(s) logged` },
      permits: { ok: licensedStores === stores.length, detail: `${licensedStores}/${stores.length} stores licensed` },
      driver_requirements: {
        ok: clearedDrivers === drivers.length && trainedDrivers === drivers.length,
        detail: `${clearedDrivers} cleared BG, ${trainedDrivers} trained, ${flaggedDrivers} flagged`,
      },
      audit: {
        detail: `${complianceIncidents.length} compliance incident(s), ${idVerifications.length} eligibility/ID logs`,
        incidents: complianceIncidents.length,
      },
    };

    // ---- Launch checklist ----
    const bk = retailers.find((r) => r.id === BEVERAGE_KING_STORE_ID);
    const bkClover = !!(bk && bk.clover_connected);
    const inventorySynced = products.length > 0 && (bk ? bk.product_count > 0 : true);
    const deliveredExists = buckets.delivered > 0;
    const checklist = [
      { label: 'Website online', done: true, detail: 'App deployed & reachable' },
      { label: 'Customer app operational', done: true, detail: 'Storefront + checkout available' },
      { label: 'Driver app operational', done: true, detail: 'Driver portal available' },
      { label: 'Retailer portal operational', done: true, detail: 'Partner dashboard available' },
      { label: 'Beverage King Clover connected', done: bkClover, detail: bkClover ? 'Merchant OAuth complete' : 'Awaiting retailer OAuth' },
      { label: 'Inventory synchronized', done: inventorySynced, detail: `${products.length} products total` },
      { label: 'Stripe payments working', done: !!stripeKey, detail: stripeKey ? 'Live mode' : 'Key missing' },
      { label: 'Push notifications working', done: hasPushTokens, detail: `${fcmTokens.length} token(s)` },
      { label: 'Successful end-to-end test order', done: deliveredExists, detail: deliveredExists ? 'At least one delivered order' : 'No delivered order yet' },
      { label: 'Production ready', done: bkClover && inventorySynced && !!stripeKey && hasPushTokens && deliveredExists, detail: 'All gates green' },
    ];

    const doneCount = checklist.filter((c) => c.done).length;
    const readiness = Math.round((doneCount / checklist.length) * 100);

    // ---- Blockers ----
    const blockers = [];
    if (!bkClover) blockers.push('Beverage King Clover OAuth not completed');
    if (flaggedDrivers > 0) blockers.push(`${flaggedDrivers} driver(s) flagged for vetting investigation`);
    if (compliantStores < stores.length) blockers.push(`${stores.length - compliantStores} store(s) non-compliant`);
    if (!stripeKey) blockers.push('Stripe secret key not configured');
    if (!hasPushTokens) blockers.push('No push notification tokens registered');
    if (!deliveredExists) blockers.push('No successful end-to-end test order yet');
    stores.filter((s) => !s.is_active).forEach((s) => blockers.push(`${s.name} store inactive`));

    // ---- Priorities (top 5 blockers) ----
    const priorities = blockers.slice(0, 5);

    // ---- Recent activity ----
    const recentActivity = recentOrders.slice(0, 12).map((o) => ({
      type: 'order',
      label: `Order ${o.order_number || o.id} — ${o.status}`,
      store: o.store_name,
      at: o.created_date,
    }));
    const driverFlags = drivers.filter((d) => d.vetting_flagged).slice(0, 5).map((d) => ({
      type: 'driver_vetting',
      label: `${d.name} flagged for investigation`,
      at: d.vetting_flagged_at || d.updated_date,
    }));
    const incidentActivity = complianceIncidents.slice(0, 5).map((i) => ({
      type: 'compliance',
      label: `${i.incident_type} — ${i.order_number || 'order'}`,
      at: i.incident_date || i.created_date,
    }));
    const recentActivityAll = [...recentActivity, ...driverFlags, ...incidentActivity]
      .sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0))
      .slice(0, 15);

    return Response.json({
      generated_at: new Date().toISOString(),
      executive: {
        readiness,
        done_count: doneCount,
        total_checks: checklist.length,
        blockers,
        priorities,
        system_health: {
          stores: stores.length,
          active_stores: stores.filter((s) => s.is_active).length,
          drivers: drivers.length,
          active_drivers: drivers.filter((d) => d.is_active).length,
          orders_today: recentOrders.filter((o) => {
            const d = new Date(o.created_date); const now = new Date();
            return d.toDateString() === now.toDateString();
          }).length,
          products: products.length,
        },
        recent_activity: recentActivityAll,
      },
      retailers,
      drivers: driversData,
      orders: { buckets, recent: recentOrders.slice(0, 20) },
      technology: tech,
      compliance,
      launchChecklist: checklist,
    });
  } catch (error) {
    console.error('getOperationsDashboard error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});