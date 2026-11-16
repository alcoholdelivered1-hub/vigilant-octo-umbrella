import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { allLicenseRecords, evaluateLicenseAlerts, licenseAlertRecipient } from '../../shared/licenseAlertRules.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });
    const body = await req.json();
    const [stores, permits, existing] = await Promise.all([
      allLicenseRecords(base44.entities.Store), allLicenseRecords(base44.entities.BusinessPermit), allLicenseRecords(base44.entities.LicenseAlert),
    ]);
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const value = type => parts.find(p => p.type === type).value;
    const today = `${value('year')}-${value('month')}-${value('day')}`;
    const desired = evaluateLicenseAlerts(stores, permits, today);
    if (body.dry_run === true) return Response.json({ dry_run: true, active_alerts: desired.length, recipient: licenseAlertRecipient, alerts: desired.map(a => a.message) });
    const keys = new Set(desired.map(a => a.alert_key));
    const resolved = existing.filter(a => a.active && !keys.has(a.alert_key)).map(a => ({ id: a.id, active: false }));
    if (resolved.length) await base44.entities.LicenseAlert.bulkUpdate(resolved);
    const pending = [];
    for (const alert of desired) {
      let record = existing.find(a => a.alert_key === alert.alert_key);
      if (!record) record = await base44.entities.LicenseAlert.create(alert);
      else if (!record.active) record = await base44.entities.LicenseAlert.update(record.id, { ...alert, email_sent_at: null });
      else if (record.message !== alert.message) record = await base44.entities.LicenseAlert.update(record.id, { message: alert.message });
      if (!record.email_sent_at) pending.push(record);
    }
    if (pending.length) {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: licenseAlertRecipient,
        subject: `Store license alerts: ${pending.length} issue${pending.length === 1 ? '' : 's'} need attention`,
        text: `Store license compliance alerts\n\n${pending.map(a => a.message).join('\n')}\n\nReview the License Alerts panel on your Admin Dashboard and update the store's license details. Expiration warnings start 30 days before the recorded date, with another reminder at 7 days and after expiration. Pending entries indicate verification is incomplete, not a verified regulatory finding.`,
        from_name: 'Alcohol Delivered Compliance',
      });
      await base44.entities.LicenseAlert.bulkUpdate(pending.map(a => ({ id: a.id, email_sent_at: new Date().toISOString() })));
    }
    return Response.json({ active_alerts: desired.length, emailed: pending.length, resolved: resolved.length });
  } catch (error) {
    console.error('Store license alert check failed:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}