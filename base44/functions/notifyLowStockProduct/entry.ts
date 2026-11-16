import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { assertAdmin } from '../../shared/authGuard.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { authorized, response } = await assertAdmin(base44);
    if (!authorized) return response;
    const { data } = await req.json();

    const managerEmail = Deno.env.get('STORE_MANAGER_EMAIL');
    if (!managerEmail) {
      return Response.json({ error: 'STORE_MANAGER_EMAIL secret not set' }, { status: 400 });
    }

    const product = data;
    if (!product) {
      return Response.json({ error: 'No product data provided' }, { status: 400 });
    }

    // Fetch store name
    let storeName = product.store_id;
    try {
      const store = await base44.asServiceRole.entities.Store.filter({ id: product.store_id });
      if (store.length) storeName = store[0].name;
    } catch (_) {}

    const stockQty = product.stock_quantity ?? 0;
    const isOutOfStock = stockQty === 0;
    const alertColor = isOutOfStock ? '#dc2626' : '#d97706';
    const alertLabel = isOutOfStock ? '🚨 OUT OF STOCK' : '⚠️ LOW STOCK';

    const emailBody = `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
        <div style="background:#1e3a5f;color:white;padding:20px 24px;border-radius:8px 8px 0 0">
          <h2 style="margin:0">${alertLabel}</h2>
          <p style="margin:4px 0 0;opacity:0.8;font-size:14px">${new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</p>
        </div>
        <div style="background:white;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
          <p style="margin-top:0;color:#444">A product has dropped below the minimum stock threshold:</p>
          <table style="width:100%;border-collapse:collapse;font-size:14px;background:#f9fafb;border-radius:8px;overflow:hidden">
            <tr><td style="padding:10px 14px;color:#666;width:40%">Product</td><td style="padding:10px 14px;font-weight:600">${product.name}${product.brand ? ` — ${product.brand}` : ''}</td></tr>
            <tr style="background:#fff"><td style="padding:10px 14px;color:#666">Store</td><td style="padding:10px 14px">${storeName}</td></tr>
            <tr><td style="padding:10px 14px;color:#666">Size</td><td style="padding:10px 14px">${product.volume || '—'}</td></tr>
            <tr style="background:#fff"><td style="padding:10px 14px;color:#666">Category</td><td style="padding:10px 14px;text-transform:capitalize">${product.category || '—'}</td></tr>
            <tr><td style="padding:10px 14px;color:#666">Stock Remaining</td><td style="padding:10px 14px;font-weight:700;font-size:18px;color:${alertColor}">${stockQty} unit${stockQty !== 1 ? 's' : ''}</td></tr>
          </table>
          <p style="margin-top:20px;font-size:12px;color:#999">This is an automated alert from Alcohol Delivered. Triggered when stock ≤ 4 units.</p>
        </div>
      </div>`;

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: managerEmail,
      subject: `${alertLabel}: ${product.name}${product.brand ? ` (${product.brand})` : ''} — ${stockQty} unit${stockQty !== 1 ? 's' : ''} left at ${storeName}`,
      body: emailBody,
    });

    console.log(`Low stock alert sent for product ${product.name} (qty: ${stockQty}) to ${managerEmail}`);
    return Response.json({ success: true, product: product.name, stock_quantity: stockQty });

  } catch (error) {
    console.error('notifyLowStockProduct error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});