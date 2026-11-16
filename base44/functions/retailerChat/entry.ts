import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

export default async function(req) {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed.' }, { status: 405 });
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !(await base44.auth.isAuthenticated())) return Response.json({ error: 'Sign in to chat.' }, { status: 401 });
    const { action = 'list', store_id, text } = await req.json();
    if (!['list', 'send'].includes(action) || typeof store_id !== 'string' || !store_id || store_id.length > 100) return Response.json({ error: 'Select a valid retailer.' }, { status: 400 });
    const stores = await base44.entities.Store.filter({ id: store_id }, 'name', 1);
    const store = stores[0];
    if (!store) return Response.json({ error: 'Retailer not found.' }, { status: 404 });
    const normalize = email => email.trim().toLowerCase();
    const contacts = [...new Set([store.email, ...(store.contact_emails || [])].filter(email => typeof email === 'string' && email.trim()).flatMap(email => [email.trim(), normalize(email)]))];
    const admin = user.role === 'admin';
    if (!admin && !contacts.includes(normalize(user.email))) return Response.json({ error: 'This retailer is not linked to your account.' }, { status: 403 });
    const common = { viewer_email: user.email, sender_role: admin ? 'admin' : 'retailer', can_send: contacts.length > 0, notice: contacts.length ? '' : 'Add a retailer email to this store so they can access and reply to messages.' };
    if (action === 'send') {
      if (!contacts.length) return Response.json({ error: common.notice }, { status: 409 });
      if (typeof text !== 'string' || !text.trim() || text.length > 2000) return Response.json({ error: 'Enter a message of up to 2,000 characters.' }, { status: 400 });
      const message = await base44.asServiceRole.entities.RetailerMessage.create({ store_id, store_emails: contacts, sender_email: user.email, sender_name: user.full_name || (admin ? 'Alcohol Delivered team' : store.name), sender_role: common.sender_role, text: text.trim() });
      return Response.json({ ...common, message });
    }
    const messages = await base44.asServiceRole.entities.RetailerMessage.filter({ store_id }, '-created_date', 100);
    return Response.json({ ...common, messages: messages.reverse() });
  } catch (error) { console.error('Retailer chat:', error.message); return Response.json({ error: error.message }, { status: 500 }); }
}