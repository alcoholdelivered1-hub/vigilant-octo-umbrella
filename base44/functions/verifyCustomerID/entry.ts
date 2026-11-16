import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

export default async function(req) {
  try {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me().catch(() => null);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id_image_file_uri, order_id, declared_dob, id_type: declared_id_type } = await req.json();

  if (typeof id_image_file_uri !== 'string' || id_image_file_uri.length > 1024 || !/^private\/[^\s?#]+$/.test(id_image_file_uri) || id_image_file_uri.split('/').includes('..')) {
    return Response.json({ error: 'A private ID image upload is required' }, { status: 400 });
  }

  // Fetch order details for cross-referencing — only if the caller is the order's
  // customer, the assigned driver, or an admin (prevents IDOR via order_id enumeration)
  let order = null;
  let canAccessOrder = false;
  if (order_id) {
    const orders = await base44.asServiceRole.entities.Order.filter({ id: order_id });
    order = orders[0] || null;
    if (order) {
      canAccessOrder =
        order.customer_email === user.email ||
        order.driver_email === user.email ||
        user.role === 'admin';
      if (!canAccessOrder) order = null;
    }
  }

  if (order_id && !canAccessOrder) return Response.json({ error: 'Order access denied' }, { status: 403 });

  // Sign with the caller's permissions, only for this OCR operation.
  // Never return or persist the temporary access URL.
  const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: id_image_file_uri, expires_in: 300 });
  const today = new Date().toISOString().split('T')[0];

  // Use AI vision to extract data from the ID image
  const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: `You are a strict ID verification system for alcohol delivery compliance under Arkansas ACT 157.
Analyze this government-issued photo ID image and extract the following fields.

Return ONLY valid JSON matching the schema. Do not include any markdown or commentary.

Fields to extract:
- full_name: full name exactly as printed on the ID (first + last)
- date_of_birth: date of birth in YYYY-MM-DD format
- expiration_date: expiration date in YYYY-MM-DD format
- id_type: one of drivers_license, passport, state_id, military_id
- state: issuing state 2-letter code (USA IDs)
- id_number_last4: last 4 digits of the ID number only (for privacy)
- is_expired: true if expiration_date is before today (${today})
- age: integer age calculated from date_of_birth as of today (${today})
- is_21_or_older: true if age >= 21
- is_valid_id: true if this appears to be a genuine government-issued photo ID with readable fields; false if image is unclear, not an ID, or fields cannot be extracted
- confidence: "high" if all fields clearly readable, "medium" if some fields unclear but DOB and name readable, "low" if image too blurry/dark/partial to reliably read`,
    file_urls: [signed_url],
    response_json_schema: {
      type: 'object',
      properties: {
        full_name: { type: 'string' },
        date_of_birth: { type: 'string' },
        expiration_date: { type: 'string' },
        id_type: { type: 'string' },
        state: { type: 'string' },
        id_number_last4: { type: 'string' },
        is_expired: { type: 'boolean' },
        age: { type: 'number' },
        is_21_or_older: { type: 'boolean' },
        is_valid_id: { type: 'boolean' },
        confidence: { type: 'string' },
      }
    }
  });

  // --- Name cross-reference against order ---
  let name_match = null;
  let name_match_detail = null;

  if (order && result.full_name) {
    const idName = result.full_name.toLowerCase().trim();
    const orderName = (order.customer_name || '').toLowerCase().trim();

    // Compare: exact match OR first/last name token overlap
    const idTokens = idName.split(/\s+/);
    const orderTokens = orderName.split(/\s+/);
    const sharedTokens = idTokens.filter(t => t.length > 1 && orderTokens.includes(t));

    if (idName === orderName) {
      name_match = true;
      name_match_detail = 'Exact match';
    } else if (sharedTokens.length >= 2) {
      name_match = true;
      name_match_detail = `Partial match (${sharedTokens.join(', ')})`;
    } else if (sharedTokens.length === 1 && (idTokens.length === 1 || orderTokens.length === 1)) {
      name_match = true;
      name_match_detail = `Single name match (${sharedTokens[0]})`;
    } else {
      name_match = false;
      name_match_detail = `ID name "${result.full_name}" does not match order name "${order.customer_name}"`;
    }
  }

  // --- Independently validate extracted DOB and the customer's declared checkout fields ---
  const parsedDob = /^\d{4}-\d{2}-\d{2}$/.test(result.date_of_birth || '') ? new Date(`${result.date_of_birth}T00:00:00Z`) : null;
  let calculatedAge = null;
  if (parsedDob && !Number.isNaN(parsedDob.getTime())) {
    const now = new Date();
    calculatedAge = now.getUTCFullYear() - parsedDob.getUTCFullYear();
    const monthDelta = now.getUTCMonth() - parsedDob.getUTCMonth();
    if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < parsedDob.getUTCDate())) calculatedAge--;
  }
  const ageVerified = calculatedAge !== null && calculatedAge >= 21;
  const declaredDobMatches = !declared_dob || declared_dob === result.date_of_birth;
  const declaredTypeMatches = !declared_id_type || declared_id_type === result.id_type;

  // Fail closed: missing/ambiguous fields are not treated as verified.
  const blocked =
    result.is_valid_id !== true ||
    result.is_expired !== false ||
    !ageVerified ||
    !['high', 'medium'].includes(result.confidence) ||
    (order_id && name_match !== true) ||
    !declaredDobMatches ||
    !declaredTypeMatches;

  let block_reason = null;
  if (!['high', 'medium'].includes(result.confidence) || result.is_valid_id !== true) {
    block_reason = 'Could not read a valid government-issued ID. Please retake the photo in good lighting with the full ID visible.';
  } else if (result.is_expired !== false) {
    block_reason = `ID is expired or the expiration date could not be verified (${result.expiration_date || 'unknown'}). Customer must provide a valid, non-expired ID.`;
  } else if (!ageVerified) {
    block_reason = calculatedAge === null ? 'Date of birth could not be verified from the ID.' : `Customer is ${calculatedAge} years old — must be 21 or older to receive alcohol. Refuse delivery.`;
  } else if (!declaredDobMatches) {
    block_reason = 'The date of birth entered at checkout does not match the uploaded ID.';
  } else if (!declaredTypeMatches) {
    block_reason = 'The selected ID type does not match the uploaded government ID.';
  } else if (name_match === false) {
    block_reason = `Name mismatch: ID shows "${result.full_name}" but order is for "${order?.customer_name}". Verify with customer and refuse if identities do not match.`;
  }

  let checkout_verification_id = null;
  if (order_id && !blocked && order?.status === 'in_transit' && order.driver_email?.toLowerCase() === user.email?.toLowerCase()) {
    await base44.asServiceRole.entities.IDVerification.create({
      customer_email: order.customer_email,
      customer_name: order.customer_name,
      order_id: order.id,
      verification_type: 'delivery',
      id_type: result.id_type || '',
      id_image_file_uri,
      date_of_birth: result.date_of_birth,
      is_verified: true,
      verified_by: user.email,
      notes: `Automated delivery verification; confidence=${result.confidence}; calculated_age=${calculatedAge}`,
    });
  }
  if (!order_id && !blocked) {
    const verification = await base44.asServiceRole.entities.IDVerification.create({
      customer_email: user.email,
      customer_name: result.full_name || '',
      verification_type: 'checkout',
      id_type: result.id_type || declared_id_type || '',
      id_image_file_uri,
      date_of_birth: result.date_of_birth,
      is_verified: true,
      notes: `Automated checkout verification; confidence=${result.confidence}; calculated_age=${calculatedAge}`,
    });
    checkout_verification_id = verification.id;
  }

  console.log(`[verifyCustomerID] order=${order_id} user=${user.email} confidence=${result.confidence} age=${calculatedAge} name_match=${name_match} blocked=${blocked}`);

  return Response.json({
    verified: !blocked && (!order_id || (order?.status === 'in_transit' && order.driver_email?.toLowerCase() === user.email?.toLowerCase())),
    checkout_verification_id,
    block_reason,
    extracted: {
      full_name: result.full_name,
      date_of_birth: result.date_of_birth,
      age: calculatedAge,
      is_21_or_older: ageVerified,
      is_expired: result.is_expired,
      expiration_date: result.expiration_date,
      confidence: result.confidence,
      is_valid_id: result.is_valid_id,
      id_type: result.id_type,
      state: result.state,
      id_number_last4: result.id_number_last4,
    },
    name_match,
    name_match_detail: canAccessOrder ? name_match_detail : null,
    order_customer_name: canAccessOrder ? (order?.customer_name || null) : null,
  });
  } catch {
    return Response.json({ error: 'ID verification could not be completed. Please retry.' }, { status: 500 });
  }
}