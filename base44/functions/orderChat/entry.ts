import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

export default async function(req) {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !(await base44.auth.isAuthenticated())) return Response.json({ error: 'Sign in to chat.' }, { status: 401 });
    const { action = 'list', order_id, sender_role, channel, text } = await req.json();
    if (!['list','send'].includes(action) || typeof order_id !== 'string' || !order_id || order_id.length > 100 || !['driver','store','customer'].includes(sender_role) || !['customer_driver','store_driver'].includes(channel)) return Response.json({ error: 'Invalid chat selection.' }, { status: 400 });
    const order = await base44.asServiceRole.entities.Order.get(order_id);
    if (!order) return Response.json({ error: 'Order not found.' }, { status: 404 });
    const normalize = value => value?.trim().toLowerCase();
    const store = order.store_id ? await base44.entities.Store.get(order.store_id) : null;
    const storeContacts = [...new Set([store?.email, ...(store?.contact_emails || [])].filter(Boolean).flatMap(e => [e, normalize(e)]))];
    let driverEmail = order.driver_email;
    if (!driverEmail && order.driver_id) {
      const drivers = await base44.asServiceRole.entities.Driver.filter({ id: order.driver_id }, '-created_date', 1);
      driverEmail = drivers[0]?.email;
      if (!driverEmail) {
        try { driverEmail = (await base44.asServiceRole.entities.User.get(order.driver_id))?.email; } catch { /* Legacy assignment may refer to a removed user. */ }
      }
    }
    const email = normalize(user.email);
    const isDriver = Boolean(order.driver_id && order.driver_id === user.id || driverEmail && normalize(driverEmail) === email);
    const allowed = user.role === 'admin' || sender_role === 'driver' && isDriver || sender_role === 'customer' && normalize(order.customer_email) === email || sender_role === 'store' && storeContacts.includes(email);
    if (!allowed || sender_role === 'customer' && channel !== 'customer_driver' || sender_role === 'store' && channel !== 'store_driver') return Response.json({ error: 'You do not have access to this conversation.' }, { status: 403 });
    driverEmail ||= isDriver ? user.email : '';
    if (action === 'send') {
      if (!driverEmail) return Response.json({ error: 'A driver must be assigned before you can send a message.' }, { status: 409 });
      if (typeof text !== 'string' || !text.trim() || text.length > 2000) return Response.json({ error: 'Enter a message of up to 2,000 characters.' }, { status: 400 });
      const message = await base44.asServiceRole.entities.Message.create({ order_id, order_number: order.order_number, sender_role, sender_name: user.role === 'admin' && !isDriver ? 'Alcohol Delivered team' : user.full_name || (sender_role === 'customer' ? order.customer_name : sender_role === 'driver' ? order.driver_name : store?.name) || sender_role, sender_email: user.email, customer_email: channel === 'customer_driver' ? order.customer_email : '', driver_id: order.driver_id || '', driver_email: driverEmail, store_emails: channel === 'store_driver' ? storeContacts : [], channel, text: text.trim(), is_read: false });
      return Response.json({ message, viewer_email: user.email, can_send: true });
    }
    const messages = await base44.asServiceRole.entities.Message.filter({ order_id }, '-created_date', 100);
    const visible = messages.filter(m => (m.channel || (m.sender_role === 'customer' || m.customer_email ? 'customer_driver' : 'store_driver')) === channel).reverse();
    return Response.json({ messages: visible, viewer_email: user.email, can_send: Boolean(driverEmail), notice: driverEmail ? '' : 'Waiting for a driver to be assigned to this order.' });
  } catch (error) { console.error('Order chat:', error.message); return Response.json({ error: error.message }, { status: 500 }); }
}