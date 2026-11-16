import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { assertAdmin } from '../../shared/authGuard.ts';

const LOW_STOCK_THRESHOLD = 5; // Alert when stock drops at or below this number

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { authorized, response } = await assertAdmin(base44);
    if (!authorized) return response;

    const managerEmail = Deno.env.get('STORE_MANAGER_EMAIL');
    if (!managerEmail) {
      return Response.json({ error: 'STORE_MANAGER_EMAIL secret not set' }, { status: 400 });
    }

    // Fetch all products that track quantity and are in stock
    const allProducts = await base44.asServiceRole.entities.Product.list();

    const lowStockProducts = allProducts.filter(p =>
      p.stock_quantity !== undefined &&
      p.stock_quantity !== null &&
      p.stock_quantity <= LOW_STOCK_THRESHOLD &&
      p.in_stock !== false
    );

    if (lowStockProducts.length === 0) {
      console.log('No low stock products found.');
      return Response.json({ success: true, message: 'All stock levels are healthy.', low_stock_count: 0 });
    }

    // Group by store
    const byStore = {};
    for (const p of lowStockProducts) {
      if (!byStore[p.store_id]) byStore[p.store_id] = [];
      byStore[p.store_id].push(p);
    }

    // Fetch stores (need name + email for direct store notification)
    const stores = await base44.asServiceRole.entities.Store.list();
    const storeMap = {};
    for (const s of stores) storeMap[s.id] = s;

    // Build email body
    const rows = Object.entries(byStore).map(([storeId, products]) => {
      const store = storeMap[storeId] || {};
      const storeName = store.name || storeId;
      const items = products.map(p =>
        `<tr>
          <td style="padding:6px 12px;border-bottom:1px solid #f0f0f0">${p.name}${p.brand ? ` (${p.brand})` : ''}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #f0f0f0">${p.volume || '—'}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #f0f0f0;color:${p.stock_quantity === 0 ? '#dc2626' : '#d97706'};font-weight:600">${p.stock_quantity}</td>
        </tr>`
      ).join('');
      return `
        <h3 style="margin:20px 0 8px;color:#1e3a5f">${storeName}</h3>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <thead>
            <tr style="background:#f8f9fa">
              <th style="padding:8px 12px;text-align:left;color:#666">Product</th>
              <th style="padding:8px 12px;text-align:left;color:#666">Size</th>
              <th style="padding:8px 12px;text-align:left;color:#666">Stock Qty</th>
            </tr>
          </thead>
          <tbody>${items}</tbody>
        </table>`;
    }).join('');

    const emailBody = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#1e3a5f;color:white;padding:20px 24px;border-radius:8px 8px 0 0">
          <h2 style="margin:0">⚠️ Low Stock Alert</h2>
          <p style="margin:4px 0 0;opacity:0.8;font-size:14px">${new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</p>
        </div>
        <div style="background:white;padding:20px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
          <p style="color:#444;margin-top:0"><strong>${lowStockProducts.length} product${lowStockProducts.length > 1 ? 's' : ''}</strong> across <strong>${Object.keys(byStore).length} store${Object.keys(byStore).length > 1 ? 's' : ''}</strong> are at or below the threshold of <strong>${LOW_STOCK_THRESHOLD} units</strong>.</p>
          ${rows}
          <p style="margin-top:24px;font-size:12px;color:#999">This is an automated alert from Alcohol Delivered. Threshold: ≤${LOW_STOCK_THRESHOLD} units.</p>
        </div>
      </div>`;

    // 1. Notify the central store manager
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: managerEmail,
      subject: `⚠️ Low Stock Alert — ${lowStockProducts.length} product${lowStockProducts.length > 1 ? 's' : ''} need restocking`,
      body: emailBody,
    });

    // 2. Also email each store directly with only their own low-stock items
    const storeNotified = [];
    for (const [storeId, products] of Object.entries(byStore)) {
      const store = storeMap[storeId];
      if (!store?.email || store.email === managerEmail) continue;
      const storeItems = products.map(p =>
        `<tr>
          <td style="padding:6px 12px;border-bottom:1px solid #f0f0f0">${p.name}${p.brand ? ` (${p.brand})` : ''}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #f0f0f0">${p.volume || '—'}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #f0f0f0;color:${p.stock_quantity === 0 ? '#dc2626' : '#d97706'};font-weight:600">${p.stock_quantity}</td>
        </tr>`
      ).join('');
      const storeBody = `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#1e3a5f;color:white;padding:20px 24px;border-radius:8px 8px 0 0">
            <h2 style="margin:0">⚠️ Low Stock Alert — ${store.name}</h2>
            <p style="margin:4px 0 0;opacity:0.8;font-size:14px">${new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</p>
          </div>
          <div style="background:white;padding:20px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
            <p style="color:#444;margin-top:0">The following items at your store are at or below <strong>${LOW_STOCK_THRESHOLD} units</strong>. Please restock soon.</p>
            <table style="width:100%;border-collapse:collapse;font-size:14px">
              <thead><tr style="background:#f8f9fa">
                <th style="padding:8px 12px;text-align:left;color:#666">Product</th>
                <th style="padding:8px 12px;text-align:left;color:#666">Size</th>
                <th style="padding:8px 12px;text-align:left;color:#666">Stock Qty</th>
              </tr></thead>
              <tbody>${storeItems}</tbody>
            </table>
            <p style="margin-top:24px;font-size:12px;color:#999">Automated alert from Alcohol Delivered · Threshold: ≤${LOW_STOCK_THRESHOLD} units</p>
          </div>
        </div>`;
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: store.email,
        subject: `⚠️ Low Stock Alert — ${products.length} item${products.length > 1 ? 's' : ''} need restocking at ${store.name}`,
        body: storeBody,
      });
      storeNotified.push(store.name);
    }

    console.log(`Low stock alert sent for ${lowStockProducts.length} products to ${managerEmail}${storeNotified.length ? ` + stores: ${storeNotified.join(', ')}` : ''}`);
    return Response.json({ success: true, low_stock_count: lowStockProducts.length, notified: managerEmail, stores_notified: storeNotified });

  } catch (error) {
    console.error('checkLowStock error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});