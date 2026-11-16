import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import {
  checkDriverEligibility,
  checkAddressType,
  checkRestrictedLocation,
  checkOrderDataCollection,
  checkDeliveryDataCollection,
  logComplianceIncident,
} from '../../shared/complianceRules.ts';
import { geocodeDeliveryAddress, verifyABCDeliveryArea } from '../../shared/abcDeliveryArea.ts';

const INCIDENT_TYPE_FOR_RULE = {
  '3.25': 'incomplete_order_data',
  '3.26': 'incomplete_delivery_data',
  '3.28': 'address_type_refused',
  'wet_dry': 'wet_area_refused',
  'restricted_location': 'restricted_location_refused',
  'driver_age': 'driver_blocked',
  'driver_felony': 'driver_blocked',
  'driver_license': 'driver_blocked',
  'driver_background': 'driver_blocked',
};

// ---------------------------------------------------------------------------
// Stage: driver_assignment — check driver age, license, felony
// ---------------------------------------------------------------------------
async function checkDriverStage(base44, body, user) {
  const { driver_id, order_id } = body;
  if (!driver_id) return Response.json({ error: 'driver_id is required' }, { status: 400 });

  const drivers = await base44.asServiceRole.entities.Driver.filter({ id: driver_id });
  const driver = drivers[0];
  if (!driver) return Response.json({ error: 'Driver not found' }, { status: 404 });

  const callerEmail = user?.email?.trim().toLowerCase();
  if (user?.role !== 'admin' && (!callerEmail || driver.email?.trim().toLowerCase() !== callerEmail)) {
    return Response.json({ error: 'You can only run driver-assignment checks for your own driver record.' }, { status: 403 });
  }

  const complianceRecords = await base44.asServiceRole.entities.DriverCompliance.filter({ driver_id });
  const compliance = complianceRecords[0] || null;

  const result = checkDriverEligibility(driver, compliance);

  if (!result.eligible) {
    for (const block of result.blocks) {
      await logComplianceIncident(base44, {
        incident_type: INCIDENT_TYPE_FOR_RULE[block.rule] || 'driver_blocked',
        compliance_rule: block.rule,
        order_id: order_id || '',
        driver_id,
        driver_name: driver.name,
        driver_email: driver.email,
        reason: block.reason,
        description: `Driver eligibility check failed at assignment`,
      });
    }
  }

  return Response.json({ stage: 'driver_assignment', approved: result.eligible, blocks: result.blocks });
}

// ---------------------------------------------------------------------------
// Stage: order — check address type, wet/dry area, order data (Rules 3.25, 3.28)
// ---------------------------------------------------------------------------
async function checkOrderStage(base44, body) {
  const { store_id, delivery_address, delivery_latitude, delivery_longitude, customer_dob } = body;
  if (!store_id) return Response.json({ error: 'store_id is required' }, { status: 400 });

  const store = await base44.entities.Store.get(store_id);
  if (!store?.is_active || store.onboarding_status !== 'live') {
    return Response.json({
      stage: 'order',
      approved: false,
      blocks: [{ rule: 'store_inactive', reason: 'This retailer is not accepting delivery orders.' }],
    });
  }

  let lat = Number(delivery_latitude) || null;
  let lon = Number(delivery_longitude) || null;
  if ((!lat || !lon) && delivery_address) {
    try {
      const coords = await geocodeDeliveryAddress(delivery_address);
      lat = coords.latitude;
      lon = coords.longitude;
    } catch (e) {
      return Response.json({
        stage: 'order',
        approved: false,
        blocks: [{ rule: 'geocode', reason: e.message }],
      });
    }
  }
  if (!lat || !lon) return Response.json({ error: 'Delivery coordinates or address required' }, { status: 400 });

  const blocks = [];

  // Rule 3.28: Private residence only
  try {
    const addrType = await checkAddressType(lat, lon);
    if (!addrType.is_private_residence) {
      blocks.push({
        rule: '3.28',
        reason: `Delivery to non-residential address (${addrType.category}/${addrType.type}) is not permitted under Rule 3.28`,
      });
    }
  } catch (e) {
    blocks.push({ rule: '3.28', reason: 'Address type could not be verified — refusing for safety' });
  }

  // Wet/dry area check (ABC map)
  try {
    await verifyABCDeliveryArea(store, lat, lon);
  } catch (e) {
    blocks.push({ rule: 'wet_dry', reason: e.message });
  }

  // Rule 3.25: Order data collection
  const orderData = checkOrderDataCollection(body, customer_dob);
  if (!orderData.complete) {
    blocks.push({ rule: '3.25', reason: `Missing required order data: ${orderData.missing.join(', ')}` });
  }

  if (blocks.length > 0) {
    for (const block of blocks) {
      await logComplianceIncident(base44, {
        incident_type: INCIDENT_TYPE_FOR_RULE[block.rule] || 'other_refusal',
        compliance_rule: block.rule,
        store_id: store.id,
        store_name: store.name,
        reason: block.reason,
        delivery_address: delivery_address || '',
        description: `Compliance check failed at order stage`,
      });
    }
  }

  return Response.json({ stage: 'order', approved: blocks.length === 0, blocks, latitude: lat, longitude: lon });
}

// ---------------------------------------------------------------------------
// Stage: delivery — check restricted location, delivery data (Rule 3.26)
// ---------------------------------------------------------------------------
async function checkDeliveryStage(base44, body, user) {
  const { order_id, intoxicated } = body;
  if (!order_id) return Response.json({ error: 'order_id is required' }, { status: 400 });

  const orders = await base44.asServiceRole.entities.Order.filter({ id: order_id });
  const order = orders[0];
  if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });

  const callerEmail = user?.email?.trim().toLowerCase();
  const isParticipant = Boolean(callerEmail) && [order.driver_email, order.customer_email]
    .some(email => email?.trim().toLowerCase() === callerEmail);
  if (user?.role !== 'admin' && !isParticipant) {
    return Response.json({ error: 'You can only run delivery checks for your own order.' }, { status: 403 });
  }

  const idVerifications = await base44.asServiceRole.entities.IDVerification.filter({ order_id });
  const idVerification = idVerifications.find(v => v.verification_type === 'delivery') || idVerifications[0] || null;

  const blocks = [];

  // Restricted location check (school, playground, church, library)
  if (order.delivery_latitude && order.delivery_longitude) {
    try {
      const restricted = await checkRestrictedLocation(order.delivery_latitude, order.delivery_longitude);
      if (restricted.is_restricted) {
        blocks.push({
          rule: 'restricted_location',
          reason: `Delivery to restricted location: ${restricted.matches.map(m => m.name || m.type).join(', ')}. Return order to store.`,
        });
      }
    } catch (e) {
      blocks.push({ rule: 'restricted_location', reason: 'Restricted location check failed — refusing for safety' });
    }
  }

  // Rule 3.26: Delivery data collection
  const deliveryData = checkDeliveryDataCollection(order, idVerification, intoxicated);
  if (!deliveryData.complete) {
    const parts = [...deliveryData.missing];
    if (deliveryData.intoxicated) parts.push('recipient appears intoxicated');
    blocks.push({ rule: '3.26', reason: `Missing required delivery data: ${parts.join(', ')}` });
  }

  if (blocks.length > 0) {
    for (const block of blocks) {
      await logComplianceIncident(base44, {
        incident_type: INCIDENT_TYPE_FOR_RULE[block.rule] || 'other_refusal',
        compliance_rule: block.rule,
        order_id: order.id,
        order_number: order.order_number || '',
        customer_name: order.customer_name || '',
        customer_email: order.customer_email || '',
        store_id: order.store_id || '',
        store_name: order.store_name || '',
        driver_id: order.driver_id || '',
        driver_name: order.driver_name || '',
        driver_email: order.driver_email || '',
        reason: block.reason,
        delivery_address: order.delivery_address || '',
        description: `Compliance check failed at delivery stage`,
      });
    }
  }

  return Response.json({ stage: 'delivery', approved: blocks.length === 0, blocks });
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
export default async function(req) {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { stage } = body;

    if (!['driver_assignment', 'order', 'delivery'].includes(stage)) {
      return Response.json({ error: 'Invalid stage. Use: driver_assignment, order, or delivery' }, { status: 400 });
    }

    // Stages that require authentication
    if (stage === 'driver_assignment' || stage === 'delivery') {
      const user = await base44.auth.me().catch(() => null);
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      if (stage === 'driver_assignment') return await checkDriverStage(base44, body, user);
      return await checkDeliveryStage(base44, body, user);
    }

    // Order stage is public (called during checkout)
    return await checkOrderStage(base44, body);
  } catch (error) {
    console.error('Compliance validation error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}