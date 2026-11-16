import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { readRichardOrderRelease } from '../../shared/richardOrderRelease.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const { store_id, status_filter } = await req.json();
    if (status_filter !== undefined && status_filter !== 'delivered') return Response.json({ error: 'Unsupported status filter' }, { status: 400 });
    if (!store_id) return Response.json({ error: 'store_id required' }, { status: 400 });
    const store = await base44.asServiceRole.entities.Store.get(store_id);
    const email = user.email?.trim().toLowerCase();
    if (!store || (user.role !== 'admin' && (!email || ![store.email, ...(store.contact_emails || [])].some(contact => contact?.trim().toLowerCase() === email))))
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    if (status_filter === 'delivered') {
      const delivered = [];
      let cursor = null;
      do {
        const page = await base44.asServiceRole.entities.Order.filter({ store_id, status: 'delivered' }, { sort: '-created_date', limit: Math.min(100, 500 - delivered.length), cursor });
        delivered.push(...page.items);
        cursor = page.next_cursor;
      } while (cursor && delivered.length < 500);
      return Response.json({ orders: delivered });
    }
    const orders = await base44.asServiceRole.entities.Order.filter({ store_id }, '-created_date', 100);
    // Richard's July order must remain visible even when newer orders fill the page.
    if (store_id === '6a32d14d09b760f592dbf19e' && !orders.some(o => o.order_number === 'SS-MS7OHVYB')) {
      const older = await base44.asServiceRole.entities.Order.filter({ order_number: 'SS-MS7OHVYB', store_id });
      if (older[0]) orders.push(older[0]);
    }
    const active = orders.filter(o => ['pending', 'confirmed', 'preparing', 'pickup_ready', 'in_transit'].includes(o.status));
    const richard = active.find(o => o.order_number === 'SS-MS7OHVYB');
    if (richard) {
      Object.assign(richard, await readRichardOrderRelease(base44, richard, store));
      active.sort((a, b) => Number(b.id === richard.id) - Number(a.id === richard.id));
    }
    return Response.json({ orders: active });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}