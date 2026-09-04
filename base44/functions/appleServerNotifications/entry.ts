import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import forge from 'npm:node-forge@1.3.1';

/**
 * Apple App Store Server Notifications V2 endpoint.
 *
 * Receives signed JWS notifications from Apple about in-app purchase and
 * subscription lifecycle events (renewals, expirations, refunds, etc.),
 * verifies the ES256 signature using the x5c certificate chain, decodes
 * the nested signedTransactionInfo / signedRenewalInfo payloads, and
 * stores each notification as an AppleSubscriptionNotification record.
 *
 * Endpoint URL: https://www.base44.com/api/functions/appleServerNotifications
 *
 * In App Store Connect → App → App Information → App Store Server Notifications,
 * set the Production Server URL (and Sandbox URL) to the endpoint above and
 * select "Version 2 Notifications".
 */

// ── Base64 / byte helpers ──────────────────────────────────────────

function b64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return atob(str);
}

function b64UrlToBytes(str) {
  const binary = b64UrlDecode(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function strToBytes(str) {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
  return bytes;
}

// Convert raw ECDSA R‖S signature (64 bytes for P-256) to DER format
// that Web Crypto's subtle.verify expects.
function rawSigToDER(rawSig) {
  function encodeInt(half) {
    let off = 0;
    while (off < half.length - 1 && half[off] === 0) off++;
    let trimmed = half.subarray(off);
    if (trimmed[0] & 0x80) {
      const padded = new Uint8Array(trimmed.length + 1);
      padded.set(trimmed, 1);
      trimmed = padded;
    }
    return trimmed;
  }
  const r = encodeInt(rawSig.subarray(0, 32));
  const s = encodeInt(rawSig.subarray(32, 64));
  const bodyLen = 2 + r.length + 2 + s.length;
  const der = new Uint8Array(2 + bodyLen);
  let p = 0;
  der[p++] = 0x30; // SEQUENCE
  der[p++] = bodyLen;
  der[p++] = 0x02; // INTEGER r
  der[p++] = r.length;
  der.set(r, p); p += r.length;
  der[p++] = 0x02; // INTEGER s
  der[p++] = s.length;
  der.set(s, p);
  return der;
}

// Extract SubjectPublicKeyInfo (SPKI) DER bytes from a base64-encoded X.509 cert.
function extractSPKI(certBase64) {
  const certBinary = atob(certBase64);
  const asn1 = forge.asn1.fromDer(certBinary);
  // Certificate ::= SEQUENCE { tbsCertificate, signatureAlgorithm, signature }
  const tbs = asn1.value[0];
  // version is [0] EXPLICIT (context-specific tag, tagClass 0x80) when present
  const hasVersion = tbs.value[0] && tbs.value[0].tagClass === 0x80;
  // Fields: [version], serialNumber, signature, issuer, validity, subject, SPKI
  const spki = tbs.value[hasVersion ? 6 : 5];
  const spkiDer = forge.asn1.toDer(spki).getBytes();
  return strToBytes(spkiDer);
}

// Decode and verify an Apple JWS (ES256 with x5c certificate chain).
async function decodeAndVerifyJWS(jws) {
  const parts = jws.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWS: expected 3 dot-separated parts');
  const [headerB64, payloadB64, sigB64] = parts;

  const header = JSON.parse(b64UrlDecode(headerB64));
  if (header.alg !== 'ES256') throw new Error('Unsupported algorithm: ' + header.alg);
  if (!header.x5c || !header.x5c.length) throw new Error('No x5c certificate chain in JWS header');

  // Import the leaf cert's public key via its SubjectPublicKeyInfo
  const spki = extractSPKI(header.x5c[0]);
  const cryptoKey = await crypto.subtle.importKey(
    'spki', spki,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, ['verify']
  );

  // Verify the JWS signature
  const signingInput = strToBytes(headerB64 + '.' + payloadB64);
  const rawSig = b64UrlToBytes(sigB64);
  const derSig = rawSigToDER(rawSig);
  const valid = await crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey, derSig, signingInput
  );
  if (!valid) throw new Error('JWS signature verification failed');

  return JSON.parse(b64UrlDecode(payloadB64));
}

// ── Request handler ────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const body = await req.json();
    if (!body.signedPayload) {
      return Response.json({ error: 'Missing signedPayload' }, { status: 400 });
    }

    // Decode and verify the outer notification JWS
    const notification = await decodeAndVerifyJWS(body.signedPayload);

    // Decode nested signed payloads (best-effort)
    let txInfo = null;
    let renewInfo = null;
    if (notification.data?.signedTransactionInfo) {
      try { txInfo = await decodeAndVerifyJWS(notification.data.signedTransactionInfo); }
      catch (e) { console.warn('signedTransactionInfo decode failed:', e.message); }
    }
    if (notification.data?.signedRenewalInfo) {
      try { renewInfo = await decodeAndVerifyJWS(notification.data.signedRenewalInfo); }
      catch (e) { console.warn('signedRenewalInfo decode failed:', e.message); }
    }

    // Persist the notification
    const base44 = createClientFromRequest(req);
    await base44.asServiceRole.entities.AppleSubscriptionNotification.create({
      notification_type: notification.notificationType || '',
      subtype: notification.subtype || '',
      transaction_id: txInfo?.transactionId || notification.data?.transactionId || '',
      original_transaction_id: txInfo?.originalTransactionId || '',
      product_id: txInfo?.productId || '',
      environment: notification.data?.environment || '',
      auto_renew_status: renewInfo?.autoRenewStatus,
      expiration_date: txInfo?.expiresDate
        ? new Date(Number(txInfo.expiresDate)).toISOString()
        : null,
      received_at: new Date().toISOString(),
      description: `Apple ${notification.notificationType || ''}${notification.subtype ? '/' + notification.subtype : ''} — ${txInfo?.productId || 'n/a'}`,
    });

    console.log(`Apple notification stored: ${notification.notificationType}/${notification.subtype || ''} tx=${txInfo?.transactionId || 'n/a'}`);

    return Response.json({ received: true });
  } catch (error) {
    console.error('appleServerNotifications error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});