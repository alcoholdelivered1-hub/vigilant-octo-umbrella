import { createMimeMessage } from 'npm:mimetext@3.0.24';
import { BUSINESS_EMAIL, contactsFor, gmailConnection } from './retailerGmail.ts';
import { retailerEventEmail } from './retailerEventEmail.ts';

async function messageIdFor(key, recipient) {
  const bytes = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${key}:${recipient}`));
  return `retailer-${Array.from(new Uint8Array(bytes),b => b.toString(16).padStart(2,'0')).join('')}@alcohol-delivered.biz`;
}
function rawEmail(recipient, email, messageId) {
  const message = createMimeMessage();
  message.setSender({ name:'Alcohol Delivered',addr:BUSINESS_EMAIL });
  message.setRecipient(recipient);
  message.setSubject(email.subject);
  message.setHeader('Message-ID',`<${messageId}>`);
  message.addMessage({ contentType:'text/plain',data:email.text });
  message.addMessage({ contentType:'text/html',data:email.html });
  return message.asEncoded().replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
export async function sendRetailerEventEmail(base44,store,event,eventKey,{ preview = false } = {}) {
  const recipients = contactsFor(store);
  const email = retailerEventEmail(store,event);
  if (preview) {
    rawEmail(recipients[0] || BUSINESS_EMAIL,email,await messageIdFor(eventKey,recipients[0] || BUSINESS_EMAIL));
    return { preview:true,sent:false,recipient_count:recipients.length,...email };
  }
  if (!recipients.length) throw new Error('No valid retailer contact is saved. Add a store contact before retrying this notification.');
  const api = await gmailConnection(base44);
  const deliveries = base44.asServiceRole.entities.RetailerNotificationDelivery;
  const results = [];
  for (const recipient of recipients) {
    const filter = { event_key:eventKey,recipient };
    let existing = (await deliveries.filter(filter,'created_date',1))[0];
    if (!existing) {
      await deliveries.create({ ...filter,store_id:store.id,status:'pending' });
      existing = (await deliveries.filter(filter,'created_date',1))[0];
    }
    if (existing.status === 'sent') { results.push({ sent:false,duplicate:true }); continue; }
    const claim = crypto.randomUUID(), claimedAt = new Date().toISOString();
    const leaseExpired = new Date(Date.now()-300000).toISOString();
    const locked = await deliveries.updateMany({ id:existing.id,$or:[{ status:{ $in:['pending','failed'] } },{ status:'sending',claimed_at:{ $lt:leaseExpired } }] },{ $set:{ status:'sending',claim_id:claim,claimed_at:claimedAt,error:'' } });
    if (locked.updated !== 1) { results.push({ error:'This notification is already being processed. Retry after the current delivery finishes.' }); continue; }
    try {
      const messageId = await messageIdFor(eventKey,recipient);
      // Recover an accepted Gmail send if recording its receipt failed on an earlier attempt.
      const prior = await api(`messages?q=${encodeURIComponent(`in:sent rfc822msgid:${messageId}`)}&maxResults=1`);
      const sent = prior.messages?.[0] || await api('messages/send',{ method:'POST',body:JSON.stringify({ raw:rawEmail(recipient,email,messageId) }) });
      if (!sent.id) throw new Error('Gmail did not confirm message acceptance.');
      await deliveries.update(existing.id,{ status:'sent',gmail_message_id:sent.id,sent_at:new Date().toISOString(),error:'' });
      results.push({ sent:true,recovered:Boolean(prior.messages?.length) });
    } catch (error) {
      await deliveries.update(existing.id,{ status:'failed',error:String(error.message).slice(0,1000) });
      results.push({ error:error.message });
    }
  }
  if (results.some(result => result.error)) throw new Error(`${results.filter(r => r.error).length} retailer notifications could not finish: ${results.filter(r => r.error).map(r => r.error).join('; ')}`);
  return { success:true,sent:results.filter(r => r.sent).length,duplicates_skipped:results.filter(r => r.duplicate).length,store_id:store.id };
}