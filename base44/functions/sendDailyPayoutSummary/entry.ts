import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { assertAdmin } from '../../shared/authGuard.ts';
import { secrets } from 'base44:runtime';

const STRIPE_API = 'https://api.stripe.com/v1';

function fmtCurrency(amount, currency = 'usd') {
  const value = (amount || 0) / 100;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(value);
}

function fmtDate(date) {
  return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

// Returns { start, end } UTC timestamps for "yesterday" in America/Chicago.
function yesterdayRangeCST() {
  const now = new Date();
  // Shift to America/Chicago (CST = UTC-6, CDT = UTC-5). Use toLocaleString to get correct offset.
  const cstString = now.toLocaleString('en-US', { timeZone: 'America/Chicago' });
  const cstNow = new Date(cstString);
  const cstYesterday = new Date(cstNow);
  cstYesterday.setDate(cstYesterday.getDate() - 1);
  const start = new Date(cstYesterday);
  start.setHours(0, 0, 0, 0);
  const end = new Date(cstYesterday);
  end.setHours(23, 59, 59, 999);
  return {
    start: Math.floor(start.getTime() / 1000),
    end: Math.floor(end.getTime() / 1000),
    dateLabel: fmtDate(cstYesterday),
  };
}

// Returns { start, end } ISO strings for the last 7 days in America/Chicago.
function lastSevenDaysRangeCST() {
  const now = new Date();
  const cstString = now.toLocaleString('en-US', { timeZone: 'America/Chicago' });
  const cstNow = new Date(cstString);
  const end = new Date(cstNow);
  end.setHours(23, 59, 59, 999);
  const start = new Date(cstNow);
  start.setDate(start.getDate() - 6);
  start.setHours(0, 0, 0, 0);
  return {
    start: Math.floor(start.getTime() / 1000),
    end: Math.floor(end.getTime() / 1000),
    startLabel: fmtDate(start),
    endLabel: fmtDate(end),
  };
}

async function stripeRequest(path, params = {}, method = 'GET') {
  const url = method === 'GET'
    ? `${STRIPE_API}${path}?${new URLSearchParams(params).toString()}`
    : `${STRIPE_API}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${secrets.get('STRIPE_SECRET_KEY')}`,
      'Stripe-Version': '2025-10-29.clover',
    },
    ...(method !== 'GET' ? { body: new URLSearchParams(params).toString() } : {}),
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Stripe API ${path}: ${data.error?.message || res.status}`);
  return data;
}

// Paginate through all payouts in a date range.
async function fetchPayoutsInRange(startTs, endTs) {
  const payouts = [];
  let hasMore = true;
  let startingAfter = undefined;
  while (hasMore) {
    const params = {
      'created[gte]': startTs,
      'created[lte]': endTs,
      limit: 100,
    };
    if (startingAfter) params.starting_after = startingAfter;
    const data = await stripeRequest('/payouts', params);
    payouts.push(...(data.data || []));
    hasMore = data.has_more;
    startingAfter = data.data?.length ? data.data[data.data.length - 1].id : undefined;
  }
  return payouts;
}

// Paginate through all charges in a date range, grouped by customer.
async function fetchChargesByCustomer(startTs, endTs) {
  const customerMap = new Map();
  let hasMore = true;
  let startingAfter = undefined;
  while (hasMore) {
    const params = {
      'created[gte]': startTs,
      'created[lte]': endTs,
      limit: 100,
    };
    if (startingAfter) params.starting_after = startingAfter;
    const data = await stripeRequest('/charges', params);
    for (const charge of data.data || []) {
      if (charge.refunded || charge.amount === 0) continue;
      const customerId = charge.customer || 'guest_' + (charge.billing_details?.email || charge.id);
      const customerName = charge.billing_details?.name || charge.receipt_email || 'Guest customer';
      const customerEmail = charge.billing_details?.email || charge.receipt_email || '';
      const existing = customerMap.get(customerId) || { name: customerName, email: customerEmail, total_cents: 0, charge_count: 0 };
      existing.total_cents += charge.amount;
      existing.charge_count += 1;
      customerMap.set(customerId, existing);
    }
    hasMore = data.has_more;
    startingAfter = data.data?.length ? data.data[data.data.length - 1].id : undefined;
  }
  return Array.from(customerMap.values()).sort((a, b) => b.total_cents - a.total_cents);
}

const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

export default async function(req) {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const base44 = createClientFromRequest(req);
    const { authorized, response } = await assertAdmin(base44);
    if (!authorized) return response;

    const { preview_only = false } = await req.json().catch(() => ({}));

    const yRange = yesterdayRangeCST();
    const wRange = lastSevenDaysRangeCST();

    // Fetch yesterday's payouts and last 7 days of charges in parallel.
    const [payouts, customerTotals] = await Promise.all([
      fetchPayoutsInRange(yRange.start, yRange.end),
      fetchChargesByCustomer(wRange.start, wRange.end),
    ]);

    const payoutTotalCents = payouts.reduce((sum, p) => sum + (p.amount || 0), 0);
    const payoutCurrency = payouts[0]?.currency || 'usd';
    const weeklyTotalCents = customerTotals.reduce((sum, c) => sum + c.total_cents, 0);
    const weeklyChargeCount = customerTotals.reduce((sum, c) => sum + c.charge_count, 0);

    const summary = {
      payout_date: yRange.dateLabel,
      payout_count: payouts.length,
      payout_total: fmtCurrency(payoutTotalCents, payoutCurrency),
      payout_total_raw: payoutTotalCents,
      payout_currency: payoutCurrency.toUpperCase(),
      week_start: wRange.startLabel,
      week_end: wRange.endLabel,
      weekly_customer_count: customerTotals.length,
      weekly_charge_count: weeklyChargeCount,
      weekly_total: fmtCurrency(weeklyTotalCents, payoutCurrency),
      top_customers: customerTotals.slice(0, 20).map(c => ({
        name: c.name,
        email: c.email,
        total: fmtCurrency(c.total_cents, payoutCurrency),
        charges: c.charge_count,
      })),
    };

    if (preview_only) {
      return Response.json({ preview: true, ...summary });
    }

    // Build HTML email body.
    const customerRows = summary.top_customers.length > 0
      ? summary.top_customers.map((c, i) => `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 10px 12px; font-weight: 500;">${i + 1}</td>
          <td style="padding: 10px 12px;">${escapeHTML(c.name)}</td>
          <td style="padding: 10px 12px; color: #6b7280; font-size: 13px;">${escapeHTML(c.email)}</td>
          <td style="padding: 10px 12px; text-align: center;">${c.charges}</td>
          <td style="padding: 10px 12px; text-align: right; font-weight: 600;">${escapeHTML(c.total)}</td>
        </tr>`).join('')
      : `<tr><td colspan="5" style="padding: 16px; text-align: center; color: #6b7280;">No charges in the last 7 days.</td></tr>`;

    const htmlBody = `
<div style="font-family: 'DM Sans', Helvetica, Arial, sans-serif; max-width: 680px; margin: 0 auto; padding: 24px; color: #0f1729;">
  <div style="background:#19216b; border-radius:12px; padding:24px; margin-bottom:28px;">
    <img src="https://media.base44.com/images/public/69cf025b60e5f22c0c72f042/0c398d505_Untitled_Artwork.jpg" width="64" alt="Alcohol Delivered" style="display:block;border:0;margin-bottom:12px;">
    <p style="color:#ffffff;font-size:20px;font-weight:bold;margin:0 0 16px;">Alcohol Delivered</p>
    <h1 style="color:white;margin:0 0 4px;font-size:22px;">Daily Stripe Payout &amp; Customer Summary</h1>
    <p style="color:#93c5fd;margin:0;font-size:14px;">Payouts for ${escapeHTML(summary.payout_date)} · Customer activity for ${escapeHTML(summary.week_start)} through ${escapeHTML(summary.week_end)}</p>
  </div>

  <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin-bottom:28px;">
    <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:16px;">
      <p style="margin:0 0 4px;font-size:12px;color:#16a34a;text-transform:uppercase;font-weight:600;">Yesterday's Payouts</p>
      <p style="margin:0;font-size:28px;font-weight:700;color:#15803d;">${escapeHTML(summary.payout_total)}</p>
      <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">${summary.payout_count} payout${summary.payout_count === 1 ? '' : 's'} deposited</p>
    </div>
    <div style="background:#eff6ff;border:1px solid #93c5fd;border-radius:10px;padding:16px;">
      <p style="margin:0 0 4px;font-size:12px;color:#2563eb;text-transform:uppercase;font-weight:600;">7-Day Customer Revenue</p>
      <p style="margin:0;font-size:28px;font-weight:700;color:#1d4ed8;">${escapeHTML(summary.weekly_total)}</p>
      <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">${summary.weekly_charge_count} charges from ${summary.weekly_customer_count} customers</p>
    </div>
  </div>

  <h2 style="font-size:16px;font-weight:700;margin-bottom:12px;">Top Customers (Last 7 Days)</h2>
  <table style="width:100%;border-collapse:collapse;font-size:14px;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
    <thead>
      <tr style="background:#f9fafb;">
        <th style="padding:10px 12px;text-align:left;color:#6b7280;font-weight:600;font-size:12px;text-transform:uppercase;">#</th>
        <th style="padding:10px 12px;text-align:left;color:#6b7280;font-weight:600;font-size:12px;text-transform:uppercase;">Customer</th>
        <th style="padding:10px 12px;text-align:left;color:#6b7280;font-weight:600;font-size:12px;text-transform:uppercase;">Email</th>
        <th style="padding:10px 12px;text-align:center;color:#6b7280;font-weight:600;font-size:12px;text-transform:uppercase;">Charges</th>
        <th style="padding:10px 12px;text-align:right;color:#6b7280;font-weight:600;font-size:12px;text-transform:uppercase;">Total Paid</th>
      </tr>
    </thead>
    <tbody>${customerRows}</tbody>
  </table>

  <p style="font-size:12px;color:#9ca3af;margin-top:28px;text-align:center;">
    Alcohol Delivered · Automated Daily Cash-Flow Report · Generated ${new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })} CST
  </p>
</div>`.trim();

    const recipient = secrets.get('STORE_MANAGER_EMAIL');
    if (!recipient) {
      return Response.json({ error: 'STORE_MANAGER_EMAIL secret is not set' }, { status: 500 });
    }

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: recipient,
      subject: `Daily Stripe Summary | ${escapeHTML(summary.payout_date)} | Payouts: ${summary.payout_total}`,
      html: htmlBody,
      category: 'transactional',
    });

    return Response.json({
      success: true,
      payout_date: summary.payout_date,
      payout_count: summary.payout_count,
      payout_total: summary.payout_total,
      weekly_customer_count: summary.weekly_customer_count,
      weekly_total: summary.weekly_total,
    });
  } catch (error) {
    console.error('sendDailyPayoutSummary error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}