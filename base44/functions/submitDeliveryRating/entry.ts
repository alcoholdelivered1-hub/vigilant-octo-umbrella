import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { verifyRatingToken } from '../../shared/ratingToken.ts';

// Public endpoint — called from the rating page via email link (no login required)
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { token, rating, comment } = await req.json();

    if (!token || !rating) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (rating < 1 || rating > 5) {
      return Response.json({ error: 'Rating must be between 1 and 5' }, { status: 400 });
    }

    // Verify the HMAC signature of the token — rejects forged tokens
    const tokenData = await verifyRatingToken(token);
    if (!tokenData) {
      return Response.json({ error: 'Invalid or expired token' }, { status: 400 });
    }
    const { orderId, driverId } = tokenData;

    // Fetch order from DB — do not trust client-supplied fields
    const orders = await base44.asServiceRole.entities.Order.filter({ id: orderId });
    const order = orders[0];
    if (!order) {
      return Response.json({ error: 'Order not found' }, { status: 404 });
    }

    // Verify the driver_id in the token matches the order's actual driver
    if (order.driver_id !== driverId) {
      return Response.json({ error: 'Invalid token' }, { status: 400 });
    }

    // Use only DB-derived fields
    const order_id = orderId;
    const driver_id = driverId;
    const order_number = order.order_number || '';
    const driver_name = order.driver_name || '';
    const customer_email = order.customer_email;
    const customer_name = order.customer_name || '';
    const store_id = order.store_id || '';
    const store_name = order.store_name || '';

    // Prevent duplicate ratings
    const existing = await base44.asServiceRole.entities.DriverRating.filter({ order_id, customer_email });
    if (existing.length > 0) {
      return Response.json({ error: 'Already rated', already_rated: true }, { status: 409 });
    }

    // Save driver rating
    const ratingRecord = await base44.asServiceRole.entities.DriverRating.create({
      driver_id,
      driver_name: driver_name || '',
      order_id,
      order_number: order_number || '',
      customer_email,
      customer_name: customer_name || '',
      rating,
      comment: comment || '',
    });

    // Save customer feedback (overall order experience)
    await base44.asServiceRole.entities.CustomerFeedback.create({
      order_id,
      order_number: order_number || '',
      customer_email,
      customer_name: customer_name || '',
      store_id: store_id || '',
      store_name: store_name || '',
      driver_name: driver_name || '',
      rating,
      comment: comment || '',
    });

    // Recalculate driver average rating
    const allRatings = await base44.asServiceRole.entities.DriverRating.filter({ driver_id });
    const avg = allRatings.reduce((sum, r) => sum + r.rating, 0) / allRatings.length;
    await base44.asServiceRole.entities.Driver.update(driver_id, { avg_rating: parseFloat(avg.toFixed(2)) });

    console.log(`Rating saved: ${rating}⭐ for driver ${driver_name} on order ${order_number}`);
    return Response.json({ success: true, rating: ratingRecord, avg_rating: parseFloat(avg.toFixed(2)) });
  } catch (error) {
    console.error('submitDeliveryRating error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});