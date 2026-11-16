import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

const SPREADSHEET_ID = '1DJBJ9EJ1lNr-Itk2uWgigczKBna8opfKWcSUOv1neTM';
const HEADERS = ['Store ID', 'Retailer', 'City', 'Onboarding stage', 'Setup marked complete', 'Accepting orders (saved status)', 'Retail license status', 'License expiration', 'Compliance status', 'Stripe status (saved)', 'Signed agreement evidence', 'Catalog confirmed', 'Sandbox test passed', 'Tax evidence recorded', 'Store last updated', 'Last sheet sync (UTC)'];

async function listAll(entity) {
  const records = [];
  let cursor = null;
  do {
    const page = await entity.list({ sort: '-updated_date', limit: 100, cursor });
    records.push(...page.items);
    cursor = page.next_cursor;
  } while (cursor);
  return records;
}
const cells = values => ({ values: values.map(value => ({ userEnteredValue: typeof value === 'number' ? { numberValue: value } : { stringValue: String(value ?? '') } })) });

export default async function(req) {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });
    const [stores, onboarding, taxes, signups] = await Promise.all([
      listAll(base44.asServiceRole.entities.Store),
      listAll(base44.asServiceRole.entities.RetailerOnboarding),
      listAll(base44.asServiceRole.entities.TaxConfirmation),
      listAll(base44.asServiceRole.entities.RetailerSignup),
    ]);
    if (stores.length > 1999 || signups.length > 1999) throw new Error('The tracker needs more rows before syncing over 1,999 stores or signups.');
    const syncedAt = new Date().toISOString();
    const signupHeaders = ['Signup ID', 'Retailer', 'City', 'County', 'Application status', 'Submitted at', 'Application last updated', 'Last sheet sync (UTC)'];
    const signupRows = signups.sort((a, b) => (a.store_name || '').localeCompare(b.store_name || '')).map(signup => [signup.id, signup.store_name, signup.city, signup.county, signup.status || 'pending', signup.created_date, signup.updated_date, syncedAt]);
    const yesNo = value => value ? 'Yes' : 'No';
    const rows = stores.sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(store => {
      const evidence = onboarding.find(record => record.name === store.name && record.agreement_signed === true);
      const catalog = onboarding.find(record => record.name === store.name && record.catalog_verified === true);
      const tax = taxes.find(record => record.store_id === store.id && record.status === 'confirmed');
      const live = store.is_active === true && store.onboarding_status === 'live' && store.compliance_status === 'compliant' && store.stripe_connection_status === 'connected';
      return [store.id, store.name, store.city, (store.onboarding_status || 'pending').replaceAll('_', ' '), yesNo(store.onboarding_status === 'live'), yesNo(live), store.license_status || 'unknown', store.license_expiration_date || 'Not recorded', store.compliance_status || 'Not recorded', store.stripe_connection_status || 'disconnected', yesNo(evidence?.agreement_signed === true), yesNo(catalog?.catalog_verified === true), yesNo(evidence?.test_order_passed === true), yesNo(Boolean(tax?.source && tax?.confirmed_at && tax?.notes && Number.isFinite(store.sales_tax_rate))), store.updated_date, syncedAt];
    });
    const guide = [
      ['Store Onboarding Tracker', 'One row per store. Updated on store changes and every five minutes.'],
      ['Direction', 'App → Google Sheet only. Editing this sheet does not change store records.'],
      ['Setup marked complete', 'Yes means the saved onboarding stage is live; it is not a new verification of compliance or payments.'],
      ['Accepting orders (saved status)', 'Yes requires active + live stage + compliant + connected Stripe in saved app records.'],
      ['Evidence columns', 'Yes means the relevant saved evidence exists. No identifies missing evidence, even if a stage was manually marked complete.'],
      ['Payment verification', 'Saved Stripe status is not a live KYC, bank, charges or payouts check. Final launch checks remain required.'],
      ['Catalog confirmed', 'Based on the retailer onboarding catalog confirmation; it is not a live inventory count.'],
      ['Managed tabs', 'Store Onboarding and Retailer Signups are refreshed in full. Put personal notes in a separate tab.'],
      ['Retailer signup approvals', 'Application status syncs automatically when a signup becomes approved or leaves approved. Approval is not permission to accept orders.'],
      ['Privacy', 'The sheet stays in the connected Google account. No public sharing has been enabled.'],
      ['Last successful sync (UTC)', syncedAt],
    ];
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`, {
      method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: [
        { updateCells: { range: { sheetId: 2, startRowIndex: 0, endRowIndex: 2000, startColumnIndex: 0, endColumnIndex: 8 }, rows: [signupHeaders, ...signupRows].map(cells), fields: 'userEnteredValue' } },
        { repeatCell: { range: { sheetId: 2, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { backgroundColor: { red: 0.1, green: 0.15, blue: 0.3 }, textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } } } }, fields: 'userEnteredFormat' } },
        { repeatCell: { range: { sheetId: 2 }, cell: { userEnteredFormat: { wrapStrategy: 'WRAP' } }, fields: 'userEnteredFormat.wrapStrategy' } },
        { setBasicFilter: { filter: { range: { sheetId: 2, startRowIndex: 0, endRowIndex: signupRows.length + 1, startColumnIndex: 0, endColumnIndex: 8 } } } },
        { updateDimensionProperties: { range: { sheetId: 2, dimension: 'COLUMNS', startIndex: 0, endIndex: 8 }, properties: { pixelSize: 180 }, fields: 'pixelSize' } },
        { updateCells: { range: { sheetId: 0, startRowIndex: 0, endRowIndex: 2000, startColumnIndex: 0, endColumnIndex: 16 }, rows: [HEADERS, ...rows].map(cells), fields: 'userEnteredValue' } },
        { updateCells: { range: { sheetId: 1, startRowIndex: 0, endRowIndex: 20, startColumnIndex: 0, endColumnIndex: 2 }, rows: guide.map(cells), fields: 'userEnteredValue' } },
        { repeatCell: { range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { backgroundColor: { red: 0.1, green: 0.15, blue: 0.3 }, textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } } } }, fields: 'userEnteredFormat' } },
        { repeatCell: { range: { sheetId: 0 }, cell: { userEnteredFormat: { wrapStrategy: 'WRAP' } }, fields: 'userEnteredFormat.wrapStrategy' } },
        { setBasicFilter: { filter: { range: { sheetId: 0, startRowIndex: 0, endRowIndex: rows.length + 1, startColumnIndex: 0, endColumnIndex: 16 } } } },
        { updateDimensionProperties: { range: { sheetId: 0, dimension: 'COLUMNS', startIndex: 0, endIndex: 16 }, properties: { pixelSize: 180 }, fields: 'pixelSize' } },
        { updateDimensionProperties: { range: { sheetId: 1, dimension: 'COLUMNS', startIndex: 0, endIndex: 2 }, properties: { pixelSize: 400 }, fields: 'pixelSize' } },
        { repeatCell: { range: { sheetId: 1 }, cell: { userEnteredFormat: { wrapStrategy: 'WRAP' } }, fields: 'userEnteredFormat.wrapStrategy' } },
      ] }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error?.message || 'Google Sheets sync failed.');
    return Response.json({ success: true, stores_synced: rows.length, signups_synced: signupRows.length, approved_signups: signups.filter(signup => signup.status === 'approved').length, synced_at: syncedAt, spreadsheet_url: `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit` });
  } catch (error) {
    console.error('Store onboarding sheet sync failed:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}