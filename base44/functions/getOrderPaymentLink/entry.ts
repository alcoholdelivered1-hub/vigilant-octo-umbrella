import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import Stripe from 'npm:stripe@14.21.0';
import { secrets } from 'base44:runtime';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { order_id } = await req.json();
    if (!order_id) return Response.json({ error: 'order_id is required' }, { status: 400 });

    const orders = await base44.asServiceRole.entities.Order.filter({ id: order_id }, 'order_number', 1);
    const order = orders[0];
    if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });
    if (!order.stripe_session_id) return Response.json({ error: 'This order has no payment session on file' }, { status: 400 });

    const stripe = new Stripe(secrets.get('STRIPE_SECRET_KEY'));
    const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id);

    if (!session.url) return Response.json({ error: 'Payment link is no longer active (session expired)' }, { status: 410 });

    return Response.json({ url: session.url, expires_at: session.expires_at, payment_status: session.payment_status });
  } catch (error) {
    console.error('getOrderPaymentLink error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}