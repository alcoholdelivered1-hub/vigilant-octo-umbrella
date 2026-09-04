// Core logic to create an OPEN Clover order (no payment) with complete line items
// for an app Order, on the store's configured merchant, then persist the Clover
// order id back to the Order.
//
// Shared by pushOrderToClover (admin-triggered) and autoPushOrderToClover
// (service-role, invoked by the "Fulfill Order After Payment" workflow). The
// CALLER is responsible for authentication; this module only does the work.
//
// Guards:
//  - Idempotent: skips if the Order already has a clover_order_id (unless force=true)
//  - Only pushes paid orders (stripe_payment_status === 'paid') unless force=true
//  - Requires a merchant-scoped token (no shared env fallback) and asserts it
//    authenticates for the store's configured merchant before writing anything.
//
// Returns one of:
//   { success: true, order_number, store_id, clover: {...} }
//   { success: false, skipped: true, reason, ... }
//   { error: '...', httpStatus?: number, ... }

import {
  resolveCloverCredentials,
  assertMerchantScopedToken,
} from './cloverCredentials.ts';

export async function createCloverOrderForOrder(base44, order_id, options = {}) {
  const { force = false } = options;

  const order = await base44.asServiceRole.entities.Order.get(order_id);
  if (!order) return { error: 'Order not found', httpStatus: 404 };

  // Idempotency guard
  if (order.clover_order_id && !force) {
    return {
      success: false,
      skipped: true,
      reason: 'Order already has a Clover order',
      clover_order_id: order.clover_order_id,
      payment_status: order.stripe_payment_status,
    };
  }

  // Payment-status guard
  if (order.stripe_payment_status !== 'paid' && !force) {
    return {
      success: false,
      skipped: true,
      reason: 'Order payment is not confirmed (stripe_payment_status != "paid")',
      payment_status: order.stripe_payment_status,
    };
  }

  // Retailer must be active and compliant before any order reaches the POS.
  const store = await base44.asServiceRole.entities.Store.get(order.store_id);
  if (!store) return { error: 'Store not found', httpStatus: 404 };
  if (!store.is_active || store.compliance_status !== 'compliant') {
    return {
      success: false,
      skipped: true,
      reason: `Retailer not active/compliant (active=${store.is_active}, compliance=${store.compliance_status})`,
    };
  }

  // POS-agnostic guard: only push to Clover when the retailer's chosen POS
  // (from their onboarding dropdown) is Clover. Retailers on Square, Toast, NCR,
  // Lightspeed, ShopKeep, "other", or "none" are skipped cleanly here — the
  // Fulfill workflow still notifies the retailer and alerts a driver regardless.
  if (store.pos_system && store.pos_system !== 'clover') {
    return {
      success: false,
      skipped: true,
      reason: `Store POS is "${store.pos_system}" — Clover push only applies to Clover stores`,
      pos_system: store.pos_system,
    };
  }

  // Resolve merchant-scoped credentials — NEVER fall back to the shared env token.
  const { apiToken, merchantId, tokenSource, credMerchantId } =
    await resolveCloverCredentials(base44, order.store_id, { noEnvFallback: true });
  if (!apiToken) {
    return {
      error: 'No merchant-scoped Clover token configured for this store',
      token_source: tokenSource,
      next_step: 'Re-authorize this store via cloverOAuthExchange to save its own access token.',
      httpStatus: 500,
    };
  }
  const targetMerchantId = credMerchantId || merchantId;
  if (!targetMerchantId) {
    return { error: 'No merchant_id configured for this store', httpStatus: 500 };
  }

  const auth = await assertMerchantScopedToken(apiToken, targetMerchantId);
  if (!auth.ok) {
    return {
      error: 'Merchant-scoped Clover auth failed — refusing to push to avoid wrong merchant',
      configured_merchant_id: targetMerchantId,
      token_source: tokenSource,
      reason: auth.reason,
      clover_response_status: auth.clover_response_status ?? null,
      clover_response_body: auth.clover_response_body ?? null,
      httpStatus: 403,
    };
  }

  const baseUrl = `https://api.clover.com/v3/merchants/${targetMerchantId}`;
  const headers = { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' };

  // 1) Create an OPEN order (no payment) titled with the order number
  const createResp = await fetch(`${baseUrl}/orders`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      state: 'open',
      title: `Alcohol Delivered ${order.order_number || order.id}`,
      note: `Customer: ${order.customer_name || ''} | Phone: ${order.customer_phone || ''} | Deliver to: ${order.delivery_address || ''}`,
    }),
  });
  if (!createResp.ok) {
    const text = await createResp.text();
    return { error: `Clover create order failed (${createResp.status})`, details: text, httpStatus: 502 };
  }
  const cloverOrder = await createResp.json();
  const cloverOrderId = cloverOrder.id;
  if (!cloverOrderId) {
    return { error: 'Clover did not return an order id', clover_response: cloverOrder, httpStatus: 502 };
  }

  // 2) Add complete line items (name + unit price in cents + quantity), one POST each
  const lineItemResults = [];
  const items = Array.isArray(order.items) ? order.items : [];

  // Reconcile line-item subtotal against the stored order subtotal (within 1¢)
  // to detect price/tamper drift before mirroring the order to Clover.
  const roundCents = (n: number) => Math.round((Number(n) || 0) * 100);
  const itemsSubtotalCents = items.reduce(
    (s, it) => s + roundCents((Number(it.price) || 0) * (Number(it.quantity) || 0)),
    0,
  );
  if (Math.abs(itemsSubtotalCents - roundCents(order.subtotal)) > 1) {
    return {
      success: false,
      skipped: true,
      reason: 'Subtotal mismatch between order and line items — refusing to push to Clover',
      order_subtotal_cents: roundCents(order.subtotal),
      items_subtotal_cents: itemsSubtotalCents,
    };
  }

  for (const item of items) {
    const unitCents = Math.round((Number(item.price) || 0) * 100);
    const qty = Math.max(1, Math.round(Number(item.quantity) || 1));
    const liResp = await fetch(`${baseUrl}/orders/${cloverOrderId}/line_items`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: item.product_name || 'Item',
        price: unitCents,
        unitQty: qty,
      }),
    });
    const liJson = liResp.ok ? await liResp.json() : { error_status: liResp.status };
    lineItemResults.push({
      name: item.product_name,
      unit_cents: unitCents,
      quantity: qty,
      ok: liResp.ok,
      clover_line_item_id: liJson?.id || null,
    });
  }

  // 3) Persist the Clover order id on the app Order so we never duplicate
  await base44.asServiceRole.entities.Order.update(order.id, { clover_order_id: cloverOrderId });

  // 4) Read it back to confirm it exists in an open state with line items
  const verifyResp = await fetch(`${baseUrl}/orders/${cloverOrderId}?expand=lineItems`, { headers });
  const verifyJson = verifyResp.ok ? await verifyResp.json() : null;

  return {
    success: true,
    order_number: order.order_number,
    store_id: order.store_id,
    clover: {
      order_id: cloverOrderId,
      merchant_id: targetMerchantId,
      merchant_name: auth.merchantName,
      environment: auth.environment,
      state: verifyJson?.state || cloverOrder.state || 'open',
      line_items_pushed: lineItemResults.filter(r => r.ok).length,
      line_items_total_cents: lineItemResults.reduce((s, r) => s + r.unit_cents * r.quantity, 0),
      line_item_results: lineItemResults,
      readback_ok: verifyResp.ok,
      readback_state: verifyJson?.state || null,
      readback_line_item_count: verifyJson?.lineItems?.elements?.length || 0,
    },
  };
}