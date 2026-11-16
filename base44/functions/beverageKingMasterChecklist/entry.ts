import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { createMimeMessage } from 'npm:mimetext@3.0.24';
import { resolveAppOrigin } from '../../shared/appOrigin.ts';
import { findBeverageKingStores } from '../../shared/beverageKingStore.ts';

const BK_EMAIL = 'bevking71603@gmail.com';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_STAFF = 10;

async function buildChecklist(base44, store) {
  const readinessRes = await base44.functions.invoke('beverageKingGoLive', { action: 'preview' });
  if (readinessRes.data?.error) throw new Error(readinessRes.data.error);
  return readinessRes.data.checklist;
}

function buildEmailHTML(store, checklist, origin) {
  const done = checklist.filter((i) => i.done).length;
  const rows = checklist.map((i) => `
    <tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-size:14px;color:#1e293b;">
      ${i.done ? '&#9989;' : '&#11036;'} ${i.title}
      <span style="float:right;font-size:11px;color:#64748b;text-transform:uppercase;">${i.owner}</span>
    </td></tr>`).join('');
  const staffSteps = [
    `Open the Store Dashboard on the store tablet: <a href="${origin}/store/dashboard" style="color:#1e3a5f;font-weight:600;">${origin}/store/dashboard</a> and sign in with the store account (${store.email}).`,
    'Tap <strong>Enable notifications</strong> so new orders chime on the tablet, and keep the tablet plugged in during open hours.',
    'When an order arrives, <strong>confirm it right away</strong>, then pull every item and ring it through Clover.',
    'Bag and <strong>seal</strong> the order, then mark it <strong>Ready for pickup</strong> in the dashboard.',
    'At handoff, check the driver’s name matches the one shown on the order. Never hand an order to anyone else.',
    'If an item is out of stock, message the customer from the order screen before continuing — don’t substitute without approval.',
  ].map((s, n) => `<tr><td style="padding:6px 0;font-size:14px;color:#475569;line-height:1.5;"><strong style="color:#1e3a5f;">${n + 1}.</strong> ${s}</td></tr>`).join('');

  return `<!DOCTYPE html><html><body style="margin:0;background:#f1f5f9;font-family:Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;"><tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;">
    <tr><td style="background:#1e3a5f;padding:28px 40px;text-align:center;">
      <h1 style="margin:0;color:#fff;font-size:22px;">${store.name} Go-Live Checklist</h1>
      <p style="margin:6px 0 0;color:#f59e0b;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;">${done} of ${checklist.length} complete · Alcohol Delivered</p>
    </td></tr>
    <tr><td style="padding:28px 40px;">
      <h2 style="margin:0 0 8px;color:#1e3a5f;font-size:16px;">Master checklist</h2>
      <table width="100%" cellpadding="0" cellspacing="0">${rows}</table>
      <h2 style="margin:28px 0 8px;color:#1e3a5f;font-size:16px;">Staff playbook — how to handle a delivery order</h2>
      <table width="100%" cellpadding="0" cellspacing="0">${staffSteps}</table>
      <p style="margin:24px 0 0;font-size:13px;color:#1e293b;background:#fef3c7;border-left:4px solid #f59e0b;padding:12px 16px;">
        Questions? Reply to this email and we’ll walk you through it.
      </p>
    </td></tr>
  </table></td></tr></table></body></html>`;
}

async function sendEmail(accessToken, to, subject, html) {
  const msg = createMimeMessage();
  msg.setSender({ name: 'Alcohol Delivered', addr: 'alcohol.delivered1@gmail.com' });
  msg.setRecipient(to);
  msg.setSubject(subject);
  msg.addMessage({ contentType: 'text/html', data: html });
  const raw = msg.asEncoded().replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  });
  if (!res.ok) throw new Error(`Gmail ${res.status}: ${await res.text()}`);
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    if (body.action && !['send', 'preview'].includes(body.action)) return Response.json({ error: 'Invalid action' }, { status: 400 });
    const action = body.action === 'send' ? 'send' : 'preview';

    const stores = await findBeverageKingStores(base44);
    const store = stores.length === 1 ? stores[0] : null;
    if (!store) return Response.json({ error: 'Beverage King store record was not found' }, { status: 404 });

    const checklist = await buildChecklist(base44, store);
    const summary = { checklist, done: checklist.filter((i) => i.done).length, total: checklist.length };
    if (action === 'preview') return Response.json(summary);

    const staff = Array.isArray(body.staff_emails) ? body.staff_emails : [];
    const cleaned = [...new Set(staff.map((e) => String(e).trim().toLowerCase()).filter(Boolean))];
    if (cleaned.length > MAX_STAFF) return Response.json({ error: `Up to ${MAX_STAFF} staff emails at a time` }, { status: 400 });
    const invalid = cleaned.filter((e) => !EMAIL_RE.test(e));
    if (invalid.length) return Response.json({ error: `Invalid email: ${invalid.join(', ')}` }, { status: 400 });

    const recipients = [...new Set([store.email.toLowerCase(), ...cleaned])];
    const subject = `${store.name} Go-Live Checklist & Staff Onboarding`;
    const html = buildEmailHTML(store, checklist, resolveAppOrigin(req));
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');

    const results = [];
    for (const to of recipients) {
      try {
        await sendEmail(accessToken, to, subject, html);
        results.push({ to, status: 'sent' });
      } catch (err) {
        console.error(`[beverageKingMasterChecklist] send to ${to} failed:`, err.message);
        results.push({ to, status: 'failed', error: err.message });
      }
    }
    return Response.json({ ...summary, results });
  } catch (error) {
    console.error('[beverageKingMasterChecklist] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}