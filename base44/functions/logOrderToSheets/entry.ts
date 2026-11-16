import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { assertAdmin } from '../../shared/authGuard.ts';

// Store the spreadsheet ID once created (persisted via a known sheet name lookup)
const SHEET_TITLE = 'SipSwift Orders';
const SHEET_TAB = 'Orders';
const HEADERS = [
  'Order Number', 'Date', 'Customer Name', 'Customer Email', 'Customer Phone',
  'Store Name', 'Items', 'Subtotal', 'Delivery Fee', 'Service Fee',
  'Tax', 'Tip', 'Total', 'Status', 'Payment Status', 'Delivery Address', 'Notes'
];

async function getOrCreateSpreadsheet(accessToken) {
  // Search for existing spreadsheet by name
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name='${SHEET_TITLE}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const searchData = await searchRes.json();

  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // Create new spreadsheet
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

  // Write headers
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

    // Admin only: platform workflow/automation calls resolve to an authorized identity,
    // and a direct caller must be a signed-in admin.
    const access = await assertAdmin(base44);
    if (!access.authorized) return access.response;

    const payload = await req.json();
    const order = payload.data;
    if (!order) {
      return Response.json({ error: 'No order data in payload' }, { status: 400 });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');

    const spreadsheetId = await getOrCreateSpreadsheet(accessToken);

    const itemsSummary = (order.items || [])
      .map(i => `${i.product_name} x${i.quantity} ($${i.price})`)
      .join('; ');

    const row = [
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

    const appendRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${SHEET_TAB}!A1:Q1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [row] })
      }
    );

    const appendData = await appendRes.json();
    console.log('Row appended:', JSON.stringify(appendData?.updates || appendData));

    return Response.json({ success: true, spreadsheetId });
  } catch (error) {
    console.error('logOrderToSheets error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});