import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { assertAdmin } from '../../shared/authGuard.ts';

// Automation entrypoint for the scheduled "Daily Operations Digest" workflow.
// Requires an authenticated admin: scans low stock, emails the store
// manager, upserts per-store DailyReport records for yesterday, and emails a
// revenue digest. Consolidates the admin-gated checkLowStock /
// calculateDailySales / sendDailyRevenueReport logic into one callable function.
const LOW_STOCK_THRESHOLD = 5;
const fmt = (n) => `$${n.toFixed(2)}`;

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const access = await assertAdmin(base44);
    if (!access.authorized) return access.response;
    // MANAGER_EMAIL is the authoritative manager address; a malformed value is
    // skipped so it can never produce failed sends.
    const candidateEmail = Deno.env.get('MANAGER_EMAIL') || Deno.env.get('STORE_MANAGER_EMAIL');
    const managerEmail = candidateEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidateEmail.trim())
      ? candidateEmail.trim().toLowerCase()
      : null;

    const now = new Date();
    const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
    const reportDate = yesterday.toISOString().split('T')[0];

    // --- Low stock scan ---
    const products = await base44.entities.Product.list();
    const lowStock = products.filter((p) => p.stock_quantity != null && p.stock_quantity <= LOW_STOCK_THRESHOLD && p.in_stock !== false);
    const stores = await base44.entities.Store.list();
    const storeMap = {}; for (const s of stores) storeMap[s.id] = s;
    let lowStockAlerts = 0;
    if (lowStock.length > 0 && managerEmail) {
      const rows = lowStock.map((p) => `<tr><td style="padding:6px 12px">${p.name}</td><td style="padding:6px 12px">${storeMap[p.store_id]?.name || p.store_id}</td><td style="padding:6px 12px;font-weight:600;color:${p.stock_quantity === 0 ? '#dc2626' : '#d97706'}">${p.stock_quantity}</td></tr>`).join('');
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: managerEmail,
        subject: `⚠️ Low Stock Alert — ${lowStock.length} product(s) need restocking`,
        body: `<div style="font-family:sans-serif;max-width:600px"><h2>⚠️ Low Stock Alert</h2><p>${lowStock.length} product(s) at or below ${LOW_STOCK_THRESHOLD} units.</p><table style="width:100%;border-collapse:collapse;font-size:14px"><thead><tr style="background:#f8f9fa"><th align="left" style="padding:8px 12px">Product</th><th align="left" style="padding:8px 12px">Store</th><th align="left" style="padding:8px 12px">Qty</th></tr></thead><tbody>${rows}</tbody></table></div>`,
      });
      lowStockAlerts = lowStock.length;
    }

    // --- Daily revenue aggregation + DailyReport upsert ---
    const allOrders = await base44.entities.Order.filter({ status: 'delivered' });
    const dayOrders = allOrders.filter((o) => (o.delivery_confirmed_at || o.updated_date || '').slice(0, 10) === reportDate);
    const storeAgg = {};
    for (const o of dayOrders) {
      const k = o.store_id || 'unknown';
      if (!storeAgg[k]) storeAgg[k] = { name: o.store_name || 'Unknown Store', orders: 0, revenue: 0, fees: 0, tips: 0 };
      storeAgg[k].orders += 1; storeAgg[k].revenue += o.total || 0; storeAgg[k].fees += o.delivery_fee || 0; storeAgg[k].tips += o.tip || 0;
    }
    for (const [sid, a] of Object.entries(storeAgg)) {
      const existing = await base44.entities.DailyReport.filter({ report_date: reportDate, store_id: sid });
      const payload = {
        report_date: reportDate, store_id: sid, store_name: a.name,
        total_revenue: parseFloat(a.revenue.toFixed(2)), total_orders: a.orders,
        avg_order_value: a.orders ? parseFloat((a.revenue / a.orders).toFixed(2)) : 0,
        delivery_fees_collected: parseFloat(a.fees.toFixed(2)), items_sold: 0,
      };
      if (existing.length) await base44.entities.DailyReport.update(existing[0].id, payload);
      else await base44.entities.DailyReport.create(payload);
    }

    const totalRevenue = dayOrders.reduce((s, o) => s + (o.total || 0), 0);
    const totalFees = dayOrders.reduce((s, o) => s + (o.delivery_fee || 0), 0);
    const totalTips = dayOrders.reduce((s, o) => s + (o.tip || 0), 0);
    const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const storeRows = Object.values(storeAgg).sort((a, b) => b.revenue - a.revenue)
      .map((s) => `<tr><td style="padding:8px 12px">${esc(s.name)}</td><td align="center" style="padding:8px 12px">${s.orders}</td><td align="right" style="padding:8px 12px">${fmt(s.revenue)}</td></tr>`).join('')
      || `<tr><td colspan="3" style="padding:16px;text-align:center;color:#6b7280">No delivered orders on this date.</td></tr>`;

    // --- Compliance incidents recorded on the report date ---
    const dayStart = `${reportDate}T00:00:00.000Z`;
    const nextDay = new Date(yesterday); nextDay.setDate(nextDay.getDate() + 1);
    const dayEnd = `${nextDay.toISOString().split('T')[0]}T00:00:00.000Z`;
    const incidents = await base44.entities.ComplianceIncident.filter({
      $or: [
        { incident_date: { $gte: dayStart, $lt: dayEnd } },
        { created_date: { $gte: dayStart, $lt: dayEnd } },
      ],
    });
    const incidentRows = incidents.map((i) => `<tr><td style="padding:8px 12px">${esc(i.incident_type)}</td><td style="padding:8px 12px">${esc(i.store_name || '')}${i.order_number ? ` · #${esc(i.order_number)}` : ''}</td><td style="padding:8px 12px">${esc(i.reason)}</td><td align="center" style="padding:8px 12px">${i.is_resolved ? 'Resolved' : 'Open'}</td></tr>`).join('')
      || `<tr><td colspan="4" style="padding:16px;text-align:center;color:#6b7280">No compliance incidents were recorded on this date.</td></tr>`;

    // --- Team report email: every admin user plus the store manager ---
    const teamUsers = await base44.entities.User.list();
    const teamEmails = [...new Set([
      ...teamUsers.filter((u) => u.role === 'admin' && u.email).map((u) => u.email.trim().toLowerCase()),
      ...(managerEmail ? [managerEmail] : []),
    ])];
    const variables = {
      report_date: reportDate,
      total_revenue: fmt(totalRevenue),
      total_orders: String(dayOrders.length),
      delivery_fees: fmt(totalFees),
      tips: fmt(totalTips),
      incident_count: String(incidents.length),
      store_breakdown_html: `<table style="width:100%;border-collapse:collapse;font-size:14px;border:1px solid #e5e7eb"><thead><tr style="background:#f9fafb"><th align="left" style="padding:8px 12px">Store</th><th style="padding:8px 12px">Orders</th><th align="right" style="padding:8px 12px">Revenue</th></tr></thead><tbody>${storeRows}</tbody></table>`,
      incidents_html: `<table style="width:100%;border-collapse:collapse;font-size:14px;border:1px solid #e5e7eb"><thead><tr style="background:#f9fafb"><th align="left" style="padding:8px 12px">Type</th><th align="left" style="padding:8px 12px">Store / order</th><th align="left" style="padding:8px 12px">Reason</th><th style="padding:8px 12px">Status</th></tr></thead><tbody>${incidentRows}</tbody></table>`,
    };
    const sendResults = [];
    for (const email of teamEmails) {
      try {
        const result = await base44.asServiceRole.integrations.Core.SendEmail({
          to: email,
          template_name: 'DailyTeamReport',
          category: 'transactional',
          variables,
        });
        sendResults.push({ email, sent: result?.success !== false, reason: result?.success === false ? result.reason : null });
      } catch (error) {
        sendResults.push({ email, sent: false, reason: error.message });
      }
    }

    return Response.json({
      success: true, date: reportDate, low_stock_alerts: lowStockAlerts,
      orders: dayOrders.length, total_revenue: totalRevenue, compliance_incidents: incidents.length,
      recipients: sendResults.length, failed_sends: sendResults.filter((r) => !r.sent),
    });
  } catch (error) {
    console.error('dailyOperationsDigest error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}