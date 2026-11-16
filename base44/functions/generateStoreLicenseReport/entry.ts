import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { assertAdmin } from '../../shared/authGuard.ts';

const EXPIRY_WARN_DAYS = 30;

function auditStore(store) {
  const errors = [];
  const warnings = [];

  if (!store.license_number || !store.license_number.trim()) errors.push('Missing license number');
  if (!store.email || !store.email.trim()) errors.push('No contact email on file');
  if (!store.address || !store.address.trim()) errors.push('Missing physical address');
  if (!store.county || !store.county.trim()) errors.push('County not assigned (zone compliance risk)');

  if (!store.phone || !store.phone.trim()) warnings.push('No phone number on file');
  if (!store.latitude || !store.longitude) warnings.push('GPS coordinates missing (affects routing)');
  if (!store.operating_hours_start || !store.operating_hours_end) warnings.push('Operating hours not set');

  if (store.placement_tier !== 'standard' && store.placement_expires) {
    try {
      const exp = new Date(store.placement_expires);
      const now = new Date();
      const daysLeft = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
      if (daysLeft < 0) {
        errors.push(`Paid placement expired ${Math.abs(daysLeft)} days ago`);
      } else if (daysLeft <= EXPIRY_WARN_DAYS) {
        warnings.push(`Paid placement expires in ${daysLeft} days`);
      }
    } catch {}
  }

  const status = errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'ok';
  return { errors, warnings, status };
}

async function sendGmailEmail({ accessToken, to, subject, htmlBody }) {
  const cleanTo = to.trim().replace(/[\r\n]+/g, '');
  const boundary = 'boundary_license_audit_' + Date.now();

  const message = [
    `To: ${cleanTo}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    htmlBody,
    '',
    `--${boundary}--`,
  ].join('\r\n');

  const encoded = btoa(unescape(encodeURIComponent(message)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  console.log(`Sending store license report to: ${cleanTo}`);

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encoded }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gmail send failed: ${err}`);
  }
  return res.json();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json().catch(() => ({}));
    const { authorized, response } = await assertAdmin(base44);
    if (!authorized) return response;

    const svc = base44.asServiceRole;

    const [stores, { accessToken }] = await Promise.all([
      svc.entities.Store.list('name', 500),
      svc.connectors.getConnection('gmail'),
    ]);

    const criticalStores = [];
    const warningStores = [];

    for (const store of stores) {
      const { errors, warnings, status } = auditStore(store);
      if (status === 'error') criticalStores.push({ store, errors, warnings });
      else if (status === 'warning') warningStores.push({ store, errors, warnings });
    }

    const now = new Date();
    const reportDate = now.toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    const formatStoreBlock = ({ store, errors, warnings }) => {
      const lines = [];
      lines.push(`  ${store.name}`);
      lines.push(`     License #: ${store.license_number || 'MISSING'}`);
      lines.push(`     Location:  ${[store.city, store.county ? `${store.county} Co.` : ''].filter(Boolean).join(', ') || 'Not set'}`);
      if (store.phone)  lines.push(`     Phone:     ${store.phone}`);
      if (store.email)  lines.push(`     Email:     ${store.email}`);
      if (errors.length)   lines.push(`     ACTION REQUIRED: ${errors.join(' | ')}`);
      if (warnings.length) lines.push(`     REVIEW:   ${warnings.join(' | ')}`);
      return lines.join('\n');
    };

    const criticalSection = criticalStores.length > 0
      ? criticalStores.map(formatStoreBlock).join('\n\n')
      : '  No stores with critical issues.';

    const warningSection = warningStores.length > 0
      ? warningStores.map(formatStoreBlock).join('\n\n')
      : '  No stores needing review.';

    const buildStoreRows = (list) => list.map(({ store, errors, warnings }) => `
      <tr style="border-bottom:1px solid #f0f0f0;">
        <td style="padding:12px 16px;font-weight:600;color:#1a2a6b;">${store.name}</td>
        <td style="padding:12px 16px;font-family:monospace;font-size:13px;">${store.license_number || '<span style="color:#dc2626;font-weight:700;">MISSING</span>'}</td>
        <td style="padding:12px 16px;color:#555;">${[store.city, store.county ? store.county + ' Co.' : ''].filter(Boolean).join(', ') || '—'}</td>
        <td style="padding:12px 16px;color:#555;">${store.phone || '—'}</td>
        <td style="padding:12px 16px;color:#555;font-size:13px;">${store.email || '—'}</td>
        <td style="padding:12px 16px;">
          ${errors.map(e => `<div style="color:#dc2626;font-size:12px;font-weight:600;">&#10060; ${e}</div>`).join('')}
          ${warnings.map(w => `<div style="color:#d97706;font-size:12px;">&#9888; ${w}</div>`).join('')}
        </td>
      </tr>`).join('');

    const tableHeader = `
      <tr style="background:#f8f9fa;">
        <th style="padding:10px 16px;text-align:left;font-size:12px;color:#888;font-weight:600;text-transform:uppercase;">Store</th>
        <th style="padding:10px 16px;text-align:left;font-size:12px;color:#888;font-weight:600;text-transform:uppercase;">License #</th>
        <th style="padding:10px 16px;text-align:left;font-size:12px;color:#888;font-weight:600;text-transform:uppercase;">Location</th>
        <th style="padding:10px 16px;text-align:left;font-size:12px;color:#888;font-weight:600;text-transform:uppercase;">Phone</th>
        <th style="padding:10px 16px;text-align:left;font-size:12px;color:#888;font-weight:600;text-transform:uppercase;">Email</th>
        <th style="padding:10px 16px;text-align:left;font-size:12px;color:#888;font-weight:600;text-transform:uppercase;">Issues</th>
      </tr>`;

    const htmlBody = `
<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
<tr><td align="center">
<table width="760" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
  <tr><td style="background:#1a2a6b;padding:28px 40px;">
    <h1 style="color:#fff;margin:0;font-size:22px;">&#128203; Store License Audit Report</h1>
    <p style="color:#f0b429;margin:6px 0 0;font-size:14px;">Alcohol Delivered, LLC &mdash; ${reportDate}</p>
  </td></tr>
  <tr><td style="padding:32px 40px;">

    <!-- Summary boxes -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
      <tr>
        <td width="25%" style="padding:0 8px 0 0;">
          <div style="background:#f0f4ff;border-radius:8px;padding:16px;text-align:center;">
            <div style="font-size:28px;font-weight:700;color:#1a2a6b;">${stores.length}</div>
            <div style="font-size:12px;color:#666;margin-top:4px;">Total Stores</div>
          </div>
        </td>
        <td width="25%" style="padding:0 4px;">
          <div style="background:#fef2f2;border-radius:8px;padding:16px;text-align:center;border:2px solid #fecaca;">
            <div style="font-size:28px;font-weight:700;color:#dc2626;">${criticalStores.length}</div>
            <div style="font-size:12px;color:#dc2626;margin-top:4px;">Action Required</div>
          </div>
        </td>
        <td width="25%" style="padding:0 4px;">
          <div style="background:#fffbeb;border-radius:8px;padding:16px;text-align:center;border:2px solid #fde68a;">
            <div style="font-size:28px;font-weight:700;color:#d97706;">${warningStores.length}</div>
            <div style="font-size:12px;color:#d97706;margin-top:4px;">Needs Review</div>
          </div>
        </td>
        <td width="25%" style="padding:0 0 0 8px;">
          <div style="background:#f0fdf4;border-radius:8px;padding:16px;text-align:center;border:2px solid #bbf7d0;">
            <div style="font-size:28px;font-weight:700;color:#16a34a;">${stores.length - criticalStores.length - warningStores.length}</div>
            <div style="font-size:12px;color:#16a34a;margin-top:4px;">Fully Compliant</div>
          </div>
        </td>
      </tr>
    </table>

    ${criticalStores.length > 0 ? `
    <!-- Critical -->
    <h2 style="color:#dc2626;font-size:16px;margin:0 0 12px;border-left:4px solid #dc2626;padding-left:12px;">&#10060; Action Required &mdash; Call These Stores First</h2>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #fecaca;border-radius:8px;overflow:hidden;margin-bottom:28px;">
      ${tableHeader}
      <tbody>${buildStoreRows(criticalStores)}</tbody>
    </table>` : `<div style="background:#f0fdf4;border-radius:8px;padding:16px;margin-bottom:28px;color:#16a34a;font-weight:600;">&#10003; No stores with critical issues this week.</div>`}

    ${warningStores.length > 0 ? `
    <!-- Warnings -->
    <h2 style="color:#d97706;font-size:16px;margin:0 0 12px;border-left:4px solid #d97706;padding-left:12px;">&#9888; Needs Review</h2>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #fde68a;border-radius:8px;overflow:hidden;margin-bottom:28px;">
      ${tableHeader}
      <tbody>${buildStoreRows(warningStores)}</tbody>
    </table>` : `<div style="background:#f0fdf4;border-radius:8px;padding:16px;margin-bottom:28px;color:#16a34a;font-weight:600;">&#10003; No stores needing review this week.</div>`}

  </td></tr>
  <tr><td style="background:#f8f9fa;padding:20px 40px;text-align:center;border-top:1px solid #eee;">
    <p style="margin:0;color:#aaa;font-size:12px;">Generated every Monday at 8:00 AM Central &bull; Alcohol Delivered, LLC &bull; Pine Bluff, AR &bull; 21+ Only</p>
    <p style="margin:4px 0 0;color:#aaa;font-size:11px;">Checks: license number, contact info, address, county assignment, GPS coordinates, operating hours, placement expiry</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

    // STORE_MANAGER_EMAIL may not be a valid email address; fall back to the compliance officer
    const rawRecipient = Deno.env.get('STORE_MANAGER_EMAIL') || '';
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawRecipient);
    const recipientEmail = isValidEmail ? rawRecipient : 'Drew.Cousins@dfa.gov';

    await sendGmailEmail({
      accessToken,
      to: recipientEmail,
      subject: `[License Audit] ${criticalStores.length} Action Required, ${warningStores.length} Under Review -- ${reportDate}`,
      htmlBody,
    });

    console.log(`Store license report sent to ${recipientEmail}. Total: ${stores.length}, Critical: ${criticalStores.length}, Warnings: ${warningStores.length}`);

    return Response.json({
      success: true,
      report_sent_to: recipientEmail,
      total_stores: stores.length,
      critical: criticalStores.length,
      warnings: warningStores.length,
      compliant: stores.length - criticalStores.length - warningStores.length,
    });
  } catch (error) {
    console.error('Store license report error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});