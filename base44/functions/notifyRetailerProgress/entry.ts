import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { createMimeMessage } from 'npm:mimetext@3.0.24';
import { assertAdmin } from '../../shared/authGuard.ts';
import { secrets } from 'base44:runtime';
import { retailerOnboardingProgress } from '../../shared/retailerOnboardingProgress.ts';
import { buildReadinessIndex } from '../../shared/readiness/readinessIndex.ts';
import { evaluateStoreReadiness } from '../../shared/readiness/evaluateStoreReadiness.ts';
import { retailerStepEmail } from '../../shared/retailerStepEmail.ts';

const RECIPIENT = 'alcohol.delivered1@gmail.com';
const RETAILER_STEPS = ['profile', 'operations', 'license', 'compliance', 'test', 'agreement', 'inventory', 'tax'];
const DOCUMENT_LABELS = { retail_license: 'Retail license uploaded (awaiting review)', signed_agreement: 'Signed agreement uploaded (awaiting review)', inventory_export: 'Inventory export uploaded (awaiting review)', pos_details: 'POS details uploaded (awaiting review)' };

async function inspectStore(base44, store, index) {
  // Same evaluation the compliance dashboard and the launch gate use.
  const readiness = evaluateStoreReadiness({ store, index });
  const documents = index.documents.filter(item => item.store_id === store.id).slice(0, 100);
  const clover = index.clover.filter(item => item.store_id === store.id).slice(0, 1);
  const data = retailerOnboardingProgress(store, readiness.blockers, Boolean(secrets.get('STRIPE_WEBHOOK_SECRET')), readiness);
  const completed = data.checks.filter(step => RETAILER_STEPS.includes(step.key) && step.status === 'complete').map(step => ({ key: step.key, label: step.label }));
  for (const document of documents) completed.push({ key: `document:${document.id}`, label: DOCUMENT_LABELS[document.kind] || 'Setup document uploaded (awaiting review)' });
  if (/^acct_[A-Za-z0-9]+$/.test(store.stripe_connect_account_id || '')) completed.push({ key: 'stripe_account', label: 'Stripe account linked (saved account; not a live KYC check)' });
  if (store.stripe_connection_status === 'connected') completed.push({ key: 'stripe_connected', label: 'Stripe connection recorded as connected' });
  if (clover.length) completed.push({ key: 'clover_connected', label: 'Retailer Clover connection recorded as connected' });
  return { data, completed };
}

export default async function(req) {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const base44 = createClientFromRequest(req);
    const { authorized, response } = await assertAdmin(base44);
    if (!authorized) return response;
    const { store_id, initialize = false, initialize_retailer_emails = false, preview_only = false } = await req.json();
    if (store_id !== undefined && (typeof store_id !== 'string' || store_id.length > 100)) return Response.json({ error: 'Invalid store selection' }, { status: 400 });
    const stores = [];
    if (store_id) stores.push(await base44.asServiceRole.entities.Store.get(store_id));
    else {
      let cursor = null;
      do {
        const page = await base44.asServiceRole.entities.Store.list({ sort: 'name', limit: 100, cursor });
        stores.push(...page.items);
        cursor = page.next_cursor;
        if (stores.length > 200) throw new Error('Progress monitoring supports up to 200 retailers per run.');
      } while (cursor);
    }
    if (stores.some(store => !store)) return Response.json({ error: 'Store not found' }, { status: 404 });
    // Load the shared evidence index once to keep scheduled monitoring within request limits.
    const readinessIndex = await buildReadinessIndex(base44, {});
    const progressStates = stores.length ? await base44.asServiceRole.entities.RetailerProgressAlertState.filter({ store_id: { $in: stores.map(store => store.id) } }, '-created_date', 200) : [];
    const retailerStates = stores.length ? await base44.entities.RetailerStepEmailState.filter({ store_id: { $in: stores.map(store => store.id) } }, '-created_date', 200) : [];
    const retailerResults = [];
    const results = [];
    // Load shared evidence once to keep scheduled monitoring within request limits.
    for (let index = 0; index < stores.length; index += 4) {
      await Promise.all(stores.slice(index, index + 4).map(async store => {
        try {
          if (!store) throw new Error('Store not found');
          const inspection = await inspectStore(base44, store, readinessIndex);
          const existing = progressStates.filter(state => state.store_id === store.id).slice(0, 1);
          const { data, completed } = inspection;
          // Independent delivery state preserves admin alerts if a retailer email fails.
          try {
            const retailerResult = await retailerStepEmail(base44, store, inspection, retailerStates.find(state => state.store_id === store.id), { initialize: initialize_retailer_emails === true, preview: preview_only === true });
            retailerResults.push({ store_id: store.id, ...retailerResult });
          } catch (error) {
            console.error('Retailer step email failed:', store.id, error.message);
            retailerResults.push({ store_id: store.id, error: error.message });
          }
          if (initialize_retailer_emails === true) { results.push({ store_id: store.id, sent: false }); return; }
          const previous = existing[0];
          if (initialize === true && previous) { results.push({ store_id: store.id, already_initialized: true }); return; }
          const added = completed.filter(step => !(previous?.completed_keys || []).includes(step.key));
          const activated = data.live === true && previous?.live !== true;
          const stageChanged = data.stage !== (previous?.stage || 'pending') && data.stage !== 'pending';
          const snapshot = { store_id: store.id, completed_keys: completed.map(step => step.key), stage: data.stage, live: data.live, checked_at: new Date().toISOString() };
          if (preview_only === true) { results.push({ store_id: store.id, store_name: store.name, new_steps: added.map(step => step.label), activated, stage_changed: stageChanged, sent: false }); return; }
          if (previous && previous.live === data.live && previous.stage === data.stage && completed.length === previous.completed_keys?.length && completed.every(step => previous.completed_keys.includes(step.key))) {
            results.push({ store_id: store.id, unchanged: true, sent: false });
            return;
          }
          if (initialize !== true && (added.length || activated || stageChanged)) {
            const lines = [`Retailer: ${store.name}`, `Location: ${store.city || 'Not recorded'}`, '', ...added.map(step => `Completed/recorded: ${step.label}`)];
            if (stageChanged) lines.push(`Onboarding stage changed to: ${data.stage.replaceAll('_', ' ')}`);
            if (activated) lines.push('ACTIVATED: This retailer is now recorded as active with onboarding stage Live.');
            lines.push('', `Current recorded status: ${data.live ? 'Live' : 'Not live'}`, '');
            const outstanding = data.checks.filter(step => step.status !== 'complete');
            lines.push('Remaining launch requirements:', ...outstanding.map(step => `- ${step.label}: ${step.detail}`));
            if (!outstanding.length) lines.push('None reported by the read-only checklist.');
            lines.push('', 'Open the Store Launch Progress page in Alcohol Delivered for details.', 'Uploads await review. Saved payment and activation statuses are not a new verification of KYC, charges, payouts, or permits. This monitor does not activate stores or contact live payment services.');
            const message = createMimeMessage();
            message.setSender({ name: 'Alcohol Delivered', addr: RECIPIENT });
            message.setRecipient(RECIPIENT);
            message.setSubject(`${store.name} — ${activated ? 'retailer activated' : 'onboarding progress'}`);
            message.addMessage({ contentType: 'text/plain', data: lines.join('\n') });
            const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
            const sent = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ raw: message.asEncoded() }) });
            const result = await sent.json();
            if (!sent.ok) throw new Error(result.error?.message || 'Progress email could not be sent.');
            snapshot.last_email_at = new Date().toISOString();
            snapshot.gmail_message_id = result.id;
          }
          if (previous) await base44.asServiceRole.entities.RetailerProgressAlertState.update(previous.id, snapshot);
          else await base44.asServiceRole.entities.RetailerProgressAlertState.create(snapshot);
          results.push({ store_id: store.id, initialized: initialize === true, sent: Boolean(snapshot.gmail_message_id) });
        } catch (error) {
          console.error('Retailer progress notification failed:', store?.id, error.message);
          results.push({ store_id: store?.id, error: error.message });
        }
      }));
    }
    const failures = [...results, ...retailerResults].filter(result => result.error);
    return Response.json({ success: failures.length === 0, monitored: results.length, emails_sent: results.filter(result => result.sent).length, retailer_emails_sent: retailerResults.filter(result => result.sent).length, retailer_emails_initialized: retailerResults.filter(result => result.initialized).length, retailer_emails_skipped: retailerResults.filter(result => result.skipped).map(result => ({ store_id: result.store_id, reason: result.skipped })), initialized: results.filter(result => result.initialized).length, failures, ...(preview_only === true ? { preview: results, retailer_preview: retailerResults } : {}) }, { status: failures.length ? 500 : 200 });
  } catch (error) {
    console.error('Retailer progress monitor failed:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}