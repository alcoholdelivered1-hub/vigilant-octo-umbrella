import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { order_id, order_number, rating, comment } = await req.json();

  if (!order_id || !rating) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }
  if (rating < 1 || rating > 5) {
    return Response.json({ error: 'Rating must be between 1 and 5' }, { status: 400 });
  }

  // Verify the caller owns this order (customer or assigned driver) before accepting a rating
  const orders = await base44.asServiceRole.entities.Order.filter({ id: order_id });
  const order = orders[0];
  if (!order) {
    return Response.json({ error: 'Order not found' }, { status: 404 });
  }

  // Derive the rated driver from the order record — never trust a client-supplied driver_id,
  // which would let a caller attribute ratings to an arbitrary driver.
  const driver_id = order.driver_id;
  const driver_name = order.driver_name || '';
  if (!driver_id) {
    return Response.json({ error: 'No driver is assigned to this order' }, { status: 409 });
  }

  // Ratings are only accepted for completed deliveries.
  if (order.status !== 'delivered') {
    return Response.json({ error: 'You can rate this delivery once it is completed' }, { status: 409 });
  }

  const isCustomer = order.customer_email === user.email;
  const isDriver = order.driver_email === user.email;
  if (!isCustomer && !isDriver && user.role !== 'admin') {
    return Response.json({ error: 'You are not authorized to rate this order' }, { status: 403 });
  }

  // Prevent duplicate ratings for the same order
  const existing = await base44.entities.DriverRating.filter({ order_id, customer_email: user.email });
  if (existing.length > 0) {
    return Response.json({ error: 'You have already rated this delivery' }, { status: 409 });
  }

  const ratingRecord = await base44.entities.DriverRating.create({
    driver_id,
    driver_name: driver_name || '',
    order_id,
    order_number: order_number || '',
    customer_email: user.email,
    customer_name: user.full_name || '',
    rating,
    comment: comment || '',
  });

  // Recalculate and update the driver's average rating (service role — users cannot update Driver directly)
  const allRatings = await base44.asServiceRole.entities.DriverRating.filter({ driver_id });
  const avg = allRatings.reduce((sum, r) => sum + r.rating, 0) / allRatings.length;
  await base44.asServiceRole.entities.Driver.update(driver_id, { avg_rating: parseFloat(avg.toFixed(2)) });

  return Response.json({ success: true, rating: ratingRecord, avg_rating: avg });
});