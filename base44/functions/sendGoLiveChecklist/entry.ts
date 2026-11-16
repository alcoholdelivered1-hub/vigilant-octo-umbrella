import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { assertAdmin } from '../../shared/authGuard.ts';
import { resolveAppOrigin } from '../../shared/appOrigin.ts';
import { createMimeMessage } from 'npm:mimetext@3.0.24';
import { beverageKingFinalStepsEmail } from '../../shared/beverageKingFinalStepsEmail.ts';
import { retailerSetupLinkEmail } from '../../shared/retailerSetupLinkEmail.ts';
import { retailerLaunchInstructionsEmail } from '../../shared/retailerLaunchInstructionsEmail.ts';
import { sendRetailerEventEmail } from '../../shared/sendRetailerEventEmail.ts';

const ACT157_URL = 'https://arkleg.state.ar.us/Acts/FTPDocument?path=%2FACTS%2F2025R%2FPublic%2F&file=157.pdf&ddBienniumSession=2025%2F2025R';

function buildRawEmail(to, subject, htmlBody, fromName, attachment = null) {
  const message = createMimeMessage();
  message.setSender({ name: fromName, addr: 'alcohol.delivered1@gmail.com' });
  message.setRecipient(to);
  message.setSubject(subject);
  message.addMessage({ contentType: 'text/html', data: htmlBody });
  if (attachment) message.addAttachment(attachment);
  return message.asEncoded();
}

function buildGoLiveHTML(store, appOrigin) {
  const dashboardUrl = `${appOrigin}/store/dashboard`;
  const contractUrl = `${appOrigin}/retailer-contract`;
  const steps = [
    { n: 1, title: 'Sign Your Retailer Partner Agreement', desc: 'Review and sign the third-party delivery agreement that defines roles, fees, and liability.', cta: 'View Agreement', url: contractUrl },
    { n: 2, title: 'Complete Stripe Connect Onboarding', desc: 'Link your bank account and submit KYC details so customer payments route directly to your store.', cta: 'Open Partner Portal', url: dashboardUrl },
    { n: 3, title: 'Add or Sync Your Inventory', desc: 'Connect your Clover POS for automatic sync, or upload your product catalog manually so customers can browse and order.', cta: 'Open Partner Portal', url: dashboardUrl },
    { n: 4, title: 'Verify Store Details', desc: 'Confirm your address, operating hours, contact email, and ABC license number are correct in the Partner Portal settings.', cta: 'Open Partner Portal', url: dashboardUrl },
    { n: 5, title: 'Confirm ABC License Is Active', desc: 'Ensure your Arkansas ABC retail license is current and in good standing — we cannot go live without it.', cta: null, url: null },
    { n: 6, title: 'Run a Test Order', desc: 'Once the above are complete, we will place a test order end-to-end to verify payments, notifications, and driver dispatch.', cta: null, url: null },
  ];

  const stepsHtml = steps.map(s => `
    <tr><td style="padding:0 0 12px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px 20px;">
        <tr>
          <td style="vertical-align:top;width:36px;">
            <span style="display:inline-block;width:28px;height:28px;line-height:28px;text-align:center;background:#1e3a5f;color:#fff;font-weight:700;font-size:14px;border-radius:50%;">${s.n}</span>
          </td>
          <td style="vertical-align:top;padding-left:12px;">
            <p style="margin:0 0 4px;color:#1e293b;font-size:15px;font-weight:600;">${s.title}</p>
            <p style="margin:0;color:#475569;font-size:13px;line-height:1.5;">${s.desc}</p>
            ${s.cta ? `<a href="${s.url}" style="display:inline-block;margin-top:10px;background:#f59e0b;color:#1e3a5f;padding:7px 16px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:700;">${s.cta} →</a>` : ''}
          </td>
        </tr>
      </table>
    </td></tr>`).join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'DM Sans',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#1e3a5f;padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">Ready to Go Live 🚀</h1>
            <p style="margin:6px 0 0;color:#f59e0b;font-size:13px;text-transform:uppercase;letter-spacing:1.5px;">Your Go-Live Checklist · Alcohol Delivered</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;">Hi ${store.name}!</h2>
            <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.6;">
              You're almost ready to start receiving orders through <strong>Alcohol Delivered</strong>. Complete the six steps below and we'll flip your store live — once finished, customers across ${store.city}, AR can browse your catalog and place delivery orders.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">${stepsHtml}</table>
            <p style="margin:20px 0 0;color:#1e293b;font-size:14px;line-height:1.6;background:#fef3c7;border-left:4px solid #f59e0b;padding:14px 18px;border-radius:0 8px 8px 0;">
              <strong>Need help?</strong> Contact John Bess directly at <a href="tel:+18707181521" style="color:#1e3a5f;">870-718-1521</a>, reply to this email, or reach us at <a href="mailto:alcohol.delivered1@gmail.com" style="color:#1e3a5f;">alcohol.delivered1@gmail.com</a> and we'll walk you through each step.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#1e3a5f;padding:20px 40px;text-align:center;">
            <p style="margin:0;color:#94a3b8;font-size:11px;line-height:1.5;">
              Alcohol Delivered, LLC · Pine Bluff, AR · alcohol-delivered.biz<br>
              This email was sent to ${store.email} as part of your retailer onboarding.
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

    const { store_id, final_steps = false, preview_only = false, onboarding_link = false, contact_email, launch_instructions = false, act157_copy = false, live_changed_at } = await req.json();
    if (act157_copy === true && (final_steps === true || onboarding_link === true || launch_instructions === true || contact_email !== undefined)) {
      return Response.json({ error: 'Act 157 copies use the saved store contact and cannot be combined with other emails.' }, { status: 400 });
    }
    if (!store_id) return Response.json({ error: 'store_id is required' }, { status: 400 });

    const store = await base44.asServiceRole.entities.Store.get(store_id);
    if (!store) return Response.json({ error: 'Store not found' }, { status: 404 });
    if (live_changed_at !== undefined) {
      if (launch_instructions !== true || contact_email !== undefined || onboarding_link === true || final_steps === true || act157_copy === true || typeof live_changed_at !== 'string' || live_changed_at.length > 50 || !Number.isFinite(Date.parse(live_changed_at))) return Response.json({ error:'Choose a valid recorded live-status transition.' },{ status:400 });
      if (store.onboarding_status !== 'live') return Response.json({ skipped:true,sent:false,reason:'The store is no longer Live.' });
      return Response.json(await sendRetailerEventEmail(base44,store,{ type:'live' },`Store:${store.id}:live:${new Date(live_changed_at).toISOString()}`,{ preview:preview_only === true }));
    }
    const launchMarker = '[AUTO_LAUNCH_INSTRUCTIONS_SENT]';
    if (launch_instructions === true) {
      if (store.onboarding_status !== 'live' || store.is_active !== true) return Response.json({ skipped: true, reason: 'Store has not completed launch' });
      if (contact_email !== undefined || onboarding_link === true || final_steps === true) return Response.json({ error: 'Launch instructions use the saved store contact only.' }, { status: 400 });
      if (store.onboarding_notes?.includes(launchMarker)) return Response.json({ skipped: true, reason: 'Launch instructions already sent' });
    }
    const recipientEmail = contact_email === undefined ? store.email : String(contact_email).trim().toLowerCase();
    if (!recipientEmail) return Response.json({ error: 'Store has no email on file — set one before sending' }, { status: 400 });
    if (contact_email !== undefined && (onboarding_link !== true || ![store.email, ...(store.contact_emails || [])].some(email => email?.toLowerCase() === recipientEmail))) {
      return Response.json({ error: 'Onboarding invitations may only be sent to a saved store contact.' }, { status: 400 });
    }

    const appOrigin = resolveAppOrigin(req);
    const subject = act157_copy === true ? 'Arkansas Act 157 of 2025 — Third-Party Alcohol Delivery (Official Copy)' : launch_instructions === true ? `${store.name} is live — final setup instructions` : onboarding_link === true ? `Your retailer onboarding link — ${store.name}` : final_steps === true ? 'Beverage King: your setup link and final go-live steps' : `Your Go-Live Checklist — ${store.name} × Alcohol Delivered`;
    let htmlBody;
    if (act157_copy === true) {
      htmlBody = `<html><body style="font-family:Arial,sans-serif;line-height:1.6;max-width:620px;margin:auto;padding:20px"><h1>Arkansas Act 157 of 2025</h1><p>Hello,</p><p>Attached is the official Arkansas General Assembly copy of Act 157 of the 2025 Regular Session (Senate Bill 98), which authorizes third-party delivery of alcoholic beverages from certain retailers and creates a third-party delivery permit.</p><p><a href="${ACT157_URL.replaceAll('&', '&amp;')}">Download the official Act 157 PDF from the Arkansas Legislature</a></p><p>This copy is provided for your reference alongside your retailer agreement and onboarding steps. Please consult Arkansas ABC for current rules and requirements; this email is not legal advice or confirmation of permit approval.</p><p>For onboarding assistance, contact John Bess at <a href="tel:+18707181521">870-718-1521</a> or reply to this email.</p><p>Alcohol Delivered</p></body></html>`;
    } else if (launch_instructions === true) {
      htmlBody = retailerLaunchInstructionsEmail(store, appOrigin);
    } else if (onboarding_link === true) {
      htmlBody = retailerSetupLinkEmail(store, recipientEmail);
    } else if (final_steps === true) {
      if ((store.email || '').trim().toLowerCase() !== 'bevking71603@gmail.com') {
        return Response.json({ error: 'Final steps are specific to Beverage King.' }, { status: 400 });
      }
      const readiness = await base44.functions.invoke('beverageKingGoLive', { action: 'preview' });
      if (!readiness.data?.checks || !Array.isArray(readiness.data?.checklist)) throw new Error('Could not obtain current launch checks; email was not sent.');
      htmlBody = beverageKingFinalStepsEmail(store, readiness.data);
    } else {
      htmlBody = buildGoLiveHTML(store, appOrigin);
    }
    if (preview_only === true) {
      buildRawEmail(recipientEmail, subject, htmlBody, 'Alcohol Delivered');
      return Response.json({ preview: true, sent: false, subject, html: htmlBody });
    }

    let attachment = null;
    if (act157_copy === true) {
      const pdfResponse = await fetch(ACT157_URL, { signal: AbortSignal.timeout(20000) });
      if (!pdfResponse.ok) throw new Error('Could not download the official Act 157 PDF; email was not sent.');
      const bytes = new Uint8Array(await pdfResponse.arrayBuffer());
      if (bytes.length > 5 * 1024 * 1024 || new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') throw new Error('The Act 157 download was not a valid PDF; email was not sent.');
      let binary = '';
      for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      attachment = { filename: 'Arkansas_Act_157_2025_Third_Party_Alcohol_Delivery.pdf', contentType: 'application/pdf', data: btoa(binary) };
    }
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
    const raw = buildRawEmail(recipientEmail, subject, htmlBody, 'Alcohol Delivered', attachment);

    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Gmail API error: ${res.status} — ${errBody}`);
    }

    const message = await res.json();
    if (launch_instructions === true) {
      const latest = await base44.asServiceRole.entities.Store.get(store.id);
      await base44.asServiceRole.entities.Store.update(store.id, {
        onboarding_notes: `${latest.onboarding_notes || ''}\n${launchMarker} ${new Date().toISOString()} Gmail message ${message.id}`.trim(),
      });
    }
    if (onboarding_link === true && ['pending', 'invited', 'contract_sent'].includes(store.onboarding_status)) {
      await base44.asServiceRole.entities.Store.update(store.id, {
        onboarding_status: 'contract_sent', contract_sent_at: store.contract_sent_at || new Date().toISOString(),
      });
    }
    return Response.json({ success: true, sent_to: recipientEmail, store_name: store.name, message_id: message.id });
  } catch (error) {
    console.error('[sendGoLiveChecklist] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}