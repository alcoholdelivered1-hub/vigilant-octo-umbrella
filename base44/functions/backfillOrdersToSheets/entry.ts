import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { assertAdmin } from '../../shared/authGuard.ts';

const SHEET_TITLE = 'SipSwift Orders';
const SHEET_TAB = 'Orders';
const HEADERS = [
  'Order Number', 'Date', 'Customer Name', 'Customer Email', 'Customer Phone',
  'Store Name', 'Items', 'Subtotal', 'Delivery Fee', 'Service Fee',
  'Tax', 'Tip', 'Total', 'Status', 'Payment Status', 'Delivery Address', 'Notes'
];

function orderToRow(order) {
  const itemsSummary = (order.items || [])
    .map(i => `${i.product_name} x${i.quantity} ($${i.price})`)
    .join('; ');
  return [
    order.order_number || '',
    order.created_date ? new Date(order.created_date).toLocaleString() : new Date().toLocaleString(),
    order.customer_name || '',
    order.customer_email || '',
    order.customer_phone || '',
    order.store_name || '',
    itemsSummary,
    order.subtotal?.toFixed(2) || '0.00',
    order.delivery_fee?.toFixed(2) || '0.00',
    order.service_fee?.toFixed(2) || '0.00',
    order.tax?.toFixed(2) || '0.00',
    order.tip?.toFixed(2) || '0.00',
    order.total?.toFixed(2) || '0.00',
    order.status || '',
    order.stripe_payment_status || '',
    order.delivery_address || '',
    order.notes || '',
  ];
}

async function getOrCreateSpreadsheet(accessToken) {
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name='${SHEET_TITLE}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      properties: { title: SHEET_TITLE },
      sheets: [{ properties: { title: SHEET_TAB } }]
    })
  });
  const created = await createRes.json();
  const spreadsheetId = created.spreadsheetId;

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${SHEET_TAB}!A1:Q1?valueInputOption=RAW`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [HEADERS] })
    }
  );

  return spreadsheetId;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const access = await assertAdmin(base44);
    if (!access.authorized) return access.response;

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');
    const spreadsheetId = await getOrCreateSpreadsheet(accessToken);

    // Fetch all orders, paginated
    const allOrders = [];
    let cursor = undefined;
    let hasMore = true;
    while (hasMore) {
      const opts = { sort: 'created_date', limit: 500 };
      if (cursor) opts.cursor = cursor;
      const result = await base44.asServiceRole.entities.Order.filter({}, opts);
      const items = Array.isArray(result) ? result : (result.items || []);
      allOrders.push(...items);
      hasMore = Array.isArray(result) ? false : result.has_more;
      cursor = Array.isArray(result) ? undefined : result.next_cursor;
    }

    if (allOrders.length === 0) {
      return Response.json({ success: true, message: 'No orders to backfill.', synced: 0 });
    }

    // Append all rows in batches of 500 (Google Sheets API limit per request)
    const rows = allOrders.map(orderToRow);
    const BATCH = 500;
    let appended = 0;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const appendRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${SHEET_TAB}!A1:Q1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: batch })
        }
      );
      if (!appendRes.ok) {
        const err = await appendRes.json();
        throw new Error(`Sheets append failed: ${err.error?.message || appendRes.status}`);
      }
      appended += batch.length;
    }

    console.log(`Backfilled ${appended} orders to sheet ${spreadsheetId}`);
    return Response.json({ success: true, spreadsheetId, synced: appended });
  } catch (error) {
    console.error('backfillOrdersToSheets error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});