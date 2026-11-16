import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { assertAdmin } from '../../shared/authGuard.ts';
import { createMimeMessage } from 'npm:mimetext@3.0.24';
import { gmailConnection } from '../../shared/retailerGmail.ts';
import { retailerFollowUpStep } from '../../shared/retailerFollowUpStep.ts';
import { contractReminders48h, hasSubmittedRetailerContract } from '../../shared/contractReminder48h.ts';

const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
function buildRawEmail(to, subject, htmlBody, fromName, senderEmail) {
  const message = createMimeMessage();
  message.setSender({ name: fromName, addr: senderEmail });
  message.setRecipient(to);
  message.setSubject(subject);
  message.addMessage({ contentType: 'text/html', data: htmlBody });
  return message.asEncoded();
}

function buildReminderHTML(store, nextStep) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'DM Sans',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:#1e3a5f;padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:0.5px;">Alcohol Delivered</h1>
            <p style="margin:4px 0 0;color:#f59e0b;font-size:13px;text-transform:uppercase;letter-spacing:1.5px;">Your next retailer setup step</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;">Hello ${store.name} Team,</h2>
            <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.6;">
              We want to help ${store.name} reach customers who prefer delivery. Your next step is <strong>${escapeHTML(nextStep.title)}</strong>.
            </p>
            <p style="margin:0 0 28px;color:#1e293b;font-size:15px;line-height:1.6;background:#fef3c7;border-left:4px solid #f59e0b;padding:16px 20px;border-radius:0 8px 8px 0;">
              ${escapeHTML(nextStep.description)}
            </p>

            <!-- CTA Button -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td align="center">
                  <a href="${nextStep.url}" style="display:inline-block;background:#f59e0b;color:#1e3a5f;padding:14px 36px;border-radius:8px;text-decoration:none;font-size:16px;font-weight:700;">Complete this setup step</a>
                </td>
              </tr>
            </table>

            <h3 style="margin:0 0 12px;color:#1e3a5f;font-size:16px;">Let us help you finish</h3>
            <p style="margin:0 0 20px;color:#475569;font-size:14px;line-height:1.6;">Reply with two convenient times for a 20-minute setup session with John Bess and tell us what is holding you up. John will confirm a time by reply; no appointment is booked yet. You must personally sign your agreement and complete any owner-only identity and bank verification securely in Stripe. Never send passwords, identity documents or bank details by email.</p>
            <p style="margin:0 0 24px;color:#475569;font-size:13px;line-height:1.6;">Your store can accept delivery orders only after payment, inventory, license, tax and delivery-readiness checks pass. Sales volume is not guaranteed.</p>

            <!-- Contact -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:10px;padding:16px 20px;">
              <tr><td style="color:#1e3a5f;font-size:14px;font-weight:600;padding-bottom:8px;">Contact John Bess: 870-718-1521 or reply to this email.</td></tr>
              <tr><td style="color:#475569;font-size:13px;padding:2px 0;">✉️ <a href="mailto:alcohol.delivered1@gmail.com" style="color:#1e3a5f;text-decoration:none;">alcohol.delivered1@gmail.com</a></td></tr>
              <tr><td style="color:#475569;font-size:13px;padding:2px 0;">📞 870-209-9109 · 870-718-1521</td></tr>
              <tr><td style="color:#475569;font-size:13px;padding:2px 0;">🌐 <a href="https://alcohol-delivered.biz" style="color:#1e3a5f;text-decoration:none;">alcohol-delivered.biz</a></td></tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#1e3a5f;padding:20px 40px;text-align:center;">
            <p style="margin:0;color:#94a3b8;font-size:11px;line-height:1.5;">
              Alcohol Delivered, LLC · Pine Bluff, AR · alcohol-delivered.biz<br>
              This email was sent to ${store.email}.<br>
              Operating under Arkansas ACT 157 with a valid ABC Third-Party Delivery Permit.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const { authorized, response } = await assertAdmin(base44);
    if (!authorized) return response;

    const { store_ids, preview_only = false, reminder_type } = await req.json();
    if (store_ids !== undefined && (!Array.isArray(store_ids) || store_ids.length < 1 || store_ids.length > 2 || store_ids.some(id => typeof id !== 'string' || id.length > 100))) return Response.json({ error: 'Select one or two priority retailers.' }, { status: 400 });
    if (typeof preview_only !== 'boolean' || (reminder_type !== undefined && reminder_type !== 'contract_48h')) return Response.json({ error: 'Invalid reminder options.' }, { status: 400 });
    if (reminder_type === 'contract_48h') return Response.json(await contractReminders48h(base44, { store_ids, preview_only }));
    const REMINDER_AFTER_DAYS = 3;
    const now = Date.now();
    const cutoff = now - REMINDER_AFTER_DAYS * 24 * 60 * 60 * 1000;

    const allStores = store_ids
      ? await base44.asServiceRole.entities.Store.filter({ id: { $in: store_ids } })
      : await base44.asServiceRole.entities.Store.filter({ onboarding_status: 'contract_sent' }, '-contract_sent_at', 100);

    // Stores still awaiting signature, with an email, contract sent >= 3 days ago,
    // and no reminder sent in the last 3 days.
    const targets = allStores.filter((s) => {
      if (!(store_ids ? ['pending', 'invited', 'contract_sent', 'contract_signed', 'inventory_added'] : ['contract_sent']).includes(s.onboarding_status)) return false;
      if (!s.email) return false;
      const sentAt = s.contract_sent_at ? new Date(s.contract_sent_at).getTime() : null;
      if (!sentAt || sentAt > cutoff) return false;
      const remindedAt = s.reminder_sent_at ? new Date(s.reminder_sent_at).getTime() : 0;
      if (remindedAt > cutoff) return false;
      return true;
    });

    if (targets.length === 0) {
      return Response.json({ success: true, sent: 0, reason: 'No stores due for a reminder' });
    }

    const gmail = await gmailConnection(base44);
    const emailAddress = 'alcohol.delivered1@gmail.com';

    const results = [];
    for (const store of targets) {
      try {
        if (!(await hasSubmittedRetailerContract(base44, store.id))) { results.push({ store: store.name, status: 'skipped', reason: 'Unsigned contracts are handled by the dedicated 48-hour reminder workflow' }); continue; }
        const recent = await gmail(`messages?q=${encodeURIComponent(`in:sent to:${store.email} after:${Math.floor(cutoff / 1000)}`)}&maxResults=1`);
        if (recent.messages?.length) { results.push({ store: store.name, status: 'skipped', reason: 'Contacted within the last 72 hours' }); continue; }
        const nextStep = await retailerFollowUpStep(base44, store);
        if (preview_only === true) { results.push({ store: store.name, status: 'preview', next_step: nextStep.title }); continue; }
        const subject = `${store.name}: ${nextStep.title}`;
        const htmlBody = buildReminderHTML({ ...store, name: escapeHTML(store.name), email: escapeHTML(store.email) }, nextStep);
        const raw = buildRawEmail(store.email, subject, htmlBody, 'Alcohol Delivered', emailAddress);
        await gmail('messages/send', { method: 'POST', body: JSON.stringify({ raw }) });
        await base44.asServiceRole.entities.Store.update(store.id, {
          reminder_sent_at: new Date().toISOString(),
        });
        console.log(`Reminder sent to ${store.name} <${store.email}>`);
        results.push({ store: store.name, status: 'sent' });
      } catch (err) {
        console.error(`Reminder failed for ${store.name}: ${err.message}`);
        results.push({ store: store.name, status: 'failed', error: err.message });
      }
    }

    const sent = results.filter((r) => r.status === 'sent').length;
    return Response.json({ success: results.every(result => result.status !== 'failed'), sent, preview: preview_only === true, results });
  } catch (error) {
    console.error('Contract reminder error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}