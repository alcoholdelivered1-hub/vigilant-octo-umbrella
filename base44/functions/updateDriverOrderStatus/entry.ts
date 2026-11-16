import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { attachDriverCompliance } from '../../shared/driverAnnualCompliance.ts';
import { driverHasProductionCredentials } from '../../shared/verifiedTaxDriverReadiness.ts';
import { releaseDriverAfterDelivery } from '../../shared/releaseDriverAfterDelivery.ts';
import { verifyABCDeliveryArea } from '../../shared/abcDeliveryArea.ts';

export default async function(req) {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { order_id, action, refusal_reason, verification, handoff_confirmed } = await req.json();
    if (typeof order_id !== 'string' || !order_id || order_id.length > 100 || !['pickup', 'refuse', 'deliver'].includes(action)) return Response.json({ error: 'A valid order and driver action are required.' }, { status: 400 });
    const order = await base44.asServiceRole.entities.Order.get(order_id);
    if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });

    const drivers = await base44.asServiceRole.entities.Driver.filter({ email: user.email });
    const driver = (await attachDriverCompliance(base44, drivers))[0];
    if (!driver || order.driver_id !== driver.id || order.driver_email?.toLowerCase() !== user.email?.toLowerCase()) {
      return Response.json({ error: 'This order is not assigned to your driver account.' }, { status: 403 });
    }
    if (action !== 'refuse' && !driverHasProductionCredentials(driver)) {
      return Response.json({ error: 'Administrator-reviewed current annual ABC training, Server Awareness form, valid license and real background clearance are required.' }, { status: 403 });
    }
    if (action !== 'refuse' && (order.stripe_payment_status !== 'paid' || order.id_verified_at_checkout !== true || order.is_in_legal_zone !== true)) return Response.json({ error: 'This order is on payment or compliance hold.' }, { status: 403 });
    if ((action === 'deliver' && order.status === 'delivered') || (action === 'refuse' && order.status === 'refused')) {
      await releaseDriverAfterDelivery(base44, driver);
      return Response.json({ success: true, status: order.status });
    }

    if (action === 'pickup') {
      if (order.status !== 'pickup_ready') return Response.json({ error: 'Order is not ready for pickup.' }, { status: 409 });
      const store = await base44.asServiceRole.entities.Store.get(order.store_id);
      try { await verifyABCDeliveryArea(store, order.delivery_latitude, order.delivery_longitude); }
      catch (error) { return Response.json({ error: error.message }, { status: 403 }); }
      await base44.asServiceRole.entities.Order.update(order.id, { status: 'in_transit', pickup_confirmed_at: new Date().toISOString() });
      return Response.json({ success: true, status: 'in_transit' });
    }

    if (action === 'refuse') {
      if (order.status !== 'in_transit' || !refusal_reason?.trim()) return Response.json({ error: 'A refusal reason is required for an in-transit order.' }, { status: 400 });
      await base44.asServiceRole.entities.Order.update(order.id, { status: 'refused', refusal_reason: refusal_reason.trim() });
      await releaseDriverAfterDelivery(base44, driver);
      return Response.json({ success: true, status: 'refused' });
    }

    if (action === 'deliver') {
      if (order.status !== 'in_transit') return Response.json({ error: 'Order is not in transit.' }, { status: 409 });
      if (!handoff_confirmed || verification?.manual_override || !verification?.verified_at_delivery || !verification?.id_image_file_uri) {
        return Response.json({ error: 'A passing ID scan and in-person handoff confirmation are required.' }, { status: 403 });
      }
      const scans = await base44.asServiceRole.entities.IDVerification.filter({ order_id: order.id, verification_type: 'delivery', is_verified: true });
      const matchingScan = scans.find(scan => scan.verified_by?.toLowerCase() === user.email?.toLowerCase() && scan.id_image_file_uri === verification.id_image_file_uri && Date.now() - new Date(scan.created_date).getTime() < 15 * 60 * 1000);
      if (!matchingScan) return Response.json({ error: 'A recent passing delivery ID scan is required.' }, { status: 403 });
      await base44.asServiceRole.entities.Order.update(order.id, {
        status: 'delivered',
        id_verified_at_delivery: true,
        delivery_confirmed_at: new Date().toISOString(),
      });
      await releaseDriverAfterDelivery(base44, driver);
      return Response.json({ success: true, status: 'delivered' });
    }

    return Response.json({ error: 'Unknown driver action.' }, { status: 400 });
  } catch (error) {
    console.error('[updateDriverOrderStatus] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}