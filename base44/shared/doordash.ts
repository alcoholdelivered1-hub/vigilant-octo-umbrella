/**
 * DoorDash Drive API client.
 *
 * Auth: HS256 JWT signed with the base64url-decoded signing_secret
 * (DoorDash Developer Portal credentials: developer_id, key_id, signing_secret).
 *
 * Used by dispatch to attempt a DoorDash delivery first; the caller falls back
 * to internal drivers when DoorDash cannot accept the delivery.
 */
import { secrets } from "base44:runtime";

const DRIVE_API = "https://openapi.doordash.com/drive/v2/deliveries/";

function base64UrlDecode(str) {
  let base64 = String(str).replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64UrlEncode(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function formatPhone(phone) {
  if (!phone) return "";
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length > 10) return `+${digits}`;
  return "";
}

export async function generateDoorDashJwt() {
  const developerId = secrets.get("DOORDASH_DEVELOPER_ID");
  const keyId = secrets.get("DOORDASH_KEY_ID");
  const signingSecret = secrets.get("DOORDASH_SIGNING_SECRET");
  if (!developerId || !keyId || !signingSecret) {
    throw new Error("DoorDash credentials not configured");
  }

  const header = { alg: "HS256", typ: "JWT", "dd-ver": "DD-JWT-V1" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud: "doordash", iss: developerId, kid: keyId, exp: now + 300, iat: now };

  const enc = new TextEncoder();
  const headerB64 = base64UrlEncode(enc.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(enc.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  // The signing_secret is base64url-decoded before use as the HMAC key.
  // If decoding fails (malformed secret), fall back to the raw secret bytes.
  let keyBytes;
  try {
    keyBytes = base64UrlDecode(signingSecret);
  } catch {
    keyBytes = enc.encode(signingSecret);
  }

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(signingInput));
  const sigB64 = base64UrlEncode(new Uint8Array(sig));

  return `${signingInput}.${sigB64}`;
}

/**
 * Attempts to create a DoorDash Drive delivery for an order.
 * Returns { success, delivery_id, error } — the caller falls back to internal
 * drivers when success is false (DoorDash unavailable / rejected the delivery).
 */
export async function createDoorDashDelivery({ order, store }) {
  const jwt = await generateDoorDashJwt();
  const externalDeliveryId = `ad-${order.id.slice(-12)}`;

  const pickupAddress = [
    store.address,
    store.city,
    store.state,
    store.zip_code,
  ].filter(Boolean).join(", ");

  const body = {
    external_delivery_id: externalDeliveryId,
    pickup_address: pickupAddress,
    pickup_business_name: store.name,
    pickup_phone_number: formatPhone(store.phone),
    dropoff_address: order.delivery_address,
    dropoff_phone_number: formatPhone(order.customer_phone),
    dropoff_instructions: `Order ${order.order_number}. Customer: ${order.customer_name}. ID verification (21+) required at delivery — alcohol.`,
    order_value: Math.round(Number(order.subtotal || order.total) * 100),
    currency: "usd",
    ...(order.tip ? { tip: Math.round(Number(order.tip) * 100) } : {}),
    contains_alcohol: true,
  };

  const res = await fetch(DRIVE_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errMsg = data.error_message || data.message || data.error || `DoorDash API returned ${res.status}`;
    return { success: false, error: errMsg, status: res.status };
  }

  return {
    success: true,
    delivery_id: data.id || externalDeliveryId,
    external_delivery_id: externalDeliveryId,
    dasher_status: data.dasher_status || data.status || "created",
  };
}