import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { assertAdmin } from '../../shared/authGuard.ts';
import { PRIORITY_STORE_IDS, ACTIVE_DELIVERY_STATUSES } from '../../shared/priorityDeliveries.ts';
import { driverIsProductionQualified } from '../../shared/verifiedTaxDriverReadiness.ts';
import { attachDriverCompliance } from '../../shared/driverAnnualCompliance.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const access = await assertAdmin(base44);
    if (!access.authorized) return access.response;
    const payload = await req.json();
    const orderId = payload.order_id || payload.data?.id;
    if (!orderId) return Response.json({ error: 'order_id is required' }, { status: 400 });
    const action = payload.action || 'assignment';
    if (!['assignment', 'pickup_ready'].includes(action)) return Response.json({ error: 'Invalid notification action' }, { status: 400 });
    const order = await base44.entities.Order.get(orderId);
    if (!PRIORITY_STORE_IDS.includes(order.store_id) || order.order_number === 'SS-MS7OHVYB') return Response.json({ skipped: true, reason: 'Outside automated priority deliveries' });
    if (!order.driver_id || !ACTIVE_DELIVERY_STATUSES.includes(order.status) || order.stripe_payment_status !== 'paid' || order.id_verified_at_checkout !== true || order.is_in_legal_zone !== true) return Response.json({ skipped: true, reason: 'Awaiting paid, compliant driver assignment' });
    if (payload.expected_driver_id && payload.expected_driver_id !== order.driver_id) return Response.json({ skipped: true, reason: 'Assignment changed' });
    if (action === 'pickup_ready' && order.status !== 'pickup_ready') return Response.json({ skipped: true, reason: 'Not ready for pickup' });
    const [driver, store] = await Promise.all([base44.entities.Driver.get(order.driver_id), base44.entities.Store.get(order.store_id)]);
    const reviewedDriver = (await attachDriverCompliance(base44, [driver]))[0];
    if (!driver?.email || !driverIsProductionQualified({ ...reviewedDriver, status: 'available' }) || store.onboarding_status !== 'live' || !store.is_active) return Response.json({ skipped: true, reason: 'Driver or store is not live-delivery eligible' });
    const pickupReady = action === 'pickup_ready' || order.status === 'pickup_ready';
    const variables = {
      headline: pickupReady ? 'Your pickup is ready' : 'New delivery assigned',
      summary: pickupReady ? 'The retailer has marked your order ready for pickup.' : 'A retailer-accepted order has been assigned to you. Wait for pickup readiness.',
      order_number: order.order_number || order.id,
      driver_name: driver.name,
      store_name: store.name,
      pickup_address: [store.address, store.city, store.state, store.zip_code].filter(Boolean).join(', '),
      store_phone: store.phone || 'See store details in the app',
      instructions: pickupReady ? 'Open your assigned order, collect the sealed package, and confirm pickup in person.' : 'Open your assigned order for delivery details. Do not mark pickup complete until the retailer has prepared the order.',
      action_url: 'https://alcohol-delivered.biz/driver',
    };
    if (payload.dry_run === true) return Response.json({ dry_run: true, ready: true, action, email_sent: false });
    await base44.asServiceRole.integrations.Core.SendEmail({ to: driver.email, template_name: 'DriverDeliveryUpdate', variables });
    let retailerNotified = false;
    if (action === 'assignment' && store.email) {
      await base44.asServiceRole.integrations.Core.SendEmail({ to: store.email, template_name: 'DriverDeliveryUpdate', variables: { ...variables, headline: 'Delivery driver assigned', summary: `${driver.name} is assigned to your accepted order.`, instructions: 'Prepare and seal the order, then mark it ready for pickup in your Store Dashboard.', action_url: 'https://alcohol-delivered.biz/store/dashboard' } });
      retailerNotified = true;
    }
    // Preserve optional alerts for drivers who already registered a notification device.
    let pushAttempted = false;
    try {
      const devices = await base44.entities.FCMToken.filter({ user_email: driver.email }, '-created_date', 20);
      const tokens = [...new Set(devices.map(d => d.token).filter(Boolean))];
      if (tokens.length) {
        pushAttempted = true;
        await base44.functions.invoke('sendFCMPush', {
          tokens,
          title: variables.headline,
          body: `Order ${variables.order_number} at ${store.name}. Open Driver Portal.`,
          data: { order_id: order.id, order_number: variables.order_number, type: action === 'pickup_ready' ? 'pickup_ready' : 'driver_assignment' },
        });
      }
    } catch (error) {
      console.warn('Optional driver device alert failed after email:', error.message);
    }
    return Response.json({ success: true, action, driver_notified: true, retailer_notified: retailerNotified, push_attempted: pushAttempted });
  } catch (error) {
    console.error('Delivery notification failed:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}