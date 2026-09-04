import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { driver_id, order_id, order_number, driver_name, rating, comment } = await req.json();

  if (!driver_id || !order_id || !rating) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }
  if (rating < 1 || rating > 5) {
    return Response.json({ error: 'Rating must be between 1 and 5' }, { status: 400 });
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