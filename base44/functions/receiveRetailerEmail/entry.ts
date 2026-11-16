import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { assertAdmin } from '../../shared/authGuard.ts';
import { BUSINESS_EMAIL, contactsFor, gmailConnection, header, addresses } from '../../shared/retailerGmail.ts';
import { applyWoodlandsPosReply } from '../../shared/woodlandsPosReply.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const access = await assertAdmin(base44);
    if (!access.authorized) return access.response;
    const body = await req.json();
    const ids = [...new Set(body.data?.new_message_ids || [])].filter(id => typeof id === 'string' && /^[a-z0-9]{1,100}$/i.test(id)).slice(0, 100);
    if (!ids.length) return Response.json({ received: 0 });
    // The connector workflow must supply an authenticated admin identity.
    // Caller-supplied message IDs never bypass the authorization guard.
    const api = await gmailConnection(base44);
    const stores = []; let page;
    do { page = await base44.entities.Store.list({ limit: 100, cursor: page?.next_cursor }); stores.push(...page.items); } while (page.has_more);
    let received = 0;
    for (const id of ids) {
      const message = await api(`messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`);
      if ((message.labelIds || []).some(label => ['SENT', 'DRAFT', 'SPAM', 'TRASH'].includes(label))) continue;
      const senders = addresses(header(message, 'From'));
      if (senders.includes(BUSINESS_EMAIL)) continue;
      const matches = stores.filter(store => contactsFor(store).some(email => senders.includes(email)));
      for (const store of matches) {
        const existing = await base44.entities.RetailerEmailAlert.filter({ gmail_message_id: id, store_id: store.id }, '-created_date', 1);
        if (existing.length) continue;
        await applyWoodlandsPosReply(base44, api, store, message);
        await base44.entities.RetailerEmailAlert.create({ gmail_message_id: id, thread_id: message.threadId, store_id: store.id, store_name: store.name, subject: header(message, 'Subject').slice(0, 300), sender: senders[0] });
        received++;
      }
    }
    return Response.json({ received });
  } catch (error) { console.error('Incoming retailer Gmail:', error.message); return Response.json({ error: error.message }, { status: 500 }); }
}