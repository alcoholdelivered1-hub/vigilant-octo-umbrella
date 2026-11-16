import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { attachDriverCompliance } from '../../shared/driverAnnualCompliance.ts';
import { driverIsProductionQualified } from '../../shared/verifiedTaxDriverReadiness.ts';
import { verifyABCDeliveryArea } from '../../shared/abcDeliveryArea.ts';

export default async function(req) {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const base44 = createClientFromRequest(req);

    // Must be an authenticated driver
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { order_id } = await req.json();
    if (!order_id) {
      return Response.json({ error: 'order_id is required' }, { status: 400 });
    }

    // Fetch the order
    const order = await base44.asServiceRole.entities.Order.get(order_id);
    if (!order) {
      return Response.json({ error: 'Order not found' }, { status: 404 });
    }

    // Retailer-approved orders remain claimable while being prepared or awaiting pickup.
    if (!['confirmed', 'preparing', 'pickup_ready'].includes(order.status)) {
      return Response.json({
        success: false,
        reason: `Order is no longer available (status: ${order.status})`,
      });
    }

    if (order.driver_id) {
      return Response.json({
        success: false,
        reason: 'This order was already claimed by another driver',
        claimed_by: order.driver_name,
      });
    }

    // Look up the driver record for this user
    const drivers = await base44.asServiceRole.entities.Driver.filter({ email: user.email });
    const driver = (await attachDriverCompliance(base44, drivers))[0];

    if (!driver) {
      return Response.json({
        success: false,
        reason: 'No driver profile found for your account. Please complete driver registration.',
      });
    }

    if (!driver.is_active || driver.status === 'suspended') {
      return Response.json({
        success: false,
        reason: 'Your driver account is not currently active.',
      });
    }
    if (!driverIsProductionQualified(driver)) {
      return Response.json({
        success: false,
        reason: 'Go online with administrator-reviewed current annual ABC training, a completed Server Awareness form, a valid license and a real cleared background check before accepting a delivery.',
      });
    }
    if (order.stripe_payment_status !== 'paid' || order.id_verified_at_checkout !== true || order.is_in_legal_zone !== true) {
      return Response.json({
        success: false,
        reason: 'This order is on payment or compliance hold and cannot be claimed.',
      });
    }

    const store = await base44.asServiceRole.entities.Store.get(order.store_id);
    try { await verifyABCDeliveryArea(store, order.delivery_latitude, order.delivery_longitude); }
    catch (error) { return Response.json({ success: false, reason: error.message }); }

    // Assign the authenticated Driver record while preserving the retailer-confirmed status.
    await base44.asServiceRole.entities.Order.update(order_id, {
      driver_id: driver.id,
      driver_email: user.email,
      driver_name: driver.name,
    });

    // Update driver status
    await base44.asServiceRole.entities.Driver.update(driver.id, {
      status: 'on_delivery',
    });

    console.log(`[claimOrder] Driver ${driver.name} (${user.email}) claimed order ${order.order_number}`);

    return Response.json({
      success: true,
      message: `Order ${order.order_number} claimed! Head to ${order.store_name} for pickup.`,
      order_number: order.order_number,
      store_name: order.store_name,
      delivery_address: order.delivery_address,
      total: order.total,
      tip: order.tip || 0,
    });
  } catch (error) {
    console.error('[claimOrder] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}