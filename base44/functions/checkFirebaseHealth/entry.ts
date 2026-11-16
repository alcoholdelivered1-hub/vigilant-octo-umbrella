import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { assertAdmin } from '../../shared/authGuard.ts';
import { secrets } from 'base44:runtime';

function base64Url(value) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).split('+').join('-').split('/').join('_').replace(/=+$/g, '');
}

function pemToBytes(pem) {
  const value = pem.split('-----BEGIN PRIVATE KEY-----').join('').split('-----END PRIVATE KEY-----').join('').replace(/\s/g, '');
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const access = await assertAdmin(base44);
    if (!access.authorized) return access.response;

    const raw = secrets.get('FIREBASE_SERVICE_ACCOUNT');
    if (!raw) {
      return Response.json({
        healthy: false,
        configured: false,
        error: 'FIREBASE_SERVICE_ACCOUNT secret is not set. Paste the full service-account JSON from Firebase Console → Project Settings → Service Accounts → Generate new private key.',
      });
    }

    let serviceAccount;
    try {
      serviceAccount = JSON.parse(raw);
    } catch {
      return Response.json({
        healthy: false,
        configured: true,
        parse_error: true,
        error: 'FIREBASE_SERVICE_ACCOUNT is not valid JSON. Open the downloaded .json file, copy ALL of its contents, and paste into the secret field.',
      });
    }

    const missing = [];
    if (!serviceAccount.client_email) missing.push('client_email');
    if (!serviceAccount.private_key) missing.push('private_key');
    if (!serviceAccount.project_id) missing.push('project_id');
    if (missing.length) {
      return Response.json({
        healthy: false,
        configured: true,
        parse_error: false,
        missing_fields: missing,
        error: `Service account JSON is missing required field(s): ${missing.join(', ')}.`,
      });
    }

    // Attempt to obtain a Google access token to verify the credentials are live.
    const now = Math.floor(Date.now() / 1000);
    const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const payload = base64Url(JSON.stringify({
      iss: serviceAccount.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }));
    const unsigned = `${header}.${payload}`;
    const key = await crypto.subtle.importKey(
      'pkcs8',
      pemToBytes(serviceAccount.private_key),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
    const assertion = `${unsigned}.${base64Url(signature)}`;
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    });
    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      return Response.json({
        healthy: false,
        configured: true,
        parse_error: false,
        auth_failed: true,
        error: tokenData.error_description || tokenData.error || 'Google rejected the service-account credentials.',
        project_id: serviceAccount.project_id,
        client_email: serviceAccount.client_email,
      });
    }

    return Response.json({
      healthy: true,
      configured: true,
      parse_error: false,
      project_id: serviceAccount.project_id,
      client_email: serviceAccount.client_email,
      token_acquired: true,
    });
  } catch (error) {
    console.error('checkFirebaseHealth error:', error.message);
    return Response.json({ healthy: false, error: error.message });
  }
}