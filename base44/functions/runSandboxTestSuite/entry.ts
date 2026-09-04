import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import Stripe from 'npm:stripe@14.21.0';

// TEST MODE ONLY — uses STRIPE_TEST_SECRET_KEY, never the live key
const stripeTest = new Stripe(Deno.env.get('STRIPE_TEST_SECRET_KEY'));

Deno.serve(async (req) => {
  const report = {
    started_at: new Date().toISOString(),
    mode: 'SANDBOX / TEST ONLY — no production credentials used',
    clover: { environment: null, tests: {} },
    stripe: { mode: null, tests: {} },
    sandbox_order: null,
    cancellation_test: null,
    errors: [],
  };

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });
    }

    // ================================================================
    // 1. CLOVER ENVIRONMENT CONFIRMATION (sandbox only)
    // ================================================================
    // Honor CLOVER_ENVIRONMENT: 'sandbox' uses the dedicated sandbox credentials.
    const useSandboxEnv = (Deno.env.get('CLOVER_ENVIRONMENT') || '').trim().toLowerCase() === 'sandbox';
    const cloverToken = (Deno.env.get(useSandboxEnv ? 'CLOVER_SANDBOX_API_TOKEN' : 'CLOVER_API_TOKEN') || '').trim();
    const cloverMerchantId = (Deno.env.get(useSandboxEnv ? 'CLOVER_SANDBOX_MERCHANT_ID' : 'CLOVER_MERCHANT_ID') || '').trim();
    report.clover.configured_environment = useSandboxEnv ? 'sandbox' : 'production';

    // Token type detection (without displaying the token)
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const tokenType = uuidPattern.test(cloverToken) ? 'UUID (REST API token)' : 'non-UUID';
    const tokenPreview = cloverToken.length > 8
      ? cloverToken.substring(0, 4) + '••••' + cloverToken.substring(cloverToken.length - 4)
      : '••••';

    const sandboxMerchantUrl = `https://sandbox.dev.clover.com/v3/merchants/${cloverMerchantId}`;
    const sandboxHeaders = { 'Authorization': `Bearer ${cloverToken}`, 'Content-Type': 'application/json' };

    // SKIP IF NEEDED: never send the production token to the sandbox endpoint.
    // If CLOVER_ENVIRONMENT isn't 'sandbox', or sandbox creds are missing, skip
    // the Clover section gracefully instead of attempting (and failing) auth.
    const sandboxCredsMissing = !cloverToken || !cloverMerchantId;
    if (!useSandboxEnv || sandboxCredsMissing) {
      report.clover.environment = 'skipped';
      report.clover.skipped = true;
      report.clover.skipped_reason = !useSandboxEnv
        ? "CLOVER_ENVIRONMENT is not 'sandbox' — production token kept separate from sandbox; Clover tests skipped to avoid sending production credentials to the sandbox endpoint."
        : 'Sandbox credentials (CLOVER_SANDBOX_API_TOKEN / CLOVER_SANDBOX_MERCHANT_ID) not yet provided. Obtain them from the Clover Developer Dashboard, set CLOVER_ENVIRONMENT=sandbox, then re-run.';
      report.clover.note = 'No production or sandbox credentials were sent to the sandbox endpoint.';
      report.errors.push('Clover sandbox tests skipped — credentials not ready (expected before sandbox provisioning).');
    } else {
    const merchantResp = await fetch(sandboxMerchantUrl, { headers: sandboxHeaders });

    if (merchantResp.ok) {
      const merchant = await merchantResp.json();
      report.clover.environment = 'sandbox';
      report.clover.merchant_id = merchant.id || cloverMerchantId;
      report.clover.merchant_name = merchant.name || null;
      report.clover.token_type = tokenType;
      report.clover.token_preview = tokenPreview;
      report.clover.token_length = cloverToken.length;

      // --- 3a. Read-only: Inventory / Items ---
      const invResp = await fetch(`${sandboxMerchantUrl}/items?limit=10`, { headers: sandboxHeaders });
      report.clover.tests.inventory = invResp.ok
        ? { accessible: true, item_count: (await invResp.json()).elements?.length || 0 }
        : { accessible: false, http_status: invResp.status };

      // --- 3b. Read-only: Orders ---
      const sinceMs = Date.now() - 365 * 24 * 60 * 60 * 1000;
      const ordersResp = await fetch(
        `${sandboxMerchantUrl}/orders?limit=10&expand=lineItems,payments&filter=createdTime>${sinceMs}`,
        { headers: sandboxHeaders }
      );
      if (ordersResp.ok) {
        const orders = (await ordersResp.json()).elements || [];
        report.clover.tests.orders = {
          accessible: true,
          order_count: orders.length,
          first_order_id: orders[0]?.id || null,
          sample_orders: orders.slice(0, 3).map(o => ({
            id: o.id,
            total: o.total != null ? o.total / 100 : null,
            created_time: o.createdTime ? new Date(o.createdTime).toISOString() : null,
          })),
        };
      } else {
        report.clover.tests.orders = { accessible: false, http_status: ordersResp.status };
      }
    } else {
      // Sandbox auth failed with sandbox creds provided
      report.clover.environment = 'sandbox_unavailable';
      report.clover.merchant_id = cloverMerchantId;
      report.clover.token_type = tokenType;
      report.clover.token_preview = tokenPreview;
      report.clover.token_length = cloverToken.length;
      report.clover.sandbox_http_status = merchantResp.status;
      report.clover.note = 'Sandbox credentials were provided but did not authenticate against the Clover sandbox endpoint. Verify CLOVER_SANDBOX_API_TOKEN / CLOVER_SANDBOX_MERCHANT_ID from the Clover Developer Dashboard.';
      report.errors.push('Clover sandbox authentication failed — verify sandbox credentials');
    }
    }

    // ================================================================
    // 2. STRIPE TEST MODE CONFIRMATION
    // ================================================================
    const account = await stripeTest.accounts.retrieve();
    report.stripe.mode = 'test';
    report.stripe.account_id = account.id;
    report.stripe.country = account.country;
    report.stripe.default_currency = account.default_currency;
    report.stripe.charges_enabled = account.charges_enabled;
    report.stripe.payouts_enabled = account.payouts_enabled;

    // ================================================================
    // 5. CREATE STRIPE TEST PAYMENTINTENT (delivery + service fee only)
    //    NO Clover alcohol sales are mirrored — this is AD platform fees only
    // ================================================================
    const deliveryFee = 4.75;
    const serviceFee = 5.00;
    const feeTotalCents = Math.round((deliveryFee + serviceFee) * 100); // $9.75

    const pi = await stripeTest.paymentIntents.create({
      amount: feeTotalCents,
      currency: 'usd',
      description: 'Alcohol Delivered — Delivery Fee + Service Fee (SANDBOX TEST)',
      payment_method_types: ['card'],
      metadata: {
        base44_app_id: Deno.env.get('BASE44_APP_ID'),
        test_mode: 'true',
        source: 'sandbox_test_suite',
        delivery_fee: String(deliveryFee),
        service_fee: String(serviceFee),
        clover_mirroring: 'disabled',
        note: 'AD platform delivery/service fee only — Clover alcohol sales NOT charged to Stripe',
      },
    });

    // Confirm with Stripe test card (pm_card_visa = successful Visa test card)
    const confirmedPI = await stripeTest.paymentIntents.confirm(pi.id, {
      payment_method: 'pm_card_visa',
    });

    // Retrieve the charge from the confirmed PI
    let chargeId = confirmedPI.latest_charge;
    if (typeof chargeId === 'object' && chargeId !== null) {
      chargeId = chargeId.id;
    }

    report.stripe.tests.payment_intent = {
      id: confirmedPI.id,
      status: confirmedPI.status,
      amount: confirmedPI.amount / 100,
      currency: confirmedPI.currency,
      charge_id: chargeId,
      description: confirmedPI.description,
      created: new Date(confirmedPI.created * 1000).toISOString(),
    };

    // ================================================================
    // 4. SANDBOX ORDER DATA (returned for Test DB save)
    //    Linked to Clover sandbox order if one was found
    // ================================================================
    const cloverSandboxOrderId = report.clover.tests.orders?.sample_orders?.[0]?.id || null;
    const cloverSandboxOrderTotal = report.clover.tests.orders?.sample_orders?.[0]?.total || null;

    report.sandbox_order = {
      order_number: `TEST-SB-${Date.now().toString(36).toUpperCase()}`,
      customer_email: user.email,
      customer_name: user.full_name || 'Sandbox Test Admin',
      store_id: '6a32d14d09b760f592dbf19e',
      store_name: 'Beverage King (Sandbox)',
      subtotal: 22.98,
      delivery_fee: deliveryFee,
      service_fee: serviceFee,
      tax: 1.49,
      tip: 2.00,
      total: 22.98 + deliveryFee + serviceFee + 1.49 + 2.00,
      stripe_payment_intent_id: confirmedPI.id,
      stripe_charge_id: chargeId,
      clover_order_id: cloverSandboxOrderId,
      clover_order_total: cloverSandboxOrderTotal,
      status: 'pending',
      pending_at: new Date().toISOString(),
    };

    // ================================================================
    // 7. LIFECYCLE SIMULATION (sandbox order through full status flow)
    //    No DB writes — timestamps recorded in the report only.
    // ================================================================
    const lifecycle = [
      { status: 'confirmed',    label: 'retailer_accepted' },
      { status: 'pickup_ready', label: 'ready_for_pickup' },
      { status: 'pickup_ready', label: 'driver_assigned', note: 'driver_id + driver_name set' },
      { status: 'in_transit',   label: 'picked_up', note: 'pickup_confirmed_at set' },
      { status: 'in_transit',   label: 'id_verified', note: 'id_verified_at_delivery = true' },
      { status: 'delivered',    label: 'delivered', note: 'delivery_confirmed_at set' },
    ].map(t => ({ ...t, timestamp: new Date().toISOString() }));
    report.sandbox_order.lifecycle = lifecycle;
    report.sandbox_order.status = 'delivered';
    report.sandbox_order.delivered_at = lifecycle[lifecycle.length - 1].timestamp;

    // ================================================================
    // 8. CANCELLATION TEST — separate PI + refund
    // ================================================================
    const cancelPI = await stripeTest.paymentIntents.create({
      amount: feeTotalCents,
      currency: 'usd',
      description: 'Alcohol Delivered — Cancellation Refund Test (SANDBOX TEST)',
      payment_method_types: ['card'],
      metadata: {
        base44_app_id: Deno.env.get('BASE44_APP_ID'),
        test_mode: 'true',
        source: 'sandbox_cancellation_test',
      },
    });

    const cancelConfirmed = await stripeTest.paymentIntents.confirm(cancelPI.id, {
      payment_method: 'pm_card_visa',
    });

    let cancelChargeId = cancelConfirmed.latest_charge;
    if (typeof cancelChargeId === 'object' && cancelChargeId !== null) {
      cancelChargeId = cancelChargeId.id;
    }

    // Issue full refund
    const refund = await stripeTest.refunds.create({
      payment_intent: cancelConfirmed.id,
      reason: 'requested_by_customer',
      metadata: {
        test_mode: 'true',
        source: 'sandbox_cancellation_test',
      },
    });

    report.cancellation_test = {
      order_number: `TEST-CAN-${Date.now().toString(36).toUpperCase()}`,
      payment_intent_id: cancelConfirmed.id,
      charge_id: cancelChargeId,
      refund_id: refund.id,
      refund_status: refund.status,
      refund_amount: refund.amount / 100,
      payment_status: cancelConfirmed.status,
      charge_created: new Date(cancelConfirmed.created * 1000).toISOString(),
      refund_created: new Date(refund.created * 1000).toISOString(),
      notes: 'SANDBOX CANCELLATION TEST — separate PI created, charged, and refunded in Stripe test mode',
    };

    report.completed_at = new Date().toISOString();
    report.success = true;

    return Response.json(report);
  } catch (error) {
    console.error('runSandboxTestSuite error:', error);
    report.errors.push(error.message);
    report.completed_at = new Date().toISOString();
    report.success = false;
    return Response.json(report, { status: 500 });
  }
});