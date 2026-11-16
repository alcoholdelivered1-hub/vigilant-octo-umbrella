import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { assertAdmin } from '../../shared/authGuard.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let body = {};
    try { body = await req.json(); } catch (_) {}

    const { authorized, response } = await assertAdmin(base44);
    if (!authorized) return response;
    
    const targetDate = body.date || (() => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return d.toISOString().split('T')[0];
    })();

    const dayStart = new Date(`${targetDate}T00:00:00.000Z`).toISOString();
    const dayEnd   = new Date(`${targetDate}T23:59:59.999Z`).toISOString();

    // Fetch delivered orders for that day
    const orders = await base44.asServiceRole.entities.Order.filter({
      status: 'delivered',
    });

    // Filter by date manually (created_date range)
    const dayOrders = orders.filter(o => {
      const d = o.delivery_confirmed_at || o.updated_date || o.created_date;
      return d >= dayStart && d <= dayEnd;
    });

    // Group by store
    const storeMap = {};
    for (const order of dayOrders) {
      const sid = order.store_id;
      if (!storeMap[sid]) {
        storeMap[sid] = {
          store_id: sid,
          store_name: order.store_name || sid,
          total_revenue: 0,
          total_orders: 0,
          delivery_fees_collected: 0,
          items_sold: 0,
        };
      }
      storeMap[sid].total_revenue += order.total || 0;
      storeMap[sid].total_orders += 1;
      storeMap[sid].delivery_fees_collected += order.delivery_fee || 0;
      storeMap[sid].items_sold += (order.items || []).reduce((sum, i) => sum + (i.quantity || 1), 0);
    }

    // Upsert DailyReport records per store
    const results = [];
    for (const sid of Object.keys(storeMap)) {
      const data = storeMap[sid];
      const avg_order_value = data.total_orders > 0
        ? parseFloat((data.total_revenue / data.total_orders).toFixed(2))
        : 0;

      // Check if report already exists for this date+store
      const existing = await base44.asServiceRole.entities.DailyReport.filter({
        report_date: targetDate,
        store_id: sid,
      });

      const payload = {
        report_date: targetDate,
        store_id: sid,
        store_name: data.store_name,
        total_revenue: parseFloat(data.total_revenue.toFixed(2)),
        total_orders: data.total_orders,
        avg_order_value,
        delivery_fees_collected: parseFloat(data.delivery_fees_collected.toFixed(2)),
        items_sold: data.items_sold,
      };

      if (existing.length > 0) {
        await base44.asServiceRole.entities.DailyReport.update(existing[0].id, payload);
        results.push({ action: 'updated', store: data.store_name, date: targetDate });
      } else {
        await base44.asServiceRole.entities.DailyReport.create(payload);
        results.push({ action: 'created', store: data.store_name, date: targetDate });
      }
    }

    console.log(`Daily sales calculated for ${targetDate}: ${results.length} store(s) processed`);
    return Response.json({
      success: true,
      date: targetDate,
      stores_processed: results.length,
      total_orders: dayOrders.length,
      results,
    });

  } catch (error) {
    console.error('calculateDailySales error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});