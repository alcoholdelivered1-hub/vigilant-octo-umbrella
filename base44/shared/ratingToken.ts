/**
 * Cryptographically signed rating tokens for the public delivery-rating endpoint.
 *
 * Previously the token was a plain base64 of `orderId:driverId`, which any client
 * could forge to submit ratings for arbitrary orders/drivers (IDOR).
 *
 * The token is now `base64(orderId:driverId:hmac)` where hmac = HMAC-SHA256
 * of `orderId:driverId` keyed by a server-side secret. The signature is verified
 * on submit so forged tokens are rejected.
 */

function getSecret(): string {
  // Dedicated secret when available; fall back to STRIPE_SECRET_KEY (always present
  // in live mode) so the feature works immediately without a separate setup step.
  return Deno.env.get('RATING_TOKEN_SECRET') || Deno.env.get('STRIPE_SECRET_KEY') || '';
}

async function hmacSha256Hex(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function createRatingToken(orderId: string, driverId: string): Promise<string> {
  const secret = getSecret();
  const payload = `${orderId}:${driverId}`;
  const sig = await hmacSha256Hex(payload, secret);
  return btoa(`${payload}:${sig}`);
}

export async function verifyRatingToken(
  token: string
): Promise<{ orderId: string; driverId: string } | null> {
  try {
    const decoded = atob(token);
    const parts = decoded.split(':');
    if (parts.length !== 3) return null;
    const [orderId, driverId, sig] = parts;
    if (!orderId || !driverId || !sig) return null;
    const secret = getSecret();
    const expectedSig = await hmacSha256Hex(`${orderId}:${driverId}`, secret);
    if (sig !== expectedSig) return null;
    return { orderId, driverId };
  } catch {
    return null;
  }
}