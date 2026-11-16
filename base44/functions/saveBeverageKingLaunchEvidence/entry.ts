import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { findBeverageKingStores } from '../../shared/beverageKingStore.ts';

function text(body, key, max) {
  const value = typeof body[key] === 'string' ? body[key].trim() : '';
  if (!value || value.length > max) throw new Error(`${key.replaceAll('_', ' ')} is required (maximum ${max} characters).`);
  return value;
}
function pastDate(body, key) {
  const value = text(body, key, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value || Date.parse(value) > Date.now()) throw new Error('Enter a valid date that is not in the future.');
  return value;
}

export default async function(req) {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Only an admin can record launch evidence.' }, { status: 403 });
    const body = await req.json();
    if (!['tax', 'driver', 'test'].includes(body.action)) return Response.json({ error: 'Invalid action' }, { status: 400 });
    if (body.reviewed !== true) return Response.json({ error: 'Review the real evidence and confirm the attestation before saving.' }, { status: 400 });
    let evidence;
    try {
      const source = text(body, 'source', 300);
      if (body.action === 'tax') evidence = { source, notes: text(body, 'notes', 2000), confirmed_date: pastDate(body, 'confirmed_date') };
      if (body.action === 'test') evidence = { source, notes: text(body, 'notes', 2000) };
      if (body.action === 'driver') {
        const reportId = text(body, 'report_id', 120);
        if (reportId.length < 6 || /^(simulated|test|demo|ad-)/i.test(reportId)) throw new Error('Use the actual completed report ID, not a test ID or app reference code.');
        const dob = pastDate(body, 'date_of_birth');
        const cutoff = new Date(); cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 21);
        if (Date.parse(dob) > cutoff.getTime()) throw new Error('The driver must be at least 21.');
        evidence = { source, reportId, dob, completed_date: pastDate(body, 'completed_date'), license: text(body, 'license_number', 60), vehicle: text(body, 'vehicle_info', 200), driver_id: text(body, 'driver_id', 100) };
      }
    } catch (error) { return Response.json({ error: error.message }, { status: 400 }); }
    const stores = await findBeverageKingStores(base44);
    const store = stores.length === 1 ? stores[0] : null;
    if (!store) return Response.json({ error: 'Beverage King store not found.' }, { status: 404 });
    const now = new Date().toISOString();
    const audit = `Reviewed by ${user.email} on ${now}`;
    if (body.action === 'tax') {
      const data = { store_id: store.id, status: 'confirmed', source: evidence.source, confirmed_at: `${evidence.confirmed_date}T00:00:00.000Z`, notes: `${evidence.notes}\n${audit}` };
      const existing = await base44.asServiceRole.entities.TaxConfirmation.filter({ store_id: store.id }, '-updated_date', 1);
      if (existing[0]) await base44.asServiceRole.entities.TaxConfirmation.update(existing[0].id, data);
      else await base44.asServiceRole.entities.TaxConfirmation.create(data);
    }
    if (body.action === 'driver') {
      const driver = await base44.asServiceRole.entities.Driver.get(evidence.driver_id);
      if (!driver || driver.email?.toLowerCase() !== 'jpbsandiego@yahoo.com') return Response.json({ error: 'This form is for Justin’s verified driver record only.' }, { status: 400 });
      const note = `Real report ${evidence.reportId}; provider/reference: ${evidence.source}; ${audit}`;
      await base44.asServiceRole.entities.Driver.update(driver.id, {
        background_check_id: evidence.reportId, background_check_status: 'clear', background_check_completed_at: `${evidence.completed_date}T00:00:00.000Z`,
        date_of_birth: evidence.dob, license_number: evidence.license, vehicle_info: evidence.vehicle,
        description: `${(driver.description || '').slice(0, 450)}\n${note}`.trim().slice(0, 1000),
      });
    }
    if (body.action === 'test') {
      const records = await base44.asServiceRole.entities.RetailerOnboarding.filter({ name: store.name }, '-updated_date', 1);
      const data = { test_order_passed: true, notes: `Sandbox test reference: ${evidence.source}\n${evidence.notes}\n${audit}` };
      if (records[0]) await base44.asServiceRole.entities.RetailerOnboarding.update(records[0].id, { ...data, notes: `${records[0].notes || ''}\n${data.notes}` });
      else await base44.asServiceRole.entities.RetailerOnboarding.create({ name: store.name, status: 'test_pending', ...data });
    }
    return Response.json({ success: true, message: 'Reviewed evidence saved. Launch readiness will now be checked again.' });
  } catch (error) {
    console.error('Saving Beverage King launch evidence failed:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}