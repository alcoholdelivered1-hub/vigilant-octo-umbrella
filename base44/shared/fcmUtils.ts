/**
 * Shared FCM push notification utilities — Firebase Cloud Messaging HTTP v1 API.
 *
 * Used by sendFCMPush, notifyAdminNewSale, and notifyRetailerNewOrder so there
 * is a single working sender (the legacy `fcm/send` endpoint was shut down by
 * Google in June 2024).
 *
 * Requires the FIREBASE_SERVICE_ACCOUNT secret: the full service-account JSON
 * from Firebase Console → Project Settings → Service Accounts → Generate new
 * private key.
 */

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getOAuthToken(serviceAccount: { client_email: string; private_key: string }) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const encoder = new TextEncoder();
  const headerB64 = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const pemContents = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, encoder.encode(unsignedToken));
  const signatureB64 = base64UrlEncode(new Uint8Array(signature));
  const jwt = `${unsignedToken}.${signatureB64}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  const tokenData = await response.json();
  if (!tokenData.access_token) {
    throw new Error(`FCM OAuth token exchange failed: ${JSON.stringify(tokenData)}`);
  }
  return tokenData.access_token as string;
}

export function getFCMServiceAccount() {
  const saRaw = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
  if (!saRaw) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT secret not set — paste your Firebase service-account JSON in Base44 secrets');
  }
  return JSON.parse(saRaw);
}

/**
 * Send a push notification to a list of FCM registration tokens.
 * Returns an array of per-token results: { token, success, error, name }.
 */
export async function sendFCMToTokens(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, string> = {}
) {
  if (!tokens || tokens.length === 0) return [];

  const serviceAccount = getFCMServiceAccount();
  const accessToken = await getOAuthToken(serviceAccount);
  const projectId = serviceAccount.project_id;
  if (!projectId) throw new Error('project_id missing from FIREBASE_SERVICE_ACCOUNT JSON');

  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

  const stringData = Object.fromEntries(
    Object.entries({ ...data, title, body }).map(([k, v]) => [k, String(v)])
  );

  const results = [];
  for (const token of tokens) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            token,
            notification: { title, body },
            data: stringData,
            android: { priority: 'high' },
            apns: { headers: { 'apns-priority': '10' } },
          },
        }),
      });

      const result = await response.json();
      results.push({
        token: token.slice(0, 20) + '…',
        success: response.ok,
        error: result.error?.message || null,
        name: result.name || null,
      });
    } catch (err) {
      results.push({ token: token.slice(0, 20) + '…', success: false, error: err.message });
    }
  }

  return results;
}