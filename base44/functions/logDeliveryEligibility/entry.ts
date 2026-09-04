import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const {
      order_or_session_id,
      customer_email,
      customer_latitude,
      customer_longitude,
      matched_municipality,
      matched_county,
      service_zone_result,
      wet_jurisdiction_result,
      retailer_eligibility_result,
      boundary_dataset_version,
      final_result,
      rejection_reason,
    } = body;

    if (!order_or_session_id || !final_result) {
      return Response.json(
        { error: 'order_or_session_id and final_result are required' },
        { status: 400 }
      );
    }

    const log = await base44.asServiceRole.entities.DeliveryEligibilityLog.create({
      order_or_session_id,
      customer_email: customer_email || '',
      customer_latitude: customer_latitude || null,
      customer_longitude: customer_longitude || null,
      matched_municipality: matched_municipality || '',
      matched_county: matched_county || '',
      service_zone_result: service_zone_result || '',
      wet_jurisdiction_result: wet_jurisdiction_result || '',
      retailer_eligibility_result: retailer_eligibility_result || '',
      boundary_dataset_version: boundary_dataset_version || 'AR-GIS-MUNI-2026-07-15',
      verification_timestamp: new Date().toISOString(),
      final_result,
      rejection_reason: rejection_reason || '',
    });

    console.log(`Eligibility check logged: ${order_or_session_id} → ${final_result}`);
    return Response.json({ success: true, log_id: log.id });
  } catch (error) {
    console.error('Failed to log delivery eligibility:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});