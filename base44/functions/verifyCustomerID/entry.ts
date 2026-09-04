import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id_image_url, id_image_uri, order_id } = await req.json();

  // ID images are stored PRIVATELY. When a private file_uri is supplied, mint a
  // short-lived signed URL server-side so the image can be read by the OCR
  // model without ever being publicly addressable. (id_image_url is accepted
  // for backward compatibility with older callers.)
  let ocrImageUrl = id_image_url;
  if (!ocrImageUrl && id_image_uri) {
    try {
      const signed = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({
        file_uri: id_image_uri,
        expires_in: 120,
      });
      ocrImageUrl = signed?.signed_url || null;
    } catch (e) {
      console.error('[verifyCustomerID] failed to mint signed URL for ID image:', e.message);
    }
  }

  if (!ocrImageUrl) {
    return Response.json({ error: 'No ID image provided' }, { status: 400 });
  }

  // Fetch order details for cross-referencing (name, customer_name)
  let order = null;
  if (order_id) {
    const orders = await base44.asServiceRole.entities.Order.filter({ id: order_id });
    order = orders[0] || null;
  }

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
    file_urls: [ocrImageUrl],
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

  // --- Determine overall verification outcome ---
  const blocked =
    result.is_valid_id === false ||
    result.is_expired === true ||
    result.is_21_or_older === false ||
    result.confidence === 'low' ||
    name_match === false;

  let block_reason = null;
  if (result.confidence === 'low' || result.is_valid_id === false) {
    block_reason = 'Could not read a valid government-issued ID. Please retake the photo in good lighting with the full ID visible.';
  } else if (result.is_expired) {
    block_reason = `ID expired (${result.expiration_date}). Customer must provide a valid, non-expired ID.`;
  } else if (result.is_21_or_older === false) {
    block_reason = `Customer is ${result.age} years old — must be 21 or older to receive alcohol. Refuse delivery.`;
  } else if (name_match === false) {
    block_reason = `Name mismatch: ID shows "${result.full_name}" but order is for "${order?.customer_name}". Verify with customer and refuse if identities do not match.`;
  }

  console.log(`[verifyCustomerID] order=${order_id} driver=${user.email} confidence=${result.confidence} age=${result.age} name_match=${name_match} blocked=${blocked}`);

  return Response.json({
    verified: !blocked,
    block_reason,
    extracted: {
      full_name: result.full_name,
      date_of_birth: result.date_of_birth,
      age: result.age,
      is_21_or_older: result.is_21_or_older,
      is_expired: result.is_expired,
      expiration_date: result.expiration_date,
      confidence: result.confidence,
      is_valid_id: result.is_valid_id,
      id_type: result.id_type,
      state: result.state,
      id_number_last4: result.id_number_last4,
    },
    name_match,
    name_match_detail,
    order_customer_name: order?.customer_name || null,
  });
});