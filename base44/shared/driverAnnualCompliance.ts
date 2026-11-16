import { allSetupRecords } from './retailerSetupAccess.ts';

export function annualComplianceIsCurrent(driver) {
  const record = driver?.abc_compliance;
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const today = ['year', 'month', 'day'].map(type => parts.find(part => part.type === type).value).join('-');
  if (!record || record.status !== 'approved' || record.driver_id !== driver.id || record.driver_email !== driver.email) return false;
  const completed = new Date(`${record.training_completed_date}T00:00:00Z`);
  if (!Number.isFinite(completed.getTime())) return false;
  completed.setUTCFullYear(completed.getUTCFullYear() + 1);
  const anniversary = completed.toISOString().slice(0, 10);
  return Boolean(record.reviewed_by && record.reviewed_at && record.training_provider?.trim() && record.abc_approval_reference?.trim() && record.certificate_reference?.trim() && record.awareness_form_reference?.trim())
    && record.training_completed_date <= today && record.training_expires_date > today && record.training_expires_date <= anniversary
    && record.license_expiration_date >= today && record.reviewed_license_number === driver.license_number
    && record.reviewed_date_of_birth === driver.date_of_birth && record.reviewed_background_check_id === driver.background_check_id;
}

export async function attachDriverCompliance(base44, drivers) {
  const latest = new Map();
  const ids = [...new Set(drivers.filter(Boolean).map(driver => driver.id))];
  for (let offset = 0; offset < ids.length; offset += 100) {
    // All callers authorize access first; read only selected drivers' evidence.
    const records = await allSetupRecords(base44.asServiceRole.entities.DriverCompliance, { driver_id: { $in: ids.slice(offset, offset + 100) } }, '-reviewed_at');
    for (const record of records) if (!latest.has(record.driver_id)) latest.set(record.driver_id, record);
  }
  return drivers.filter(Boolean).map(driver => ({ ...driver, abc_compliance: latest.get(driver.id) || null }));
}