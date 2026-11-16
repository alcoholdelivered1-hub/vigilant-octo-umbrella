import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { readRichardOrderRelease } from '../../shared/richardOrderRelease.ts';

const ALLOWED_TRANSITIONS = {
  pending: ['confirmed'],
  confirmed: ['pickup_ready'],
  preparing: ['pickup_ready'],
};

export default async function(req) {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { order_id, status } = await req.json();
    if (!order_id || !status) return Response.json({ error: 'order_id and status are required' }, { status: 400 });

    const order = await base44.asServiceRole.entities.Order.get(order_id);
    if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });

    const store = await base44.asServiceRole.entities.Store.get(order.store_id);
    const isAdmin = user.role === 'admin';
    const email = user.email?.trim().toLowerCase();
    const isStoreOwner = Boolean(email && [store?.email, ...(store?.contact_emails || [])].some(contact => contact?.trim().toLowerCase() === email));
    if (!isAdmin && !isStoreOwner) return Response.json({ error: 'Forbidden' }, { status: 403 });

    if (order.stripe_payment_status !== 'paid') {
      return Response.json({ error: 'Order cannot advance until payment is confirmed.' }, { status: 409 });
    }
    if (order.id_verified_at_checkout !== true || order.is_in_legal_zone !== true) {
      return Response.json({ error: 'Order is on compliance hold and cannot advance.' }, { status: 409 });
    }

    // The legacy live payment and saved cart for Richard require a separate reconciliation.
    // Store setup alone cannot release an old charge or authorize a changed total.
    if (order.order_number === 'SS-MS7OHVYB') {
      const release = await readRichardOrderRelease(base44, order, store);
      if (!release.release_ready) return Response.json({ error: release.release_blockers.join(' '), blockers: release.release_blockers }, { status: 409 });
      if (status === 'pickup_ready' && (order.driver_name !== 'Justin Bess' || !order.driver_email)) {
        return Response.json({ error: 'Justin Bess must be assigned before this order is marked ready.' }, { status: 409 });
      }
    }

    const allowed = ALLOWED_TRANSITIONS[order.status] || [];
    if (!allowed.includes(status)) {
      return Response.json({ error: `Invalid retailer transition: ${order.status} → ${status}` }, { status: 409 });
    }

    await base44.asServiceRole.entities.Order.update(order.id, { status });

    let driver_alert = null;
    if (status === 'pickup_ready' && order.order_number === 'SS-MS7OHVYB') {
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: order.driver_email,
          subject: `Pickup ready: ${order.order_number} at Beverage King`,
          body: `Justin, Beverage King marked Richard's order ${order.order_number} ready for pickup. Open the Driver Portal to confirm pickup. Check the sealed order and verify government ID at delivery.`,
        });
        driver_alert = 'email_sent';
        const tokens = await base44.asServiceRole.entities.FCMToken.filter({ user_email: order.driver_email });
        if (tokens.length) {
          await base44.asServiceRole.functions.invoke('sendFCMPush', {
            tokens: [...new Set(tokens.map(t => t.token).filter(Boolean))],
            title: 'Beverage King pickup ready',
            body: `Richard's order ${order.order_number} is ready. Open Driver Portal.`,
            data: { order_id: order.id, order_number: order.order_number, type: 'pickup_ready' },
          });
          driver_alert = 'email_and_push_attempted';
        }
      } catch (alertError) {
        console.error('Pickup ready alert failed:', alertError.message);
        driver_alert = 'failed: ' + alertError.message;
      }
    }

    return Response.json({
      driver_alert,
      success: true,
      order_id: order.id,
      order_number: order.order_number,
      previous_status: order.status,
      status,
    });
  } catch (error) {
    console.error('[updateRetailerOrderStatus] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}