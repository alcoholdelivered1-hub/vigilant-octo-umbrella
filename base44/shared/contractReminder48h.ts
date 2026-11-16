import { contactsFor } from './retailerGmail.ts';
import { sendRetailerEventEmail } from './sendRetailerEventEmail.ts';

export async function hasSubmittedRetailerContract(base44, storeId) {
  const agreements = await base44.asServiceRole.entities.RetailerAgreement.filter({ store_id: storeId, status: 'submitted' }, '-created_date', 1);
  if (agreements.length) return true;
  const documents = await base44.asServiceRole.entities.StoreSetupDocument.filter({ store_id: storeId, kind: 'signed_agreement', file_uri: { $nin: [null, ''] } }, '-created_date', 1);
  return documents.some(document => Boolean(document.file_uri));
}

export async function contractReminders48h(base44, { store_ids, preview_only = false }) {
  const now = Date.now(), cutoff = new Date(now - 48 * 60 * 60 * 1000).toISOString();
  const entities = base44.asServiceRole.entities;
  const selected = [];
  if (store_ids) for (const id of store_ids) selected.push(await entities.Store.get(id));
  const results = []; let cursor = null, attempts = 0, examined = 0;
  do {
    const page = store_ids ? { items: selected, has_more: false, next_cursor: null } : await entities.Store.filter({ contract_sent_at: { $lte: cutoff } }, { sort: 'contract_sent_at', limit: 25, cursor });
    for (const candidate of page.items) {
      examined++;
      const store = await entities.Store.get(candidate.id);
      const requested = Date.parse(store.contract_sent_at || '');
      if (!Number.isFinite(requested) || now - requested < 48 * 60 * 60 * 1000) continue;
      const recipients = contactsFor(store);
      if (!recipients.length) { results.push({ store_id: store.id, status: 'skipped', reason: 'No valid saved retailer contact' }); continue; }
      const eventKey = `contract-reminder-48h:${store.id}:${new Date(requested).toISOString()}`;
      const sent = await entities.RetailerNotificationDelivery.filter({ event_key: eventKey, status: 'sent' }, '-created_date', 100);
      if (recipients.every(email => sent.some(delivery => delivery.recipient === email))) continue;
      // A signed upload awaiting review is already submitted, not an unsigned contract.
      if (await hasSubmittedRetailerContract(base44, store.id)) continue;
      attempts++;
      try {
        const result = await sendRetailerEventEmail(base44, store, { type: 'contract_reminder' }, eventKey, { preview: preview_only === true });
        if (preview_only !== true) await entities.Store.update(store.id, { reminder_sent_at: new Date().toISOString() });
        results.push({ store_id: store.id, store_name: store.name, status: preview_only === true ? 'preview' : 'sent', recipient_count: recipients.length, sent: result.sent || 0 });
      } catch (error) {
        console.error('48-hour contract reminder failed:', store.id, error.message);
        results.push({ store_id: store.id, status: 'failed', error: error.message });
      }
      // Bound Gmail work; the next hourly run picks up unsent retailers and failed recipients.
      if (attempts >= 5) break;
    }
    cursor = attempts < 5 && page.has_more ? page.next_cursor : null;
  } while (cursor);
  return { success: results.every(result => result.status !== 'failed'), preview: preview_only === true, sent: results.reduce((sum, result) => sum + (result.sent || 0), 0), examined, results };
}