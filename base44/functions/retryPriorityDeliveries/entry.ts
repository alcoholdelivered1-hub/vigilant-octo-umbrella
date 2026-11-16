import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { assertAdmin } from '../../shared/authGuard.ts';
import { PRIORITY_STORE_IDS, ACTIVE_DELIVERY_STATUSES, priorityQueueQuery, dispatchPriorityOrder } from '../../shared/priorityDeliveries.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const access = await assertAdmin(base44);
    if (!access.authorized) return access.response;
    const body = await req.json();
    const dryRun = body.dry_run === true;
    // Free completed priority assignments only when the driver has no active order at any retailer.
    const terminal = await base44.entities.Order.filter({ store_id: { $in: PRIORITY_STORE_IDS }, status: { $in: ['delivered', 'cancelled', 'refused'] }, driver_id: { $exists: true } }, '-updated_date', 20);
    let released = 0;
    for (const driverId of [...new Set(terminal.map(o => o.driver_id).filter(id => id && !id.startsWith('doordash:')))]) {
      const active = await base44.entities.Order.filter({ driver_id: driverId, status: { $in: ACTIVE_DELIVERY_STATUSES } }, '-updated_date', 1);
      if (!active.length && !dryRun) {
        const result = await base44.entities.Driver.updateMany({ id: driverId, status: 'on_delivery', is_active: true }, { $set: { status: 'available' } });
        released += result.updated;
      }
    }
    const orders = await base44.entities.Order.filter(priorityQueueQuery, 'created_date', 10);
    const results = [];
    for (const order of orders) results.push({ order_id: order.id, ...await dispatchPriorityOrder(base44, order, dryRun) });
    return Response.json({ dry_run: dryRun, drivers_released: released, checked: orders.length, results });
  } catch (error) {
    console.error('Priority delivery retry failed:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}