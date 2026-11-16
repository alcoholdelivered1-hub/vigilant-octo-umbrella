import { driverIsProductionQualified, readAllMatching } from './verifiedTaxDriverReadiness.ts';
import { verifyABCDeliveryArea } from './abcDeliveryArea.ts';
import { attachDriverCompliance } from './driverAnnualCompliance.ts';

export const PRIORITY_STORE_IDS = ['6a32d14d09b760f592dbf19e', '6abbd1a16dc8d922f3b73caf'];
export const DISPATCH_STATUSES = ['confirmed', 'preparing', 'pickup_ready'];
export const ACTIVE_DELIVERY_STATUSES = [...DISPATCH_STATUSES, 'in_transit'];
const unassigned = { $or: [{ driver_id: { $exists: false } }, { driver_id: null }, { driver_id: '' }] };
export const priorityQueueQuery = { store_id: { $in: PRIORITY_STORE_IDS }, status: { $in: DISPATCH_STATUSES }, stripe_payment_status: 'paid', ...unassigned };

function distance(driver, store) {
  const radians = v => v * Math.PI / 180;
  const a = Math.sin(radians(store.latitude - driver.current_latitude) / 2) ** 2 + Math.cos(radians(driver.current_latitude)) * Math.cos(radians(store.latitude)) * Math.sin(radians(store.longitude - driver.current_longitude) / 2) ** 2;
  return 3959 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function dispatchPriorityOrder(base44, order, dryRun = false) {
  const skip = reason => ({ skipped: true, reason });
  if (!PRIORITY_STORE_IDS.includes(order.store_id)) return skip('Not a priority store');
  if (order.driver_id || !DISPATCH_STATUSES.includes(order.status)) return skip('Already assigned or not retailer-accepted');
  if (order.order_number === 'SS-MS7OHVYB') return skip('Legacy order requires its separate payment reconciliation and approved handoff');
  if (order.stripe_payment_status !== 'paid' || order.id_verified_at_checkout !== true || order.is_in_legal_zone !== true) return skip('Payment, checkout ID and legal delivery zone must pass');
  const store = await base44.entities.Store.get(order.store_id);
  if (!store?.is_active || store.onboarding_status !== 'live' || store.stripe_connection_status !== 'connected' || store.compliance_status !== 'compliant' || store.license_status !== 'active' || !store.license_expiration_date || store.license_expiration_date < new Date().toISOString().slice(0, 10)) return skip('Store has not passed launch, payment and license checks');
  if (![store.latitude, store.longitude].every(Number.isFinite)) return skip('Verified pickup coordinates are missing');
  try { await verifyABCDeliveryArea(store, order.delivery_latitude, order.delivery_longitude); }
  catch (error) { return skip(error.message); }
  const [drivers, coverage, activeOrders] = await Promise.all([
    readAllMatching(base44.entities.Driver, { is_active: true, status: 'available', training_completed: true, background_check_status: 'clear' }),
    readAllMatching(base44.entities.DriverStoreCoverage, { store_id: store.id }),
    readAllMatching(base44.entities.Order, { status: { $in: ACTIVE_DELIVERY_STATUSES }, driver_id: { $exists: true } }),
  ]);
  const reviewedDrivers = await attachDriverCompliance(base44, drivers);
  const eligible = reviewedDrivers.filter(d => driverIsProductionQualified(d) && d.email && [d.current_latitude, d.current_longitude].every(Number.isFinite) && !activeOrders.some(o => o.driver_id === d.id) && (coverage.some(c => c.driver_id === d.id) || (d.service_city && d.service_city.trim().toLowerCase() === store.city?.trim().toLowerCase()))).sort((a, b) => distance(a, store) - distance(b, store));
  if (!eligible.length) return skip('No available, cleared driver with store coverage and pickup-location data; order remains queued');
  if (dryRun) return { dry_run: true, eligible: true, driver_id: eligible[0].id, distance_miles: distance(eligible[0], store) };
  for (const driver of eligible) {
    const reserved = await base44.entities.Driver.updateMany({ id: driver.id, status: 'available', is_active: true, training_completed: true, background_check_status: 'clear', background_check_id: driver.background_check_id }, { $set: { status: 'on_delivery' } });
    if (reserved.updated !== 1) continue;
    try {
      const assigned = await base44.entities.Order.updateMany({ id: order.id, status: order.status, stripe_payment_status: 'paid', id_verified_at_checkout: true, is_in_legal_zone: true, ...unassigned }, { $set: { driver_id: driver.id, driver_email: driver.email } });
      if (assigned.updated !== 1) {
        await base44.entities.Driver.updateMany({ id: driver.id, status: 'on_delivery' }, { $set: { status: 'available' } });
        return skip('Order changed before assignment');
      }
      // Single-record update emits the assignment event; bulk reservation intentionally does not.
      await base44.entities.Order.update(order.id, { driver_name: driver.name });
      return { success: true, fulfillment: 'internal', order_id: order.id, assigned_driver: driver.name };
    } catch (error) {
      const current = await base44.entities.Order.get(order.id);
      if (current.driver_id !== driver.id) await base44.entities.Driver.updateMany({ id: driver.id, status: 'on_delivery' }, { $set: { status: 'available' } });
      throw error;
    }
  }
  return skip('Eligible drivers were assigned elsewhere; order remains queued');
}