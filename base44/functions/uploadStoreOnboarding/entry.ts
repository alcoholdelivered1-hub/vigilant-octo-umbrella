import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import * as XLSX from 'npm:xlsx@0.18.5';

function parseCSV(text) {
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
  return lines.slice(1).map(line => {
    const values = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes; }
      else if (char === ',' && !inQuotes) { values.push(current.trim()); current = ''; }
      else { current += char; }
    }
    values.push(current.trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (values[i] || '').replace(/^"|"$/g, ''); });
    return obj;
  }).filter(row => row.store_name || row.name || row.license_number);
}

function parseXLSX(arrayBuffer) {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
  return rows.map(row => {
    const normalized = {};
    for (const [key, value] of Object.entries(row)) {
      const normalizedKey = key.trim().toLowerCase().replace(/\s+/g, '_');
      normalized[normalizedKey] = String(value ?? '').trim();
    }
    return normalized;
  }).filter(row => row.store_name || row.name || row.license_number);
}

const ONBOARDING_STATUSES = ['invited', 'contract_sent', 'contract_signed', 'inventory_added', 'live'];
const COMPLIANCE_STATUSES = ['compliant', 'flagged', 'expired', 'suspended'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file');
    if (!file) {
      return Response.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const filename = file.name.toLowerCase();
    const arrayBuffer = await file.arrayBuffer();
    let rows = [];

    if (filename.endsWith('.csv')) {
      const csvText = new TextDecoder('utf-8').decode(arrayBuffer);
      rows = parseCSV(csvText);
    } else if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
      rows = parseXLSX(arrayBuffer);
    } else {
      return Response.json({ error: 'Only .csv and .xlsx files are supported' }, { status: 400 });
    }

    console.log(`Parsed ${rows.length} store rows`);

    // Load existing stores for matching
    const existingStores = await base44.asServiceRole.entities.Store.list('name', 500);
    const storeByLicense = {};
    const storeByName = {};
    for (const s of existingStores) {
      if (s.license_number) storeByLicense[s.license_number] = s;
      if (s.name) storeByName[s.name.toLowerCase()] = s;
    }

    let created = 0, updated = 0, skipped = 0;
    const errors = [];
    const storesWithEmail = [];
    const storesWithoutEmail = [];

    for (const row of rows) {
      try {
        const name = row.store_name || row.name;
        if (!name) { errors.push('Row missing store name — skipped'); skipped++; continue; }

        const license = row.license_number || '';
        const existing = (license && storeByLicense[license]) || storeByName[name.toLowerCase()];

        const onboardingStatus = ONBOARDING_STATUSES.includes(row.onboarding_status) ? row.onboarding_status : 'invited';
        const complianceStatus = COMPLIANCE_STATUSES.includes(row.compliance_status) ? row.compliance_status : 'compliant';

        const storeData = {
          name,
          ...(license && { license_number: license }),
          ...(row.address && { address: row.address }),
          ...(row.city && { city: row.city }),
          county: row.county || 'Jefferson',
          state: row.state || 'AR',
          ...(row.zip_code && { zip_code: row.zip_code }),
          ...(row.phone && { phone: row.phone }),
          ...(row.email && { email: row.email }),
          is_active: true,
          onboarding_status: onboardingStatus,
          ...(row.onboarding_notes && { onboarding_notes: row.onboarding_notes }),
          compliance_status: complianceStatus,
        };

        if (existing) {
          await base44.asServiceRole.entities.Store.update(existing.id, storeData);
          updated++;
        } else {
          const createdStore = await base44.asServiceRole.entities.Store.create(storeData);
          if (license) storeByLicense[license] = createdStore;
          storeByName[name.toLowerCase()] = createdStore;
          created++;
        }

        if (row.email) {
          storesWithEmail.push({ name, email: row.email, status: onboardingStatus });
        } else {
          storesWithoutEmail.push({ name, status: onboardingStatus });
        }
      } catch (e) {
        errors.push(`Store "${row.store_name || row.name}": ${e.message}`);
        skipped++;
      }
    }

    const summary = {
      stores: { created, updated, skipped },
      total_rows: rows.length,
      contact_emails: {
        with_email: storesWithEmail.length,
        without_email: storesWithoutEmail.length,
      },
      errors: errors.slice(0, 20),
    };
    console.log('Store onboarding upload complete:', JSON.stringify(summary));
    return Response.json({ success: true, summary, storesWithEmail, storesWithoutEmail });

  } catch (error) {
    console.error('Store onboarding upload error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});