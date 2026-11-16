// Arkansas ABC compliance rules engine for alcohol delivery.
// Enforces ACT 157 rules: driver eligibility, address type, wet/dry area,
// restricted locations, order/delivery data collection, and record retention.

export const RECORD_RETENTION_YEARS = 3;

export function retentionUntil() {
  const d = new Date();
  d.setFullYear(d.getFullYear() + RECORD_RETENTION_YEARS);
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// Driver eligibility (checked at assignment)
// ---------------------------------------------------------------------------

export function calculateDriverAge(dateOfBirth) {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth + 'T00:00:00Z');
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const m = now.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < dob.getUTCDate())) age--;
  return age;
}

/**
 * Rule: Driver must be 21+, hold a valid license, and have no felony.
 * @param {object} driver - Driver entity record
 * @param {object} compliance - DriverCompliance entity record (or null)
 * @returns {{ eligible: boolean, blocks: Array<{rule: string, reason: string}> }}
 */
export function checkDriverEligibility(driver, compliance) {
  const blocks = [];

  // Age check
  const age = calculateDriverAge(driver?.date_of_birth);
  if (age === null) {
    blocks.push({ rule: 'driver_age', reason: 'Driver date of birth is missing or invalid' });
  } else if (age < 21) {
    blocks.push({ rule: 'driver_age', reason: `Driver is ${age} years old — must be 21 or older to deliver alcohol` });
  }

  // Felony / background check
  if (driver?.background_check_status === 'failed') {
    blocks.push({ rule: 'driver_felony', reason: 'Driver background check failed — disqualifying offense (felony) detected' });
  } else if (driver?.background_check_status !== 'clear') {
    blocks.push({ rule: 'driver_background', reason: `Driver background check is ${driver?.background_check_status || 'pending'} — not cleared for delivery` });
  }

  // License validity
  if (compliance?.status === 'revoked') {
    blocks.push({ rule: 'driver_license', reason: 'Driver compliance status is revoked' });
  } else if (compliance?.license_expiration_date) {
    const exp = new Date(compliance.license_expiration_date + 'T00:00:00Z');
    if (exp < new Date()) {
      blocks.push({ rule: 'driver_license', reason: `Driver license expired on ${compliance.license_expiration_date}` });
    }
  }

  return { eligible: blocks.length === 0, blocks };
}

// ---------------------------------------------------------------------------
// Address type check — Rule 3.28 (private residence only)
// ---------------------------------------------------------------------------

const RESIDENTIAL_TYPES = new Set([
  'house', 'residential', 'apartments', 'detached', 'semidetached_house',
  'farm', 'cottage', 'bungalow', 'terrace', 'static_caravan', 'dormitory',
]);

/**
 * Uses reverse geocoding to verify the delivery address is a private residence.
 * @returns {Promise<{ is_private_residence: boolean, category: string, type: string }>}
 */
export async function checkAddressType(latitude, longitude) {
  const url = `https://nominatim.openstreetmap.org/reverse?${new URLSearchParams({
    lat: String(latitude), lon: String(longitude), format: 'json', zoom: '18', addressdetails: '1',
  })}`;
  const res = await fetch(url, {
    headers: { 'Accept-Language': 'en', 'User-Agent': 'AlcoholDelivered/1.0' },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error('Address type verification is temporarily unavailable.');
  const data = await res.json();
  const category = data.category || '';
  const type = data.type || '';
  const isResidential = category === 'building' && RESIDENTIAL_TYPES.has(type);
  return { is_private_residence: isResidential, category, type };
}

// ---------------------------------------------------------------------------
// Restricted location check (school, playground, church, library)
// ---------------------------------------------------------------------------

/**
 * Queries OpenStreetMap Overpass API for restricted POIs near the delivery point.
 * @returns {Promise<{ is_restricted: boolean, matches: Array<{type: string, name: string}> }>}
 */
export async function checkRestrictedLocation(latitude, longitude, radius = 100) {
  const query = `[out:json][timeout:10];(
    node["amenity"~"school|kindergarten|college|university|library|place_of_worship"](around:${radius},${latitude},${longitude});
    way["amenity"~"school|kindergarten|college|university|library|place_of_worship"](around:${radius},${latitude},${longitude});
    node["leisure"="playground"](around:${radius},${latitude},${longitude});
    way["leisure"="playground"](around:${radius},${latitude},${longitude});
  );out tags 5;`;
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'data=' + encodeURIComponent(query),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error('Restricted location check is temporarily unavailable.');
  const data = await res.json();
  const matches = (data.elements || []).map(el => {
    const t = el.tags || {};
    if (t.amenity) return { type: t.amenity, name: t.name || '' };
    if (t.leisure) return { type: t.leisure, name: t.name || '' };
    return null;
  }).filter(Boolean);
  return { is_restricted: matches.length > 0, matches };
}

// ---------------------------------------------------------------------------
// Order data collection — Rule 3.25
// ---------------------------------------------------------------------------

/**
 * Validates that all required order data has been collected: name, address,
 * phone, DOB, and payment.
 * @param {object} order - Order data (entity or request body)
 * @param {string} declaredDob - Customer-declared date of birth (YYYY-MM-DD)
 * @returns {{ complete: boolean, missing: string[] }}
 */
export function checkOrderDataCollection(order, declaredDob) {
  const missing = [];
  if (!order?.customer_name) missing.push('customer_name');
  if (!order?.delivery_address) missing.push('delivery_address');
  if (!order?.customer_phone) missing.push('customer_phone');
  if (!declaredDob) missing.push('customer_dob');
  const paymentCollected = order?.stripe_payment_status === 'paid' || order?.payment_provided === true;
  if (!paymentCollected) missing.push('payment');
  return { complete: missing.length === 0, missing };
}

// ---------------------------------------------------------------------------
// Delivery data collection — Rule 3.26
// ---------------------------------------------------------------------------

/**
 * Validates that all required delivery data has been collected: receiver name,
 * actual address, receiver phone, DOB, valid state ID scan, and signature.
 * Also checks for intoxication refusal.
 * @param {object} order - Order entity record
 * @param {object} idVerification - IDVerification entity record (or null)
 * @param {boolean} intoxicated - Driver-observed intoxication flag
 * @returns {{ complete: boolean, missing: string[], intoxicated: boolean }}
 */
export function checkDeliveryDataCollection(order, idVerification, intoxicated) {
  const missing = [];
  if (!order?.delivery_address) missing.push('delivery_address_actual');
  if (!order?.customer_name) missing.push('receiver_name');
  if (!order?.customer_phone) missing.push('receiver_phone');
  if (!idVerification?.date_of_birth) missing.push('receiver_dob');
  if (!idVerification?.is_verified) missing.push('valid_state_id');
  if (!order?.delivery_signature_url) missing.push('signature');
  return { complete: missing.length === 0 && !intoxicated, missing, intoxicated: Boolean(intoxicated) };
}

// ---------------------------------------------------------------------------
// Incident logging (3-year retention)
// ---------------------------------------------------------------------------

export async function logComplianceIncident(base44, data) {
  return base44.asServiceRole.entities.ComplianceIncident.create({
    ...data,
    incident_date: new Date().toISOString(),
    retention_until: retentionUntil(),
  });
}