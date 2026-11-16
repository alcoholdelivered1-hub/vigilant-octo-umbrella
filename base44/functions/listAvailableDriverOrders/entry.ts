import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { attachDriverCompliance } from '../../shared/driverAnnualCompliance.ts';
import { driverIsProductionQualified } from '../../shared/verifiedTaxDriverReadiness.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const drivers = await base44.asServiceRole.entities.Driver.filter({ email: user.email });
    const driver = (await attachDriverCompliance(base44, drivers))[0];
    if (!driver || !driver.is_active || driver.status === 'suspended') {
      return Response.json({ error: 'Active driver profile required.' }, { status: 403 });
    }
    if (!driverIsProductionQualified(driver)) {
      return Response.json({ error: 'Current annual ABC training, Server Awareness form and license evidence require administrator review before accepting deliveries; real background clearance and online status are also required.' }, { status: 403 });
    }

    const orders = await base44.asServiceRole.entities.Order.filter({
      status: { $in: ['confirmed', 'preparing', 'pickup_ready'] },
      driver_id: { $in: [null, ''] },
      stripe_payment_status: 'paid',
      id_verified_at_checkout: true,
      is_in_legal_zone: true,
    }, '-created_date', 30);

    const available = orders
      .filter((order) => !order.driver_id)
      .sort((a, b) => new Date(b.created_date || 0).getTime() - new Date(a.created_date || 0).getTime())
      .slice(0, 30)
      .map((order) => ({
        id: order.id,
        order_number: order.order_number,
        store_name: order.store_name,
        delivery_address: order.delivery_address,
        delivery_latitude: order.delivery_latitude,
        delivery_longitude: order.delivery_longitude,
        items: order.items,
        total: order.total,
        tip: order.tip || 0,
        distance_miles: order.distance_miles || 0,
        created_date: order.created_date,
      }));

    return Response.json({ success: true, orders: available });
  } catch (error) {
    console.error('[listAvailableDriverOrders] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}