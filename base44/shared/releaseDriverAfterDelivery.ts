export async function releaseDriverAfterDelivery(base44, driver) {
  if (driver.status !== 'on_delivery') return;
  const remaining = await base44.asServiceRole.entities.Order.filter({
    driver_id: driver.id,
    status: { $in: ['confirmed', 'preparing', 'pickup_ready', 'in_transit'] },
  }, '-created_date', 1);
  if (!remaining.length) await base44.asServiceRole.entities.Driver.update(driver.id, { status: 'available' });
}