import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { BEVERAGE_KING_STORE_ID, resolveCloverCredentials, findActiveCloverEnvironment, autoDiscoverMerchantId } from '../../shared/cloverCredentials.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch (_) { /* scheduled run */ }
    if (user && user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const storeId = body.store_id || BEVERAGE_KING_STORE_ID;

    // --- Resolve Clover credentials (shared module) ---
    const { apiToken, merchantId } = await resolveCloverCredentials(base44, storeId);

    if (!apiToken || !merchantId) {
      return Response.json({ error: 'Clover credentials not configured' }, { status: 500 });
    }

    const headers = {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    };

    // --- Find the active Clover environment ---
    let { baseUrl, activeEnv } = await findActiveCloverEnvironment(apiToken, merchantId);

    // If neither environment worked, try auto-discovering the merchant ID
    if (!baseUrl) {
      const discovered = await autoDiscoverMerchantId(apiToken, merchantId);
      if (discovered.merchantAutoDiscovered) {
        const result = await findActiveCloverEnvironment(apiToken, discovered.merchantId);
        baseUrl = result.baseUrl;
        activeEnv = result.activeEnv;
      }
    }

    if (!baseUrl) {
      return Response.json({ error: 'Clover API token is invalid or expired' }, { status: 401 });
    }

    // --- READ-ONLY: Fetch recent paid orders (30 days), expand lineItems and payments ---
    const sinceMs = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const ordersUrl = `${baseUrl}/orders?limit=100&offset=0&expand=lineItems,payments&filter=createdTime>${sinceMs}`;
    const resp = await fetch(ordersUrl, { headers });

    if (!resp.ok) {
      const text = await resp.text();
      return Response.json({ error: `Clover API error: ${resp.status}`, details: text }, { status: 502 });
    }

    const data = await resp.json();
    let allOrders = data.elements || [];

    // If no orders found via orders endpoint, try the payments endpoint
    if (allOrders.length === 0) {
      const payUrl = `${baseUrl}/payments?limit=100&offset=0&filter=createdTime>${sinceMs}`;
      const payResp = await fetch(payUrl, { headers });
      if (payResp.ok) {
        const payData = await payResp.json();
        const payments = payData.elements || [];
        for (const p of payments.slice(0, 10)) {
          const orderId = p.order?.id;
          if (orderId) {
            const orderResp = await fetch(`${baseUrl}/orders/${orderId}?expand=lineItems`, { headers });
            if (orderResp.ok) {
              const orderData = await orderResp.json();
              allOrders.push({ ...orderData, payments: { elements: [p] } });
            }
          }
        }
        // If still no full orders, build from payments alone
        if (allOrders.length === 0 && payments.length > 0) {
          allOrders = payments.map(p => ({
            id: p.order?.id || `payment_${p.id}`,
            createdTime: p.createdTime,
            currency: 'usd',
            lineItems: { elements: [] },
            payments: { elements: [p] },
          }));
        }
      }
    }

    // Find the first paid order with payments
    const paidOrders = allOrders.filter(o => o.payments?.elements?.length > 0);

    if (paidOrders.length === 0) {
      return Response.json({
        success: false,
        message: 'No paid Clover POS orders found in the last 30 days',
        total_orders_fetched: allOrders.length,
        environment: activeEnv,
        stripe_objects_created: 0,
      });
    }

    const order = paidOrders[0];
    const payments = order.payments.elements;

    // Extract amounts (Clover stores in cents — convert to dollars)
    const totalCents = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const taxCents = payments.reduce((sum, p) => sum + (p.taxAmount || 0), 0);
    const tipCents = payments.reduce((sum, p) => sum + (p.tipAmount || 0), 0);

    const total = totalCents / 100;
    const tax = taxCents / 100;
    const tip = tipCents / 100;
    const subtotal = total - tax - tip;

    // Extract line items
    const items = (order.lineItems?.elements || []).map(li => ({
      name: li.name || 'Unknown Item',
      quantity: li.quantity || 1,
      price: (li.price || 0) / 100,
    }));

    // Payment details
    const firstPayment = payments[0];
    const paymentId = firstPayment?.id || null;
    const paymentStatus = firstPayment?.result || 'UNKNOWN';

    // Get store name
    let storeName = 'Unknown Store';
    try {
      const store = await base44.asServiceRole.entities.Store.get(storeId);
      if (store?.name) storeName = store.name;
    } catch (_) { /* keep default */ }

    // --- Save to database (NO Stripe objects created) ---
    const saved = await base44.asServiceRole.entities.CloverPosOrder.create({
      clover_order_id: order.id,
      clover_payment_id: paymentId,
      store_id: storeId,
      store_name: storeName,
      items,
      subtotal,
      tax,
      tip,
      total,
      currency: (order.currency || 'usd').toLowerCase(),
      payment_status: paymentStatus,
      order_created_at: order.createdTime ? new Date(order.createdTime).toISOString() : null,
      fetched_at: new Date().toISOString(),
    });

    return Response.json({
      success: true,
      saved_record: {
        id: saved.id,
        clover_order_id: saved.clover_order_id,
        clover_payment_id: saved.clover_payment_id,
        store_name: saved.store_name,
        items: saved.items,
        subtotal: saved.subtotal,
        tax: saved.tax,
        tip: saved.tip,
        total: saved.total,
        currency: saved.currency,
        payment_status: saved.payment_status,
        order_created_at: saved.order_created_at,
        fetched_at: saved.fetched_at,
      },
      total_orders_fetched: allOrders.length,
      paid_orders_found: paidOrders.length,
      environment: activeEnv,
      stripe_objects_created: 0,
    });
  } catch (error) {
    console.error('fetchCloverOrderReadOnly error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});