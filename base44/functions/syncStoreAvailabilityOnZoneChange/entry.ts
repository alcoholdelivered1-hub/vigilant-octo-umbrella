import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Triggered by an entity automation when a DeliveryZone is updated or deleted.
 * Finds all stores in the affected county and sets is_active based on whether
 * the zone is still active AND is a wet (legal) zone.
 */
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const body = await req.json();
  const { event, data, old_data } = body;

  console.log(`[syncStoreAvailability] event=${event?.type}, zone=${data?.name || old_data?.name}`);

  // Determine the affected zone data
  const zone = data || old_data;
  if (!zone?.county) {
    console.warn('[syncStoreAvailability] No county found in zone payload, skipping.');
    return Response.json({ skipped: true, reason: 'no county' });
  }

  // A zone is "available" when it is active AND allows alcohol (is_wet)
  const zoneAvailable = event?.type === 'delete'
    ? false
    : (zone.is_active === true && zone.is_wet === true);

  console.log(`[syncStoreAvailability] county="${zone.county}", zoneAvailable=${zoneAvailable}`);

  // Find all stores in this county
  const stores = await base44.asServiceRole.entities.Store.filter({ county: zone.county });
  console.log(`[syncStoreAvailability] Found ${stores.length} store(s) in county "${zone.county}"`);

  let updated = 0;
  for (const store of stores) {
    if (store.is_active !== zoneAvailable) {
      await base44.asServiceRole.entities.Store.update(store.id, { is_active: zoneAvailable });
      console.log(`[syncStoreAvailability] Updated store "${store.name}" is_active=${zoneAvailable}`);
      updated++;
    }
  }

  return Response.json({
    success: true,
    county: zone.county,
    zone_available: zoneAvailable,
    stores_found: stores.length,
    stores_updated: updated,
  });
});