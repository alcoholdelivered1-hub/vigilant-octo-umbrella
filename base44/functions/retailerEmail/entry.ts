import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import MailComposer from 'npm:nodemailer@6.9.16/lib/mail-composer/index.js';
import { BUSINESS_EMAIL, contactsFor, gmailConnection, belongsToStore, header, addresses, readableMessage } from '../../shared/retailerGmail.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin' || !(await base44.auth.isAuthenticated())) return Response.json({ error: 'Admin access required.' }, { status: 403 });
    const { action = 'list', store_id, thread_id, page_token, recipient, subject, text } = await req.json();
    if (!['list', 'thread', 'send'].includes(action) || typeof store_id !== 'string' || store_id.length > 100) return Response.json({ error: 'Invalid request.' }, { status: 400 });
    if (thread_id && (typeof thread_id !== 'string' || !/^[a-z0-9]{1,100}$/i.test(thread_id))) return Response.json({ error: 'Invalid conversation.' }, { status: 400 });
    const stores = await base44.entities.Store.filter({ id: store_id }, 'name', 1);
    if (!stores[0]) return Response.json({ error: 'Retailer not found.' }, { status: 404 });
    const contacts = contactsFor(stores[0]);
    if (!contacts.length) return Response.json(action === 'list' ? { threads: [], contacts, notice: 'Save a retailer email on this store to start a conversation.' } : { error: 'This store needs a retailer contact email.' }, { status: action === 'list' ? 200 : 400 });
    if (action === 'send' && (typeof text !== 'string' || !text.trim() || text.length > 10000 || (!thread_id && (typeof subject !== 'string' || !subject.trim() || subject.length > 200 || /[\r\n]/.test(subject))) || (!thread_id && !contacts.includes(recipient)))) return Response.json({ error: 'Enter a subject, message, and saved retailer recipient.' }, { status: 400 });
    const api = await gmailConnection(base44);
    if (action === 'list') {
      if (page_token && (typeof page_token !== 'string' || page_token.length > 1000)) return Response.json({ error: 'Invalid page.' }, { status: 400 });
      const params = new URLSearchParams({ q: `-in:drafts {${contacts.flatMap(email => [`from:${email}`, `to:${email}`]).join(' ')}}`, maxResults: '20' });
      if (page_token) params.set('pageToken', page_token);
      const page = await api(`threads?${params}`);
      const threads = await Promise.all((page.threads || []).map(async item => {
        const thread = await api(`threads/${item.id}?format=metadata&metadataHeaders=Subject`);
        return { id: item.id, subject: header(thread.messages?.at(-1) || {}, 'Subject'), snippet: item.snippet || thread.messages?.at(-1)?.snippet || '' };
      }));
      return Response.json({ threads, contacts, next_page_token: page.nextPageToken || '' });
    }
    let thread;
    if (thread_id) {
      thread = await api(`threads/${thread_id}?format=full`);
      if (!belongsToStore(thread, contacts)) return Response.json({ error: 'This conversation does not belong to this retailer.' }, { status: 403 });
    }
    if (action === 'thread') {
      if (!thread) return Response.json({ error: 'Choose a conversation.' }, { status: 400 });
      return Response.json({ messages: (thread.messages || []).slice(-50).map(readableMessage) });
    }
    const last = thread?.messages?.at(-1);
    const incoming = [...(thread?.messages || [])].reverse().find(message => addresses(header(message, 'From')).some(email => contacts.includes(email)));
    const to = thread ? addresses(header(incoming || last, incoming ? 'From' : 'To')).find(email => contacts.includes(email)) || contacts[0] : recipient;
    const originalSubject = last ? header(last, 'Subject') : '';
    const message = await new MailComposer({ from: `Alcohol Delivered <${BUSINESS_EMAIL}>`, to, subject: last ? (/^re:/i.test(originalSubject) ? originalSubject : `Re: ${originalSubject}`) : subject.trim(), text: text.trim(), ...(last ? { inReplyTo: header(last, 'Message-ID') || undefined, references: [header(last, 'References'), header(last, 'Message-ID')].filter(Boolean).join(' ') || undefined } : {}) }).compile().build();
    const raw = btoa(String.fromCharCode(...message)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const sent = await api('messages/send', { method: 'POST', body: JSON.stringify({ raw, ...(thread_id ? { threadId: thread_id } : {}) }) });
    return Response.json({ success: true, thread_id: sent.threadId, message_id: sent.id });
  } catch (error) { console.error('Retailer Gmail:', error.message); return Response.json({ error: error.message }, { status: 500 }); }
}