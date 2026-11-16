import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { assertAdmin } from '../../shared/authGuard.ts';
import { createMimeMessage } from 'npm:mimetext@3.0.24';
import { retailerSetupLinkEmail } from '../../shared/retailerSetupLinkEmail.ts';
import { retailerAppInstallEmail } from '../../shared/retailerAppInstallEmail.ts';
import { contactsFor } from '../../shared/retailerGmail.ts';
import { buildOnboardingHTML } from '../../shared/retailerOnboardingEmail.ts';

// Encode email headers and content safely for Gmail.
function buildRawEmail(to, subject, htmlBody, fromName) {
  const message = createMimeMessage();
  message.setSender({ name: fromName, addr: 'alcohol.delivered1@gmail.com' });
  message.setRecipient(to);
  message.setSubject(subject);
  message.addMessage({ contentType: 'text/html', data: htmlBody });
  return message.asEncoded().replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

    const payload = await req.json();

    const { authorized, response, user } = await assertAdmin(base44);
    if (!authorized) return response;

    const { county, city, store_id: directStoreId } = payload;
    const isAutomation = Boolean(payload.event);
    const store_id = isAutomation ? payload.event.entity_id : directStoreId;

    // Fetch all stores and filter by store_id, county, or city
    const installInvite = payload.install_invite === true;
    const storefrontInvite = payload.storefront_invite === true || installInvite;
    const excluded = payload.excluded_store_ids || [];
    if (!Array.isArray(excluded) || excluded.length > 50 || excluded.some(id => typeof id !== 'string')) return Response.json({ error: 'Invalid excluded retailer list' }, { status: 400 });
    const allStores = []; let cursor = null;
    do {
      const page = await base44.asServiceRole.entities.Store.list({ sort: 'name', limit: 100, cursor });
      allStores.push(...page.items); cursor = page.has_more ? page.next_cursor : null;
    } while (cursor);
    let stores = allStores.filter(s => {
      if (storefrontInvite && (excluded.includes(s.id) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email || ''))) return false;
      if (store_id) return s.id === store_id && s.email;
      const countyMatch = !county || (s.county || '').toLowerCase() === county.toLowerCase();
      const cityMatch = !city || (s.city || '').toLowerCase() === city.toLowerCase();
      return countyMatch && cityMatch && s.email;
    });

    if (installInvite) {
      const seen = new Set();
      stores = stores.flatMap(store => contactsFor(store).map(email => ({...store,email}))).filter(store => { if (seen.has(store.email)) return false; seen.add(store.email); return true; });
      if (payload.include_admin === true && !seen.has(user.email.toLowerCase())) stores.push({id:'',name:'Your administrator app',email:user.email,admin:true});
    }
    if (stores.length === 0) {
      return Response.json({ skipped: true, reason: 'No stores found with email for the given filters' });
    }

    if (payload.preview_only === true) {
      return Response.json({ preview: true, sent: false, count: stores.length, recipients:installInvite ? stores.map(s => ({store:s.name,email:s.email})) : undefined, html: installInvite ? retailerAppInstallEmail(stores[0],stores[0].email) : storefrontInvite ? retailerSetupLinkEmail(stores[0], stores[0].email, true) : buildOnboardingHTML(stores[0]) });
    }

    // Get Gmail OAuth access token
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');

    const results = [];

    for (const store of stores) {
      const subject = installInvite ? 'Alcohol Delivered: add the app to your phone and laptop' : storefrontInvite ? `${store.name}: your storefront and setup invitation` : `Welcome to Alcohol Delivered — Partner Onboarding for ${store.name}`;
      const htmlBody = installInvite ? retailerAppInstallEmail(store,store.email) : storefrontInvite ? retailerSetupLinkEmail(store, store.email, true) : buildOnboardingHTML(store);

      try {
        const raw = buildRawEmail(store.email, subject, htmlBody, 'Alcohol Delivered');

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

        console.log(`Onboarding email sent to ${store.name} <${store.email}>`);

        // Keep the initial request time so re-sends do not reset the reminder clock.
        if (!storefrontInvite && ['pending', 'invited', 'contract_sent'].includes(store.onboarding_status || 'invited')) {
          await base44.asServiceRole.entities.Store.update(store.id, {
            onboarding_status: 'contract_sent',
            contract_sent_at: store.contract_sent_at || new Date().toISOString(),
          }).catch((e) => console.error(`Failed to advance stage for ${store.name}: ${e.message}`));
        }

        await base44.asServiceRole.integrations.Core.TrackEvent({
          event_name: 'retailer_onboarding_email_sent',
          properties: {
            store_id: store.id,
            store_name: store.name,
            store_email: store.email,
            county: store.county || '',
            city: store.city || '',
            triggered_by: isAutomation ? 'automation' : 'admin',
          },
        }).catch(() => {});
        results.push({ store: store.name, email: store.email, status: 'sent' });
      } catch (err) {
        console.error(`Failed to send to ${store.name}: ${err.message}`);
        results.push({ store: store.name, email: store.email, status: 'failed', error: err.message });
      }
    }

    const sent = results.filter(r => r.status === 'sent').length;
    const failed = results.filter(r => r.status === 'failed').length;

    return Response.json({ success: true, sent, failed, results });

  } catch (error) {
    console.error('Onboarding email error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}