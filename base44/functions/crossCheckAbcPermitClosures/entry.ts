/**
 * Monthly ABC Permit Closure Cross-Check
 *
 * Fetches the latest Arkansas ABC Permit Change List PDF, extracts every
 * permit marked "Inactive" (closures / revocations / surrenders), and
 * cross-checks them against all active stores on the platform. If any store
 * matches a closed permit (by license number, business name, or address),
 * an email alert is sent to the admin.
 *
 * Intended to be invoked by a scheduled workflow on the 15th of each month.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import pdfParse from 'npm:pdf-parse@1.1.1/lib/pdf-parse.js';

const PAGE_URL = 'https://www.dfa.arkansas.gov/office/alcohol-beverage-control/permit-changes/';
const UA = 'AlcoholDelivered/1.0 (ABC compliance sync)';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    // 1. Scrape the ABC page to find the latest report URL
    const pageRes = await fetch(PAGE_URL, { headers: { 'User-Agent': UA } });
    if (!pageRes.ok) {
      return Response.json({ error: `Failed to fetch ABC page (${pageRes.status})` }, { status: 502 });
    }
    const html = await pageRes.text();
    const re = /href="(https:\/\/www\.dfa\.arkansas\.gov\/wp-content\/uploads\/[^"]+\.pdf)"[^>]*>([^<]*Permit Changes[^<]*)</gi;
    let m;
    let reportUrl = null;
    let reportLabel = null;
    while ((m = re.exec(html)) !== null) {
      reportUrl = m[1];
      reportLabel = m[2].trim();
      break; // first match = most recent report
    }
    if (!reportUrl) {
      return Response.json({ error: 'No permit change reports found on ABC page' }, { status: 404 });
    }

    // 2. Fetch and parse the PDF
    const pdfRes = await fetch(reportUrl, { headers: { 'User-Agent': UA } });
    if (!pdfRes.ok) {
      return Response.json({ error: `Failed to fetch PDF (${pdfRes.status})` }, { status: 502 });
    }
    const pdfBuffer = await pdfRes.arrayBuffer();
    const pdfData = await pdfParse(new Uint8Array(pdfBuffer));
    const pdfText = pdfData.text || '';

    if (!pdfText.trim()) {
      return Response.json({ error: 'PDF has no extractable text (may be scanned images)' }, { status: 422 });
    }

    // 3. Use LLM to extract inactive permits from the PDF text
    const extraction = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt:
        'You are reading an Arkansas ABC alcoholic beverage permit change report. ' +
        'Extract EVERY permit entry whose Status Change is "Inactive" — these represent ' +
        'closures, revocations, or surrenders. For each, return:\n' +
        '- permit_number (the PERMIT# column, e.g. "00268-01")\n' +
        '- business_name (the business name from the NEW column)\n' +
        '- address (street address from the NEW column)\n' +
        '- city (city from the NEW column)\n' +
        '- status_change (the Status Change text, e.g. "Inactive")\n\n' +
        'Do NOT include entries with status "NEWA", "Replacement", "TOL", or "Change of Manager" — only "Inactive".\n' +
        'Here is the report text:\n\n' + pdfText.substring(0, 30000),
      response_json_schema: {
        type: 'object',
        properties: {
          inactive_permits: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                permit_number: { type: 'string' },
                business_name: { type: 'string' },
                address: { type: 'string' },
                city: { type: 'string' },
                status_change: { type: 'string' },
              },
            },
          },
        },
      },
    });

    const inactivePermits = extraction?.inactive_permits || [];

    // 4. Cross-check against all active stores
    const stores = await base44.asServiceRole.entities.Store.list('-name', 500);

    const matches = [];
    for (const ip of inactivePermits) {
      if (!ip.permit_number && !ip.business_name && !ip.address) continue;

      const byPermit = stores.find(
        (s) => s.license_number &&
          String(s.license_number).trim() === String(ip.permit_number).trim()
      );
      const byName = stores.find(
        (s) => s.name && ip.business_name &&
          (s.name.toLowerCase().includes(ip.business_name.toLowerCase()) ||
            ip.business_name.toLowerCase().includes(s.name.toLowerCase()))
      );
      const addressFrag = ip.address ? ip.address.split(' ').slice(0, 3).join(' ').toLowerCase() : '';
      const byAddress = stores.find(
        (s) => s.address && addressFrag &&
          s.address.toLowerCase().includes(addressFrag)
      );

      const matched = byPermit || byName || byAddress;
      if (matched) {
        matches.push({
          inactive_permit: ip,
          matched_store: {
            id: matched.id,
            name: matched.name,
            license_number: matched.license_number,
            address: matched.address,
            city: matched.city,
            county: matched.county,
            compliance_status: matched.compliance_status,
            is_active: matched.is_active,
          },
          match_type: byPermit ? 'license_number' : byName ? 'name' : 'address',
        });
      }
    }

    // 5. Send alert email if matches found — but never to a government/ABC
    // address (shared suppression guard).
    const { isBlockedRecipient } = await import('../../shared/emailGuard.ts');
    const adminEmail = Deno.env.get('STORE_MANAGER_EMAIL');
    const recipientBlocked = adminEmail ? isBlockedRecipient(adminEmail) : false;
    let alertSent = false;
    if (recipientBlocked) {
      console.log('ABC permit closure alert suppressed — recipient is a blocked government/ABC address');
    }
    if (matches.length > 0 && adminEmail && !recipientBlocked) {
      const matchLines = matches
        .map(
          (mm) =>
            `• ${mm.matched_store.name} (License: ${mm.matched_store.license_number || 'N/A'}, ` +
            `${mm.matched_store.city || 'N/A'}) — matched ABC permit ${mm.inactive_permit.permit_number} ` +
            `(${mm.inactive_permit.business_name}) via ${mm.match_type}. ` +
            `Status: ${mm.inactive_permit.status_change}`
        )
        .join('\n');

      await base44.asServiceRole.integrations.Core.SendEmail({
        to: adminEmail,
        subject: `⚠️ ABC Permit Closure Alert: ${matches.length} store(s) need review`,
        body:
          `The monthly ABC permit cross-check found ${matches.length} store(s) on your platform ` +
          `that match permits marked "Inactive" in the latest Arkansas ABC Permit Change List.\n\n` +
          `Report: ${reportLabel || reportUrl}\nReport URL: ${reportUrl}\n` +
          `Inactive permits checked: ${inactivePermits.length}\n` +
          `Active stores checked: ${stores.length}\n\n` +
          `Matches requiring review:\n${matchLines}\n\n` +
          `Action required: Verify each store's current license status with the Arkansas ABC ` +
          `and update compliance_status accordingly. If a store's permit has truly been closed ` +
          `or revoked, suspend the store (is_active = false, compliance_status = "suspended").`,
      });
      alertSent = true;
    }

    return Response.json({
      report_label: reportLabel,
      report_url: reportUrl,
      inactive_permits_found: inactivePermits.length,
      stores_checked: stores.length,
      matches_found: matches.length,
      matches,
      alert_sent: alertSent,
    });
  } catch (error) {
    console.error('crossCheckAbcPermitClosures error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});