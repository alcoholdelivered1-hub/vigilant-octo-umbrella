/**
 * getOrderStripeStatus — READ-ONLY.
 * Admin-only. Retrieves the Stripe Checkout session, PaymentIntent, and latest
 * Charge for a given app Order. Performs only GET requests — creates no charge,
 * refund, invoice, transfer, or payout.
 *
 * POST body: { order_id: string }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { order_id } = body;
    if (!order_id) {
      return Response.json({ error: 'order_id is required' }, { status: 400 });
    }

    const order = await base44.asServiceRole.entities.Order.get(order_id);
    if (!order) {
      return Response.json({ error: 'Order not found' }, { status: 404 });
    }
    if (!order.stripe_session_id) {
      return Response.json({
        order_id: order.id,
        order_number: order.order_number,
        note: 'No Stripe checkout session on this order — it was never paid online.',
        order_stripe_payment_status: order.stripe_payment_status,
      });
    }

    const sk = Deno.env.get('STRIPE_SECRET_KEY');
    if (!sk) {
      return Response.json({ error: 'STRIPE_SECRET_KEY not configured' }, { status: 500 });
    }

    // 1) Read the checkout session, expanding the PaymentIntent object
    const sessResp = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${order.stripe_session_id}?expand[]=payment_intent`,
      { headers: { Authorization: `Bearer ${sk}` } }
    );
    if (!sessResp.ok) {
      const errText = await sessResp.text();
      return Response.json({
        error: `Stripe session lookup failed (${sessResp.status})`,
        details: errText,
        stripe_session_id: order.stripe_session_id,
      }, { status: 502 });
    }
    const sess = await sessResp.json();
    const pi = sess?.payment_intent; // object because of expand

    // 2) Read the latest charge on the PaymentIntent
    let charge = null;
    if (pi && typeof pi === 'object' && pi.latest_charge) {
      const chargeResp = await fetch(`https://api.stripe.com/v1/charges/${pi.latest_charge}`, {
        headers: { Authorization: `Bearer ${sk}` },
      });
      charge = chargeResp.ok ? await chargeResp.json() : { _error_status: chargeResp.status, _error: await chargeResp.text() };
    }

    return Response.json({
      order_id: order.id,
      order_number: order.order_number,
      store_name: order.store_name,
      stripe_session_id: order.stripe_session_id,
      order_stripe_payment_status: order.stripe_payment_status,
      stripe_session_status: sess?.status ?? null,
      stripe_session_payment_status: sess?.payment_status ?? null,
      payment_intent_id: pi?.id ?? (typeof sess?.payment_intent === 'string' ? sess.payment_intent : null),
      payment_intent_status: pi?.status ?? null,
      payment_intent_amount_received: pi?.amount_received ?? null,
      payment_intent_currency: pi?.currency ?? null,
      charge_id: charge?.id ?? null,
      charge_status: charge?.status ?? null,
      charge_captured: charge?.captured ?? null,
      charge_amount_captured: charge?.amount_captured ?? null,
      charge_failure_code: charge?.failure_code ?? null,
      charge_failure_message: charge?.failure_message ?? null,
      paid: pi?.status === 'succeeded' && charge?.status === 'succeeded',
    });
  } catch (e) {
    console.error('[getOrderStripeStatus] error:', e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
}