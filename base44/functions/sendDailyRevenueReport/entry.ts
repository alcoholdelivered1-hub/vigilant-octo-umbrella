import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { assertAdmin } from '../../shared/authGuard.ts';
import { createMimeMessage } from 'npm:mimetext@3.0.24';
import { gmailConnection } from '../../shared/retailerGmail.ts';
import { revenueDate, previousRevenueDate, revenueRecords, storeRevenueTotals } from '../../shared/storeRevenueDay.ts';

const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

function buildRawEmail(to, subject, htmlBody, senderEmail) {
  const message = createMimeMessage();
  message.setSender({ name: 'Alcohol Delivered Daily Reports', addr: senderEmail });
  message.setRecipient(to);
  message.setSubject(subject);
  message.addMessage({ contentType: 'text/html', data: htmlBody });
  return message.asEncoded();
}

export default async function(req) {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const base44 = createClientFromRequest(req);
    const { authorized, response } = await assertAdmin(base44);
    if (!authorized) return response;
    const { preview_only = false } = await req.json();
    if (typeof preview_only !== 'boolean') return Response.json({ error: 'Invalid preview selection' }, { status: 400 });
    const reportDate = previousRevenueDate();
    const windowEnd = new Date(new Date(`${reportDate}T00:00:00Z`).getTime() + 172800000).toISOString();
    const range = { $gte: `${reportDate}T00:00:00Z`, $lt: windowEnd };
    console.info('Daily revenue: loading store contacts');
    const ownerStores = await revenueRecords(base44.asServiceRole.entities.Store, {});
    console.info('Daily revenue: loading completed orders');
    const orders = await revenueRecords(base44.asServiceRole.entities.Order, { status: 'delivered', stripe_payment_status: 'paid', $or: [{ delivery_confirmed_at: range }, { delivery_confirmed_at: null, updated_date: range }] });
    console.info('Daily revenue: connecting business email');
    if (ownerStores.length > 200) return Response.json({ error: 'Daily reporting supports up to 200 stores per run.' }, { status: 400 });
    const completedOrders = orders.filter(order => revenueDate(order.delivery_confirmed_at || order.updated_date) === reportDate);
    const gmail = await gmailConnection(base44);
    const results = [];
    const fmt = n => `$${n.toFixed(2)}`;
    for (const ownerStore of ownerStores) {
      const managerEmail = ownerStore.email?.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(managerEmail || '')) {
        results.push({ store_id: ownerStore.id, store_name: ownerStore.name, skipped: 'Missing or invalid owner email' });
        continue;
      }
      const dayOrders = completedOrders.filter(order => order.store_id === ownerStore.id);
      const totals = storeRevenueTotals(dayOrders);
      const totalOrders = totals.orders;
      const totalRevenue = totals.sales;
      const totalTips = totals.tips;
      const totalDeliveryFees = totals.delivery;
      const stores = [{ store_name: escapeHTML(ownerStore.name), order_count: totalOrders, revenue: totalRevenue, delivery_fees: totalDeliveryFees, tips: totalTips }];

  const storeRows = stores.length > 0
    ? stores.map(s => `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 10px 12px; font-weight: 500;">${s.store_name}</td>
        <td style="padding: 10px 12px; text-align: center;">${s.order_count}</td>
        <td style="padding: 10px 12px; text-align: right;">${fmt(s.revenue)}</td>
        <td style="padding: 10px 12px; text-align: right;">${fmt(s.delivery_fees)}</td>
        <td style="padding: 10px 12px; text-align: right;">${fmt(s.tips)}</td>
      </tr>`).join('')
    : `<tr><td colspan="5" style="padding: 16px; text-align: center; color: #6b7280;">No delivered orders on this date.</td></tr>`;

  const formattedDate = new Date(reportDate + 'T12:00:00Z').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const htmlBody = `
<div style="font-family: sans-serif; max-width: 680px; margin: 0 auto; padding: 24px; color: #111827;">
  <div style="background:#19216b; border-radius:12px; padding:24px; margin-bottom:28px;">
    <img src="https://media.base44.com/images/public/69cf025b60e5f22c0c72f042/0c398d505_Untitled_Artwork.jpg" width="64" alt="Alcohol Delivered" style="display:block;border:0;margin-bottom:12px;">
    <p style="color:#ffffff;font-size:20px;font-weight:bold;margin:0 0 16px;">Alcohol Delivered</p>
    <h1 style="color: white; margin: 0 0 4px; font-size: 22px;">Daily Revenue Report: ${escapeHTML(ownerStore.name)}</h1>
    <p style="color: #93c5fd; margin: 0; font-size: 14px;">Your completed Alcohol Delivered sales for ${formattedDate}, Central Time.</p>
  </div>

  <!-- Summary Cards -->
  <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 28px;">
    <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 10px; padding: 16px;">
      <p style="margin: 0 0 4px; font-size: 12px; color: #16a34a; text-transform: uppercase; font-weight: 600;">Merchandise Sales</p>
      <p style="margin: 0; font-size: 28px; font-weight: 700; color: #15803d;">${fmt(totalRevenue)}</p>
    </div>
    <div style="background: #eff6ff; border: 1px solid #93c5fd; border-radius: 10px; padding: 16px;">
      <p style="margin: 0 0 4px; font-size: 12px; color: #2563eb; text-transform: uppercase; font-weight: 600;">Orders Delivered</p>
      <p style="margin: 0; font-size: 28px; font-weight: 700; color: #1d4ed8;">${totalOrders}</p>
    </div>
    <div style="background: #fefce8; border: 1px solid #fde047; border-radius: 10px; padding: 16px;">
      <p style="margin: 0 0 4px; font-size: 12px; color: #ca8a04; text-transform: uppercase; font-weight: 600;">Delivery Fees</p>
      <p style="margin: 0; font-size: 24px; font-weight: 700; color: #a16207;">${fmt(totalDeliveryFees)}</p>
    </div>
    <div style="background: #fdf4ff; border: 1px solid #e9d5ff; border-radius: 10px; padding: 16px;">
      <p style="margin: 0 0 4px; font-size: 12px; color: #9333ea; text-transform: uppercase; font-weight: 600;">Driver Tips</p>
      <p style="margin: 0; font-size: 24px; font-weight: 700; color: #7e22ce;">${fmt(totalTips)}</p>
    </div>
  </div>

  <p style="font-size:14px;line-height:1.6;">Items sold: ${dayOrders.reduce((sum, order) => sum + (order.items || []).reduce((count, item) => count + (Number.isFinite(item.quantity) ? item.quantity : 0), 0), 0)}<br>Average merchandise sale: ${fmt(totalOrders ? totalRevenue / totalOrders : 0)}<br>Tax collected: ${fmt(totals.tax)}<br>Service fees: ${fmt(totals.service)}<br>Customer order totals: ${fmt(totals.charged)}</p>
  ${totalOrders === 0 ? '<p>No paid orders were delivered for your store on this date.</p>' : ''}
  <p style="font-size:12px;color:#6b7280;">Merchandise sales exclude tax, delivery fees, service fees and driver tips. This report covers paid, delivered orders recorded in Alcohol Delivered, not all in-store POS sales, net profit or verified Stripe payouts; later refunds and adjustments are not included.</p>
  <!-- Store Breakdown Table -->
  <h2 style="font-size: 16px; font-weight: 700; margin-bottom: 12px;">Store Breakdown</h2>
  <table style="width: 100%; border-collapse: collapse; font-size: 14px; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden;">
    <thead>
      <tr style="background: #f9fafb;">
        <th style="padding: 10px 12px; text-align: left; color: #6b7280; font-weight: 600; font-size: 12px; text-transform: uppercase;">Store</th>
        <th style="padding: 10px 12px; text-align: center; color: #6b7280; font-weight: 600; font-size: 12px; text-transform: uppercase;">Orders</th>
        <th style="padding: 10px 12px; text-align: right; color: #6b7280; font-weight: 600; font-size: 12px; text-transform: uppercase;">Merchandise Sales</th>
        <th style="padding: 10px 12px; text-align: right; color: #6b7280; font-weight: 600; font-size: 12px; text-transform: uppercase;">Del. Fees</th>
        <th style="padding: 10px 12px; text-align: right; color: #6b7280; font-weight: 600; font-size: 12px; text-transform: uppercase;">Tips</th>
      </tr>
    </thead>
    <tbody>${storeRows}</tbody>
  </table>

  <p><a href="https://alcohol-delivered.biz/store/dashboard" style="color:#19216b;">View your store dashboard</a></p>
  <p style="font-size:13px;">Questions? Contact John Bess at 870-718-1521 or reply to this email.</p>
  <p style="font-size: 12px; color: #9ca3af; margin-top: 28px; text-align: center;">
    Alcohol Delivered · Pine Bluff, AR · Automated Daily Report
  </p>
</div>`.trim();

      const subject = `Daily Revenue Report | ${ownerStore.name} | ${reportDate}`;
      const raw = buildRawEmail(managerEmail, subject, htmlBody, 'alcohol.delivered1@gmail.com');
      if (preview_only) {
        results.push({ store_id: ownerStore.id, store_name: ownerStore.name, orders: totalOrders, merchandise_sales: totalRevenue, preview: true });
        continue;
      }
      try {
        const sentAlready = await gmail(`messages?q=${encodeURIComponent(`in:sent to:${managerEmail} subject:${JSON.stringify(subject)}`)}&maxResults=1`);
        if (sentAlready.messages?.length) {
          results.push({ store_id: ownerStore.id, skipped: 'Report already emailed for this store and date' });
          continue;
        }
        const sent = await gmail('messages/send', { method: 'POST', body: JSON.stringify({ raw }) });
        results.push({ store_id: ownerStore.id, sent: true, message_id: sent.id });
      } catch (error) {
        console.error('Store revenue email failed:', ownerStore.id, error.message);
        results.push({ store_id: ownerStore.id, error: error.message });
      }
    }
    const failures = results.filter(result => result.error);
    return Response.json({ success: failures.length === 0, preview: preview_only, report_date: reportDate, timezone: 'America/Chicago', sent: results.filter(result => result.sent).length, results }, { status: failures.length ? 500 : 200 });
  } catch (error) {
    console.error('Daily revenue reports failed:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}