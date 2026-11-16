import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { assertAuthenticated } from '../../shared/authGuard.ts';

// Called from the rating page — requires a logged-in user whose email matches the order
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { authorized, response, user } = await assertAuthenticated(base44);
    if (!authorized) return response;

    const { order_id, rating, comment } = await req.json();

    if (!order_id || !rating) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (rating < 1 || rating > 5) {
      return Response.json({ error: 'Rating must be between 1 and 5' }, { status: 400 });
    }

    // Fetch the order from the database — never trust client-supplied driver/customer fields
    const order = await base44.asServiceRole.entities.Order.get(order_id);
    if (!order) {
      return Response.json({ error: 'Order not found' }, { status: 404 });
    }

    // Only the customer who placed the order may rate it
    if (order.customer_email !== user.email) {
      return Response.json({ error: 'You can only rate your own orders' }, { status: 403 });
    }

    const driverId = order.driver_id;
    const driverName = order.driver_name || '';
    if (!driverId) {
      return Response.json({ error: 'No driver assigned to this order' }, { status: 400 });
    }

    // Prevent duplicate ratings
    const existing = await base44.asServiceRole.entities.DriverRating.filter({ order_id, customer_email: user.email });
    if (existing.length > 0) {
      return Response.json({ error: 'Already rated', already_rated: true }, { status: 409 });
    }

    // Save driver rating
    const ratingRecord = await base44.asServiceRole.entities.DriverRating.create({
      driver_id: driverId,
      driver_name: driverName,
      order_id,
      order_number: order.order_number || '',
      customer_email: user.email,
      customer_name: order.customer_name || '',
      rating,
      comment: comment || '',
    });

    // Save customer feedback (overall order experience)
    await base44.asServiceRole.entities.CustomerFeedback.create({
      order_id,
      order_number: order.order_number || '',
      customer_email: user.email,
      customer_name: order.customer_name || '',
      store_id: order.store_id || '',
      store_name: order.store_name || '',
      driver_name: driverName,
      rating,
      comment: comment || '',
    });

    // Recalculate driver average rating
    const allRatings = await base44.asServiceRole.entities.DriverRating.filter({ driver_id: driverId });
    const avg = allRatings.reduce((sum, r) => sum + r.rating, 0) / allRatings.length;
    await base44.asServiceRole.entities.Driver.update(driverId, { avg_rating: parseFloat(avg.toFixed(2)) });

    console.log(`Rating saved: ${rating}⭐ for driver ${driverName} on order ${order.order_number}`);
    return Response.json({ success: true, rating: ratingRecord, avg_rating: parseFloat(avg.toFixed(2)) });
  } catch (error) {
    console.error('submitDeliveryRating error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});