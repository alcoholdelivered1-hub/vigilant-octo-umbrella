import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { annualComplianceIsCurrent } from '../../shared/driverAnnualCompliance.ts';

export default async function(req) {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Administrator review is required.' }, { status: 403 });
    const body = await req.json();
    if (typeof body.driver_id !== 'string' || !body.driver_id || body.driver_id.length > 100 || !['approve', 'revoke'].includes(body.action)) return Response.json({ error: 'A driver and valid review action are required.' }, { status: 400 });
    const driver = await base44.entities.Driver.get(body.driver_id);
    if (!driver?.email) return Response.json({ error: 'Driver not found.' }, { status: 404 });
    const record = { driver_id: driver.id, driver_email: driver.email, status: body.action === 'approve' ? 'approved' : 'revoked', reviewed_by: user.email, reviewed_at: new Date().toISOString() };
    if (body.action === 'approve') {
      if (body.confirmed !== true) return Response.json({ error: 'Confirm that actual supporting evidence has been reviewed.' }, { status: 400 });
      const textFields = ['training_provider', 'abc_approval_reference', 'certificate_reference', 'awareness_form_reference'];
      const dates = ['training_completed_date', 'training_expires_date', 'license_expiration_date'];
      for (const key of [...textFields, ...dates]) {
        if (typeof body[key] !== 'string' || !body[key].trim() || body[key].length > 250) return Response.json({ error: 'Complete all annual certification and license evidence fields.' }, { status: 400 });
        record[key] = body[key].trim();
      }
      for (const key of dates) {
        const date = new Date(`${record[key]}T00:00:00Z`);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(record[key]) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== record[key]) return Response.json({ error: 'Use valid calendar dates for certification and license evidence.' }, { status: 400 });
      }
      const cutoff = new Date(); cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 21);
      const dob = new Date(`${driver.date_of_birth}T00:00:00Z`);
      if (!Number.isFinite(dob.getTime()) || dob > cutoff || !driver.license_number?.trim() || driver.background_check_status !== 'clear' || !driver.background_check_completed_at || !driver.background_check_id?.trim() || /^(simulated|test|demo|ad-)/i.test(driver.background_check_id.trim())) return Response.json({ error: 'Verified age 21+, a license number, and a real cleared background report are required before approval.' }, { status: 409 });
      Object.assign(record, { reviewed_license_number: driver.license_number, reviewed_date_of_birth: driver.date_of_birth, reviewed_background_check_id: driver.background_check_id });
      if (!annualComplianceIsCurrent({ ...driver, abc_compliance: record })) return Response.json({ error: 'Training must be current, expire no later than one year after completion, and have a current driver license.' }, { status: 400 });
    }
    await base44.entities.DriverCompliance.create(record);
    if (body.action === 'approve') await base44.entities.Driver.update(driver.id, { training_completed: true, training_completed_date: record.training_completed_date });
    return Response.json({ success: true, status: record.status });
  } catch (error) {
    console.error('Driver certification review:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}