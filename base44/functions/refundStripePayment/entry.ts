import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });
    }

    const { order_id, stripe_session_id, refund_amount, reason = 'requested_by_customer' } = await req.json();

    // Resolve the order
    let order = null;
    if (order_id) {
      order = await base44.asServiceRole.entities.Order.get(order_id);
    } else if (stripe_session_id) {
      const matches = await base44.asServiceRole.entities.Order.filter({ stripe_session_id });
      order = matches[0];
    }

    if (!order) {
      return Response.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.stripe_payment_status === 'refunded') {
      return Response.json({ error: 'Order has already been refunded' }, { status: 409 });
    }

    if (!order.stripe_session_id) {
      return Response.json({ error: 'Order has no Stripe session — nothing to refund' }, { status: 400 });
    }

    // Retrieve the checkout session → payment intent
    const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id);
    if (!session.payment_intent) {
      return Response.json({ error: 'No payment intent found for this session' }, { status: 400 });
    }

    const paymentIntentId = typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent.id;

    // Issue the refund (full or partial)
    const refundParams = {
      payment_intent: paymentIntentId,
      reason,
    };
    if (refund_amount && refund_amount > 0) {
      refundParams.amount = Math.round(refund_amount * 100); // convert dollars to cents
    }

    const refund = await stripe.refunds.create(refundParams);

    // Update the order
    await base44.asServiceRole.entities.Order.update(order.id, {
      stripe_payment_status: refund.status === 'succeeded' ? 'refunded' : 'pending',
      status: 'cancelled',
      notes: `Refunded $${((refund.amount) / 100).toFixed(2)} via Stripe. Refund ID: ${refund.id}. ${order.notes || ''}`.trim(),
    });

    return Response.json({
      success: true,
      refund_id: refund.id,
      refund_status: refund.status,
      refund_amount: refund.amount / 100,
      currency: refund.currency,
      payment_intent_id: paymentIntentId,
      order_id: order.id,
      order_number: order.order_number,
    });
  } catch (error) {
    console.error('refundStripePayment error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});