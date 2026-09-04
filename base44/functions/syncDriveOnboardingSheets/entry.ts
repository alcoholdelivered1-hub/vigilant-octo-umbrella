import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import * as XLSX from 'npm:xlsx@0.18.5';

// --- CSV / XLSX parsing (mirrors uploadStoreOnboarding) ---
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
const SHEET_MIME_TYPES = new Set([
  'text/csv',
  'application/vnd.google-apps.spreadsheet',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
]);

function isOnboardingFile(name, mimeType) {
  if (!SHEET_MIME_TYPES.has(mimeType)) return false;
  return (name || '').toLowerCase().includes('onboarding');
}

async function downloadAndParse(fileId, mimeType, accessToken) {
  const authHeader = { Authorization: `Bearer ${accessToken}` };
  if (mimeType === 'application/vnd.google-apps.spreadsheet') {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/csv`,
      { headers: authHeader }
    );
    if (!res.ok) throw new Error(`Export failed: ${await res.text()}`);
    return parseCSV(await res.text());
  }
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, { headers: authHeader });
  if (!res.ok) throw new Error(`Download failed: ${await res.text()}`);
  if (mimeType === 'text/csv') {
    return parseCSV(await res.text());
  }
  return parseXLSX(await res.arrayBuffer());
}

async function upsertStores(base44, rows) {
  const existing = await base44.asServiceRole.entities.Store.list('name', 500);
  const byLicense = {};
  const byName = {};
  for (const s of existing) {
    if (s.license_number) byLicense[s.license_number] = s;
    if (s.name) byName[s.name.toLowerCase()] = s;
  }

  let created = 0, updated = 0, skipped = 0;
  const errors = [];

  for (const row of rows) {
    try {
      const name = row.store_name || row.name;
      if (!name) { skipped++; continue; }
      const license = row.license_number || '';
      const ex = (license && byLicense[license]) || byName[name.toLowerCase()];
      const onboardingStatus = ONBOARDING_STATUSES.includes(row.onboarding_status) ? row.onboarding_status : 'invited';
      const complianceStatus = COMPLIANCE_STATUSES.includes(row.compliance_status) ? row.compliance_status : 'compliant';

      const data = {
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

      if (ex) {
        await base44.asServiceRole.entities.Store.update(ex.id, data);
        updated++;
      } else {
        const c = await base44.asServiceRole.entities.Store.create(data);
        if (license) byLicense[license] = c;
        byName[name.toLowerCase()] = c;
        created++;
      }
    } catch (e) {
      errors.push(`Store "${row.store_name || row.name}": ${e.message}`);
      skipped++;
    }
  }
  return { created, updated, skipped, errors };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // Auth: must be authenticated via platform (admin user or automation)
    const authenticated = await base44.auth.isAuthenticated().catch(() => false);
    if (!authenticated) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const currentUser = await base44.auth.me().catch(() => null);
    if (currentUser && currentUser.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    // Automation/webhook if no user session; manual trigger if admin user
    const isAutomation = !currentUser;

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googledrive');
    const authHeader = { Authorization: `Bearer ${accessToken}` };

    const syncRecords = await base44.asServiceRole.entities.SyncState.list();
    let sync = syncRecords.length > 0 ? syncRecords[0] : null;

    // --- Webhook (incremental Changes API) ---
    if (isAutomation) {
      const meta = body.data?._provider_meta || {};
      const state = meta['x-goog-resource-state'];
      if (state === 'sync') return Response.json({ status: 'sync_ack' });

      if (!sync) {
        const tokenRes = await fetch('https://www.googleapis.com/drive/v3/changes/startPageToken', { headers: authHeader });
        const { startPageToken } = await tokenRes.json();
        await base44.asServiceRole.entities.SyncState.create({ page_token: startPageToken });
        return Response.json({ status: 'initialized' });
      }

      const baseUrl = `https://www.googleapis.com/drive/v3/changes?fields=changes(file(id,name,mimeType,trashed)),newStartPageToken,nextPageToken`;
      let changesUrl = baseUrl + `&pageToken=${sync.page_token}`;
      const allChanges = [];
      let newPageToken = null;

      while (changesUrl) {
        const res = await fetch(changesUrl, { headers: authHeader });
        if (!res.ok) { console.error('Changes API error:', await res.text()); break; }
        const page = await res.json();
        allChanges.push(...(page.changes || []));
        if (page.newStartPageToken) newPageToken = page.newStartPageToken;
        changesUrl = page.nextPageToken ? baseUrl + `&pageToken=${page.nextPageToken}` : null;
      }

      const onboardingChanges = allChanges.filter(c =>
        c.file && !c.file.trashed && isOnboardingFile(c.file.name, c.file.mimeType)
      );

      let totalCreated = 0, totalUpdated = 0, totalSkipped = 0;
      const allErrors = [];
      const filesProcessed = [];

      for (const ch of onboardingChanges) {
        try {
          const rows = await downloadAndParse(ch.file.id, ch.file.mimeType, accessToken);
          const result = await upsertStores(base44, rows);
          totalCreated += result.created;
          totalUpdated += result.updated;
          totalSkipped += result.skipped;
          allErrors.push(...result.errors);
          filesProcessed.push({ name: ch.file.name, rows: rows.length, ...result });
        } catch (e) {
          allErrors.push(`${ch.file.name}: ${e.message}`);
        }
      }

      if (newPageToken) {
        await base44.asServiceRole.entities.SyncState.update(sync.id, { page_token: newPageToken });
      }

      console.log(`Drive webhook sync: ${onboardingChanges.length} onboarding files → ${totalCreated} created, ${totalUpdated} updated`);
      return Response.json({
        status: 'synced',
        files_processed: filesProcessed,
        created: totalCreated, updated: totalUpdated, skipped: totalSkipped,
        errors: allErrors.slice(0, 20),
      });
    }

    // --- Manual admin trigger: full scan of all onboarding files ---
    let pageToken = null;
    const matchedFiles = [];
    do {
      const q = encodeURIComponent("trashed=false and (mimeType='text/csv' or mimeType='application/vnd.google-apps.spreadsheet' or mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or mimeType='application/vnd.ms-excel')");
      let url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType),nextPageToken&pageSize=200`;
      if (pageToken) url += `&pageToken=${pageToken}`;
      const res = await fetch(url, { headers: authHeader });
      const data = await res.json();
      for (const f of (data.files || [])) {
        if (isOnboardingFile(f.name, f.mimeType)) matchedFiles.push(f);
      }
      pageToken = data.nextPageToken;
    } while (pageToken);

    let totalCreated = 0, totalUpdated = 0, totalSkipped = 0;
    const allErrors = [];
    const filesProcessed = [];

    for (const f of matchedFiles) {
      try {
        const rows = await downloadAndParse(f.id, f.mimeType, accessToken);
        const result = await upsertStores(base44, rows);
        totalCreated += result.created;
        totalUpdated += result.updated;
        totalSkipped += result.skipped;
        allErrors.push(...result.errors);
        filesProcessed.push({ name: f.name, rows: rows.length, ...result });
      } catch (e) {
        allErrors.push(`${f.name}: ${e.message}`);
      }
    }

    // Initialize sync cursor so webhooks start from now
    if (!sync) {
      const tokenRes = await fetch('https://www.googleapis.com/drive/v3/changes/startPageToken', { headers: authHeader });
      const { startPageToken } = await tokenRes.json();
      await base44.asServiceRole.entities.SyncState.create({ page_token: startPageToken });
    }

    console.log(`Manual Drive sync: ${matchedFiles.length} onboarding files → ${totalCreated} created, ${totalUpdated} updated`);
    return Response.json({
      success: true,
      files_found: matchedFiles.length,
      files_processed: filesProcessed,
      created: totalCreated, updated: totalUpdated, skipped: totalSkipped,
      errors: allErrors.slice(0, 20),
    });
  } catch (error) {
    console.error('Drive onboarding sync error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});