import { setupError, requireUnambiguousRetailer } from './retailerSetupAccess.ts';
import { validateSetupFields, setupStoreMapping } from './retailerSetupFields.ts';
import { mapRetailerSetupReview } from './mapRetailerSetupReview.ts';
export async function reviewSetupSubmission(base44, user, store, body) {
  if (user.role !== 'admin') throw setupError('Administrator review is required.', 403);
  const { id, decision, note } = body;
  if (!['approved','needs_correction'].includes(decision) || typeof note !== 'string' || note.trim().length < 10 || note.length > 1500) throw setupError('Choose a decision and explain the verification source or correction needed (10–1500 characters).');
  const record = await base44.asServiceRole.entities.RetailerSetupSubmission.get(id);
  if (!record || record.store_id !== store.id || record.step === 'launch') throw setupError('Submission not found.', 404);
  if (record.status === decision && (decision !== 'approved' || record.mapped_at)) return record;
  if (!['submitted','approved'].includes(record.status)) throw setupError('Review a submitted version; drafts cannot be approved.', 409);
  if (record.status === 'approved' && record.mapped_at) throw setupError('This decision is final. Request a new submission for further changes.', 409);
  const now = new Date().toISOString();
  if (decision === 'approved') {
    await requireUnambiguousRetailer(base44, store);
    const fields = validateSetupFields(record.step, record.fields, true);
    if (['license','inventory'].includes(record.step)) {
      const kind = record.step === 'license' ? 'retail_license' : 'inventory_export';
      const evidence = await base44.asServiceRole.entities.StoreSetupDocument.filter({ store_id:store.id,kind },'-created_date',1);
      if (evidence[0]?.status !== 'approved' || !record.document_ids?.includes(evidence[0].id)) throw setupError('Review the current uploaded evidence linked to this submission. A newer upload requires a correction version and re-submission.',409);
    }
    if (record.step === 'license' && fields.license_expiration_date < now.slice(0,10)) throw setupError('An expired license cannot be approved.', 409);
    if (record.step === 'business') await requireUnambiguousRetailer(base44, { ...store, ...fields });
    if (record.step === 'inventory') {
      const items = await base44.asServiceRole.entities.Product.filter({ store_id: store.id, inventory_source: { $in: ['clover','manual','csv'] }, in_stock: true, price: { $gt: 0 } }, '-updated_date', 100);
      if (!items.some(p => p.stock_quantity == null || p.stock_quantity > 0)) throw setupError('Load real sellable products and prices into this store’s inventory before approval.', 409);
    }
    if (record.step === 'device') {
      if (body.sandbox_test_verified !== true) throw setupError('An administrator must confirm the sandbox payment, received retailer notification and delivery-handoff evidence. A retailer checkbox is not proof.',409);
      const tokens = await base44.asServiceRole.entities.FCMToken.filter({ store_id: store.id }, '-created_date', 1);
      if (!tokens.length) throw setupError('Register a retailer notification device before reviewing this test.', 409);
    }
    const update = setupStoreMapping(record.step, fields, store);
    if (record.step === 'license') update.license_status = 'active';
    await mapRetailerSetupReview(base44,user,store,record,fields);
    if (Object.keys(update).length) await base44.asServiceRole.entities.Store.update(store.id, update);
  }
  return await base44.asServiceRole.entities.RetailerSetupSubmission.update(record.id, { status: decision, reviewed_at: now, reviewed_by: user.email, review_note: note.trim(), ...(decision === 'approved' ? { mapped_at: now } : {}) });
}