import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { assertAdmin } from '../../shared/authGuard.ts';

const SPREADSHEET_TITLE = 'SipSwift Orders';
const TAB = 'Weekly Summary';
const HEADERS = [
  'Week Start', 'Week End', 'Store Name', 'Orders', 'Revenue',
  'Avg Order Value', 'Delivery Fees', 'Service Fees', 'Tax', 'Tips', 'Row Type'
];

async function findSpreadsheet(accessToken) {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name='${SPREADSHEET_TITLE}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await res.json();
  return data.files && data.files.length > 0 ? data.files[0].id : null;
}

async function createSpreadsheetWithTab(accessToken) {
  const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      properties: { title: SPREADSHEET_TITLE },
      sheets: [{ properties: { title: TAB } }]
    })
  });
  const created = await res.json();
  const id = created.spreadsheetId;
  await writeHeaders(accessToken, id);
  return id;
}

async function writeHeaders(accessToken, spreadsheetId) {
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${TAB}!A1:K1?valueInputOption=RAW`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [HEADERS] })
    }
  );
}

async function ensureTab(accessToken, spreadsheetId) {
  const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets(properties(title))`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const meta = await metaRes.json();
  const hasTab = (meta.sheets || []).some(s => s.properties && s.properties.title === TAB);
  if (!hasTab) {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: TAB } } }] })
    });
    await writeHeaders(accessToken, spreadsheetId);
    return;
  }
  // Tab exists — ensure header row is present
  const headerRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${TAB}!A1:K1`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const headerData = await headerRes.json();
  if (!headerData.values || headerData.values.length === 0) {
    await writeHeaders(accessToken, spreadsheetId);
  }
}

async function appendRows(accessToken, spreadsheetId, rows) {
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${TAB}!A1:K1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: rows })
    }
  );
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const { authorized, response } = await assertAdmin(base44);
    if (!authorized) return response;

    // Past 7 days of delivered orders
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const allOrders = await base44.asServiceRole.entities.Order.filter({ status: 'delivered' });
    const orders = allOrders.filter(o => new Date(o.created_date) >= since);

    const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const weekStart = fmt(since);
    const weekEnd = fmt(new Date());

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');
    let spreadsheetId = await findSpreadsheet(accessToken);
    if (!spreadsheetId) {
      spreadsheetId = await createSpreadsheetWithTab(accessToken);
    } else {
      await ensureTab(accessToken, spreadsheetId);
    }

    // No orders this week — still log a zero row so the week is tracked
    if (orders.length === 0) {
      await appendRows(accessToken, spreadsheetId, [[weekStart, weekEnd, '—', 0, 0, 0, 0, 0, 0, 0, 'No Orders']]);
      return Response.json({ success: true, message: 'No delivered orders this week; zero row appended.', week: `${weekStart} – ${weekEnd}`, spreadsheet_id: spreadsheetId });
    }

    // Aggregate per store
    const storeMap = {};
    for (const order of orders) {
      const key = order.store_id || 'unknown';
      if (!storeMap[key]) {
        storeMap[key] = {
          storeName: order.store_name || key,
          orders: 0, revenue: 0, deliveryFees: 0, serviceFees: 0, tax: 0, tips: 0
        };
      }
      const s = storeMap[key];
      s.orders += 1;
      s.revenue += order.total || 0;
      s.deliveryFees += order.delivery_fee || 0;
      s.serviceFees += order.service_fee || 0;
      s.tax += order.tax || 0;
      s.tips += order.tip || 0;
    }

    const rows = [];
    let gOrders = 0, gRevenue = 0, gDelivery = 0, gService = 0, gTax = 0, gTips = 0;
    for (const s of Object.values(storeMap)) {
      const avg = s.orders ? s.revenue / s.orders : 0;
      rows.push([
        weekStart, weekEnd, s.storeName, s.orders, s.revenue.toFixed(2), avg.toFixed(2),
        s.deliveryFees.toFixed(2), s.serviceFees.toFixed(2), s.tax.toFixed(2), s.tips.toFixed(2), 'Store'
      ]);
      gOrders += s.orders; gRevenue += s.revenue; gDelivery += s.deliveryFees;
      gService += s.serviceFees; gTax += s.tax; gTips += s.tips;
    }
    const gAvg = gOrders ? gRevenue / gOrders : 0;
    rows.push([
      weekStart, weekEnd, 'ALL STORES', gOrders, gRevenue.toFixed(2), gAvg.toFixed(2),
      gDelivery.toFixed(2), gService.toFixed(2), gTax.toFixed(2), gTips.toFixed(2), 'Total'
    ]);

    await appendRows(accessToken, spreadsheetId, rows);

    return Response.json({
      success: true,
      week: `${weekStart} – ${weekEnd}`,
      spreadsheet_id: spreadsheetId,
      rows_appended: rows.length,
      total_orders: gOrders,
      total_revenue: gRevenue.toFixed(2)
    });
  } catch (error) {
    console.error('exportWeeklyReportToSheets error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}