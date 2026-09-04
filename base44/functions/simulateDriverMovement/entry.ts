import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const DRIVER_ID = '6a0250b48c001cfd247c73ea';
const ORDER_NUMBER = 'SS-MRNYJTQO';

// Route waypoints: BEVERAGE KING (5705 S Olive St) → 1400 S Cherry St (delivery destination)
const ROUTE = [
  { lat: 34.2165, lng: -92.0072, label: 'Departing BEVERAGE KING with order' },
  { lat: 34.2160, lng: -92.0065, label: 'Heading south on Olive St' },
  { lat: 34.2150, lng: -92.0058, label: 'Continuing south' },
  { lat: 34.2140, lng: -92.0050, label: 'Approaching Cherry St' },
  { lat: 34.2130, lng: -92.0040, label: 'Turning onto Cherry St' },
  { lat: 34.2125, lng: -92.0035, label: 'On Cherry St, almost there' },
  { lat: 34.212, lng: -92.0032, label: 'Arrived at 1400 S Cherry St' },
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const driver = await base44.asServiceRole.entities.Driver.get(DRIVER_ID);
    const orders = await base44.asServiceRole.entities.Order.filter({ order_number: ORDER_NUMBER });
    const order = orders[0];
    if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });

    const currentLat = order.driver_current_latitude || driver.current_latitude;
    const currentLng = order.driver_current_longitude || driver.current_longitude;

    // Find current position in route — pick the next unvisited waypoint
    let currentIndex = 0;
    if (currentLat && currentLng) {
      for (let i = 0; i < ROUTE.length; i++) {
        const wp = ROUTE[i];
        const dist = Math.sqrt(Math.pow(wp.lat - currentLat, 2) + Math.pow(wp.lng - currentLng, 2));
        if (dist < 0.0005) { currentIndex = i; break; }
        if (wp.lat === currentLat && wp.lng === currentLng) { currentIndex = i; break; }
      }
    }

    const nextIndex = currentIndex + 1;

    // Already at final destination (delivery address)
    if (nextIndex >= ROUTE.length) {
      return Response.json({
        message: 'Justin has arrived at 1400 S Cherry St (delivery destination)',
        position: ROUTE[ROUTE.length - 1],
        arrived: true
      });
    }

    const nextWaypoint = ROUTE[nextIndex];
    const now = new Date().toISOString();

    await Promise.all([
      base44.asServiceRole.entities.Driver.update(DRIVER_ID, {
        current_latitude: nextWaypoint.lat,
        current_longitude: nextWaypoint.lng
      }),
      base44.asServiceRole.entities.Order.update(order.id, {
        driver_current_latitude: nextWaypoint.lat,
        driver_current_longitude: nextWaypoint.lng,
        driver_location_updated_at: now
      })
    ]);

    return Response.json({
      message: nextWaypoint.label,
      position: nextWaypoint,
      waypoint_index: nextIndex,
      total_waypoints: ROUTE.length,
      arrived: false
    });
  } catch (error) {
    console.error('simulateDriverMovement error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});