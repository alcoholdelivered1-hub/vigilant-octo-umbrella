import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

export default async function(req) {
  try {
    const { order_number, receipt_token } = await req.json().catch(() => ({}));
    if (!order_number || !receipt_token) {
      return Response.json({ error: 'Order number and receipt token are required' }, { status: 400 });
    }
    if (typeof receipt_token !== 'string' || receipt_token.length < 16 || receipt_token.length > 64) {
      return Response.json({ error: 'Invalid receipt token' }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);
    const orders = await base44.asServiceRole.entities.Order.filter({ order_number }, { limit: 5 });
    const order = orders.items?.[0];
    if (!order) {
      return Response.json({ error: 'Order not found' }, { status: 404 });
    }

    // The receipt token is a server-generated unguessable UUID stored on the order
    // at creation time. It is the sole credential for anonymous receipt access —
    // the timestamp-derived order number and customer email are no longer accepted.
    if (!order.receipt_token || order.receipt_token !== receipt_token) {
      return Response.json({ error: 'Order not found' }, { status: 404 });
    }

    return Response.json({
      order_number: order.order_number,
      customer_name: order.customer_name,
      customer_email: order.customer_email,
      store_name: order.store_name,
      delivery_address: order.delivery_address,
      items: order.items || [],
      subtotal: order.subtotal,
      delivery_fee: order.delivery_fee,
      mileage_surcharge: order.mileage_surcharge,
      service_fee: order.service_fee,
      tax: order.tax,
      tip: order.tip,
      total: order.total,
      status: order.status,
      stripe_payment_status: order.stripe_payment_status,
      created_date: order.created_date,
      delivered_at: order.delivery_confirmed_at,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}