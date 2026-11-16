import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { assertAdmin } from '../../shared/authGuard.ts';
import { createMimeMessage } from 'npm:mimetext@3.0.24';
import { contactsFor, gmailConnection, BUSINESS_EMAIL } from '../../shared/retailerGmail.ts';
import { buildOnboardingHTML } from '../../shared/retailerOnboardingEmail.ts';
import { hasSubmittedRetailerContract } from '../../shared/contractReminder48h.ts';

function buildRawEmail(to, subject, htmlBody, fromName) {
  const message = createMimeMessage();
  message.setSender({ name: fromName, addr: BUSINESS_EMAIL });
  message.setRecipient(to);
  message.setSubject(subject);
  message.addMessage({ contentType: 'text/html', data: htmlBody });
  return message.asEncoded().replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const STALL_THRESHOLD_DAYS = 14;
const RE_ENGAGE_COOLDOWN_DAYS = 14;

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const { authorized, response } = await assertAdmin(base44);
    if (!authorized) return response;

    const body = await req.json().catch(() => ({}));
    const preview_only = body.preview_only === true;

    const now = Date.now();
    const stallCutoff = new Date(now - STALL_THRESHOLD_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const cooldownCutoff = new Date(now - RE_ENGAGE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000).toISOString();

    // Find stores that received the initial onboarding email 14+ days ago,
    // haven't progressed past contract_sent, and haven't been re-engaged recently.
    const allStores = [];
    let cursor = null;
    do {
      const page = await base44.asServiceRole.entities.Store.list({ sort: 'contract_sent_at', limit: 100, cursor });
      allStores.push(...page.items);
      cursor = page.has_more ? page.next_cursor : null;
    } while (cursor);

    const targets = allStores.filter((store) => {
      if (!['pending', 'invited', 'contract_sent'].includes(store.onboarding_status || 'invited')) return false;
      if (!store.email) return false;
      const sentAt = store.contract_sent_at ? new Date(store.contract_sent_at).getTime() : null;
      if (!sentAt || sentAt > new Date(stallCutoff).getTime()) return false;
      const remindedAt = store.reminder_sent_at ? new Date(store.reminder_sent_at).getTime() : 0;
      if (remindedAt > new Date(cooldownCutoff).getTime()) return false;
      return true;
    });

    if (targets.length === 0) {
      return Response.json({ success: true, sent: 0, reason: 'No stalled retailers due for re-engagement' });
    }

    const gmail = await gmailConnection(base44);
    const results = [];

    for (const store of targets) {
      try {
        // Skip stores that already submitted their contract — they're not stalled.
        if (await hasSubmittedRetailerContract(base44, store.id)) {
          results.push({ store: store.name, status: 'skipped', reason: 'Contract already submitted' });
          continue;
        }

        // Skip if we've already contacted them recently.
        const recent = await gmail(`messages?q=${encodeURIComponent(`in:sent to:${store.email} after:${Math.floor(new Date(cooldownCutoff).getTime() / 1000)}`)}&maxResults=1`);
        if (recent.messages?.length) {
          results.push({ store: store.name, status: 'skipped', reason: 'Contacted within the last 14 days' });
          continue;
        }

        if (preview_only) {
          results.push({ store: store.name, status: 'preview' });
          continue;
        }

        const subject = `${store.name}: Still need help with your Alcohol Delivered setup?`;
        const htmlBody = buildOnboardingHTML(store);
        const raw = buildRawEmail(store.email, subject, htmlBody, 'Alcohol Delivered');
        await gmail('messages/send', { method: 'POST', body: JSON.stringify({ raw }) });

        // Reset the reminder clock so the 48h and 3-day cycles restart.
        await base44.asServiceRole.entities.Store.update(store.id, {
          contract_sent_at: new Date().toISOString(),
          reminder_sent_at: null,
        });

        console.log(`Re-engagement email sent to ${store.name} <${store.email}>`);
        results.push({ store: store.name, email: store.email, status: 'sent' });
      } catch (err) {
        console.error(`Re-engagement failed for ${store.name}: ${err.message}`);
        results.push({ store: store.name, status: 'failed', error: err.message });
      }
    }

    const sent = results.filter((r) => r.status === 'sent').length;
    return Response.json({ success: results.every((r) => r.status !== 'failed'), sent, preview: preview_only, results });
  } catch (error) {
    console.error('Re-engage stalled retailers error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}