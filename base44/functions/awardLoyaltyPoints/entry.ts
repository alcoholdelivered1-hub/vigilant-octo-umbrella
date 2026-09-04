import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Awards 1 loyalty point per $1 spent when an order is delivered
Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const base44 = createClientFromRequest(req);

    // Auth: must be authenticated via platform (admin user or automation)
    const authenticated = await base44.auth.isAuthenticated().catch(() => false);
    if (!authenticated) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    // If a user is present, they must be an admin (automations have no user)
    const currentUser = await base44.auth.me().catch(() => null);
    if (currentUser && currentUser.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const order = body.data;
    if (!order || order.status !== 'delivered') {
      return Response.json({ skipped: true, reason: 'Not a delivered order' });
    }

    const orderTotal = order.total || 0;
    const pointsToAward = Math.floor(orderTotal); // 1 point per $1

    // Find the user by email
    const users = await base44.asServiceRole.entities.User.filter({ email: order.customer_email });
    if (!users || users.length === 0) {
      return Response.json({ skipped: true, reason: 'User not found' });
    }

    const user = users[0];
    const currentPoints = user.loyalty_points || 0;
    const currentSpent = user.loyalty_total_spent || 0;

    await base44.asServiceRole.entities.User.update(user.id, {
      loyalty_points: currentPoints + pointsToAward,
      loyalty_total_spent: currentSpent + orderTotal,
    });

    return Response.json({
      success: true,
      points_awarded: pointsToAward,
      new_total: currentPoints + pointsToAward,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});