import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const { latitude, longitude } = await req.json();
    if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) return Response.json({ error: 'Valid coordinates required' }, { status: 400 });

    const drivers = await base44.asServiceRole.entities.Driver.filter({ email: user.email });
    const driver = drivers[0];
    if (!driver || !driver.is_active) return Response.json({ error: 'Active driver profile required' }, { status: 403 });

    await base44.asServiceRole.entities.Driver.update(driver.id, {
      current_latitude: Number(latitude),
      current_longitude: Number(longitude),
    });
    const activeOrders = await base44.asServiceRole.entities.Order.filter({ driver_id: driver.id, status: { $in: ['pickup_ready', 'in_transit'] } });
    const now = new Date().toISOString();
    for (const order of activeOrders) {
      await base44.asServiceRole.entities.Order.update(order.id, {
        driver_current_latitude: Number(latitude),
        driver_current_longitude: Number(longitude),
        driver_location_updated_at: now,
      });
    }
    return Response.json({ success: true, active_orders_updated: activeOrders.length });
  } catch (error) {
    console.error('[updateDriverLocation] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}