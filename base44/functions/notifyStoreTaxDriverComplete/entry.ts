import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { assertAdmin } from '../../shared/authGuard.ts';
import { driverIsProductionQualified, taxEvidenceIsComplete, readAllMatching } from '../../shared/verifiedTaxDriverReadiness.ts';
import { attachDriverCompliance } from '../../shared/driverAnnualCompliance.ts';

const channelId = 'C0BPWCBTU7N';
const checkVersion = 'verified_tax_driver_v1';

async function messageId(storeId) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${checkVersion}:${storeId}`));
  const hex = Array.from(new Uint8Array(digest)).slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20)}`;
}

export default async function(req) {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const base44 = createClientFromRequest(req);
    const { authorized, response } = await assertAdmin(base44);
    if (!authorized) return response;
    const body = await req.json();
    const dryRun = body.dry_run === true;
    if (!dryRun && (!['TaxConfirmation', 'Driver', 'FCMToken'].includes(body.source_entity)
      || typeof body.record_id !== 'string' || !body.record_id || body.record_id.length > 100)) {
      return Response.json({ error: 'A supported readiness record is required.' }, { status: 400 });
    }
    let taxQuery = { status: 'confirmed' };
    if (body.source_entity === 'TaxConfirmation') {
      const records = await base44.asServiceRole.entities.TaxConfirmation.filter({ id: body.record_id }, '-updated_date', 1);
      if (!records[0]?.store_id) return Response.json({ skipped: true, reason: 'Tax record not found.' });
      taxQuery = { ...taxQuery, store_id: records[0].store_id };
    }
    const [taxes, drivers] = await Promise.all([
      readAllMatching(base44.asServiceRole.entities.TaxConfirmation, taxQuery),
      readAllMatching(base44.asServiceRole.entities.Driver, { is_active: true, status: 'available', training_completed: true, background_check_status: 'clear' }),
    ]);
    const qualified = (await attachDriverCompliance(base44, drivers)).filter(driverIsProductionQualified).filter(d => d.email);
    const tokens = qualified.length ? await readAllMatching(base44.asServiceRole.entities.FCMToken, { user_email: { $in: qualified.map(d => d.email) } }) : [];
    const driversWithPush = qualified.filter(d => tokens.some(t => t.user_email === d.email));
    if (!driversWithPush.length) return Response.json({ dry_run: dryRun, sent: 0, skipped: true, reason: 'No available production-qualified driver with registered notifications.' });
    const latestTaxes = new Map();
    taxes.sort((a, b) => String(b.confirmed_at || '').localeCompare(String(a.confirmed_at || '')));
    for (const tax of taxes) if (!latestTaxes.has(tax.store_id)) latestTaxes.set(tax.store_id, tax);
    const results = [];
    let accessToken;
    for (const [storeId, tax] of latestTaxes) {
      if (!storeId || !taxEvidenceIsComplete(tax)) continue;
      const stores = await base44.asServiceRole.entities.Store.filter({ id: storeId }, '-updated_date', 1);
      const store = stores[0];
      if (!store) continue;
      const receipts = await base44.asServiceRole.entities.StoreReadinessNotification.filter({ store_id: storeId, check_version: checkVersion }, '-sent_at', 1);
      if (receipts.length) { results.push({ store_id: storeId, status: 'already_notified' }); continue; }
      if (dryRun) { results.push({ store_id: storeId, store_name: store.name, status: 'would_notify' }); continue; }
      if (!accessToken) ({ accessToken } = await base44.asServiceRole.connectors.getConnection('slack'));
      const slackResponse = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: channelId,
          client_msg_id: await messageId(storeId),
          text: `${store.name}: verified tax and driver readiness checks are complete.\nTax guidance and calculation evidence are recorded. An available driver has completed training, real background clearance, age/license/vehicle checks, and registered notifications.\nDriver coverage uses the platform's existing shared driver pool. Other launch requirements still apply; this alert does not activate ordering.`,
          mrkdwn: false, parse: 'none', unfurl_links: false, unfurl_media: false,
        }),
      });
      const message = await slackResponse.json();
      if (!slackResponse.ok || !message.ok) throw new Error(`Slack notification failed: ${message.error || slackResponse.status}`);
      await base44.asServiceRole.entities.StoreReadinessNotification.create({
        store_id: storeId, check_version: checkVersion, channel_id: channelId,
        slack_message_ts: message.ts, sent_at: new Date().toISOString(),
      });
      results.push({ store_id: storeId, status: 'sent' });
    }
    return Response.json({ dry_run: dryRun, channel: 'all-alcohol-delivered-llc', sent: results.filter(r => r.status === 'sent').length, results });
  } catch (error) {
    console.error('Store tax and driver readiness Slack alert failed:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}