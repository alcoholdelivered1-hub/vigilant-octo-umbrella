/**
 * Checks whether a newly-created Order's delivery address falls inside an
 * active DeliveryZone. Logs the outcome to DeliveryEligibilityLog and returns
 * the eligibility result so the calling workflow can branch.
 *
 * POST body: { order_id: string }
 * Returns: { eligible: boolean, rejection_reason?: string, zone_name?: string, lat, lon }
 *
 * Geocoding: uses the order's delivery_latitude/longitude when present;
 * otherwise geocodes delivery_address via OpenStreetMap Nominatim (free, no key).
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import { haversineDistance, geocodeAddress } from '../../shared/geoUtils.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const orderId = body.order_id || body.event?.entity_id || body.data?.id;

    if (!orderId) {
      return Response.json({ error: 'order_id is required' }, { status: 400 });
    }

    const order = await base44.asServiceRole.entities.Order.get(orderId);
    if (!order) {
      return Response.json({ error: 'Order not found' }, { status: 404 });
    }

    // Resolve delivery coordinates
    let lat = order.delivery_latitude;
    let lon = order.delivery_longitude;
    if ((!lat || !lon) && order.delivery_address) {
      const geo = await geocodeAddress(order.delivery_address);
      if (geo) {
        lat = geo.lat;
        lon = geo.lon;
      }
    }

    if (!lat || !lon) {
      // Cannot geocode — log as rejected so the workflow doesn't dispatch blind
      await base44.asServiceRole.entities.DeliveryEligibilityLog.create({
        order_or_session_id: order.order_number || orderId,
        customer_email: order.customer_email || '',
        matched_municipality: '',
        matched_county: '',
        service_zone_result: 'unresolved — no coordinates',
        wet_jurisdiction_result: 'unverified',
        retailer_eligibility_result: '',
        verification_timestamp: new Date().toISOString(),
        final_result: 'rejected',
        rejection_reason: 'Unable to geocode delivery address or no coordinates on order',
      });
      return Response.json({
        eligible: false,
        rejection_reason: 'Unable to geocode delivery address',
        lat: null,
        lon: null,
      });
    }

    // Check against active zones
    const zones = await base44.asServiceRole.entities.DeliveryZone.filter({
      is_active: true,
      zone_status: 'active',
    });

    const matched = zones
      .filter((z) => z.center_latitude && z.center_longitude)
      .map((z) => {
        const dist = haversineDistance(lat, lon, z.center_latitude, z.center_longitude);
        return { zone: z, distance: dist, inZone: dist <= (z.radius_miles || 10) };
      })
      .filter((z) => z.inZone)
      .sort((a, b) => a.distance - b.distance)[0];

    if (matched) {
      await base44.asServiceRole.entities.DeliveryEligibilityLog.create({
        order_or_session_id: order.order_number || orderId,
        customer_email: order.customer_email || '',
        customer_latitude: lat,
        customer_longitude: lon,
        matched_municipality: matched.zone.name,
        matched_county: matched.zone.county || '',
        service_zone_result: `pass — zone "${matched.zone.name}" (${matched.distance.toFixed(1)} mi from center)`,
        wet_jurisdiction_result: matched.zone.is_wet ? 'pass — wet jurisdiction' : 'fail — dry jurisdiction',
        retailer_eligibility_result: '',
        boundary_dataset_version: matched.zone.boundary_version || 'AR-GIS-MUNI-2026-07-15',
        verification_timestamp: new Date().toISOString(),
        final_result: 'approved',
        rejection_reason: '',
      });
      return Response.json({
        eligible: true,
        zone_name: matched.zone.name,
        distance_miles: parseFloat(matched.distance.toFixed(2)),
        lat,
        lon,
      });
    }

    // No matching zone
    const closest = zones
      .filter((z) => z.center_latitude && z.center_longitude)
      .map((z) => ({
        name: z.name,
        distance: haversineDistance(lat, lon, z.center_latitude, z.center_longitude),
      }))
      .sort((a, b) => a.distance - b.distance)[0];

    const rejectionReason = closest
      ? `Delivery address is outside all active service zones (nearest: "${closest.name}" at ${closest.distance.toFixed(1)} mi)`
      : 'No active delivery zones configured';

    await base44.asServiceRole.entities.DeliveryEligibilityLog.create({
      order_or_session_id: order.order_number || orderId,
      customer_email: order.customer_email || '',
      customer_latitude: lat,
      customer_longitude: lon,
      matched_municipality: '',
      matched_county: '',
      service_zone_result: 'fail — outside all active zones',
      wet_jurisdiction_result: 'unverified',
      retailer_eligibility_result: '',
      verification_timestamp: new Date().toISOString(),
      final_result: 'rejected',
      rejection_reason: rejectionReason,
    });

    return Response.json({
      eligible: false,
      rejection_reason: rejectionReason,
      lat,
      lon,
    });
  } catch (error) {
    console.error('checkOrderDeliveryZone error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});