import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Shared FCM push sender.
 * Payload: { tokens: string[], title: string, body: string, data?: object }
 * OR:      { user_emails: string[], title, body, data? }
 * OR:      { store_id: string, title, body, data? }
 * OR:      { driver_id: string, title, body, data? }
 */
function base64Url(value) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).split('+').join('-').split('/').join('_').replace(/=+$/g, '');
}

function pemToBytes(pem) {
  const value = pem
    .split('-----BEGIN PRIVATE KEY-----').join('')
    .split('-----END PRIVATE KEY-----').join('')
    .replace(/\s/g, '');
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function getGoogleAccessToken(serviceAccount) {
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
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const token = await response.json();
  if (!response.ok || !token.access_token) {
    throw new Error(token.error_description || token.error || 'Unable to authenticate Firebase service account');
  }
  return token.access_token;
}

async function sendFCMToTokens(tokens, title, body, data = {}) {
  const rawServiceAccount = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON') || Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
  if (!rawServiceAccount) {
    throw new Error('Firebase service account is not configured. Add FIREBASE_SERVICE_ACCOUNT_JSON in Base44 Secrets.');
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(rawServiceAccount);
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.');
  }
  if (!serviceAccount.client_email || !serviceAccount.private_key || !serviceAccount.project_id) {
    throw new Error('Firebase service account JSON is missing client_email, private_key, or project_id.');
  }

  const accessToken = await getGoogleAccessToken(serviceAccount);
  const stringData = Object.fromEntries(
    Object.entries({ ...data, title, body }).map(([key, value]) => [key, String(value ?? '')]),
  );
  const results = [];

  // HTTP v1 sends one message per request. Use modest parallel batches to avoid
  // overwhelming Firebase while still notifying every registered device.
  for (let index = 0; index < tokens.length; index += 50) {
    const batch = tokens.slice(index, index + 50);
    const batchResults = await Promise.all(batch.map(async (token) => {
      const response = await fetch(
        `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`,
        {
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
              webpush: {
                headers: { Urgency: 'high' },
                notification: { requireInteraction: true },
                fcm_options: { link: 'https://alcohol-delivered.biz' },
              },
              android: { priority: 'high', notification: { sound: 'default' } },
              apns: { payload: { aps: { sound: 'default' } } },
            },
          }),
        },
      );
      const result = await response.json().catch(() => ({}));
      return { ok: response.ok, status: response.status, result };
    }));
    results.push(...batchResults);
  }

  const sent = results.filter((result) => result.ok).length;
  console.log(`FCM HTTP v1 sent ${sent}/${tokens.length} notifications`);
  return results;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json();

    // Auth: must be an authenticated admin (direct call) or an internal
    // service-role call from another backend function / automation.
    const user = await base44.auth.me().catch(() => null);
    if (user) {
      if (user.role !== 'admin') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    } else {
      const isAuthenticated = await base44.auth.isAuthenticated().catch(() => false);
      if (!isAuthenticated) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const { tokens: directTokens, user_emails, store_id, driver_id, title, body: msgBody, data } = body;

    if (!title || !msgBody) {
      return Response.json({ error: 'title and body are required' }, { status: 400 });
    }

    let fcmTokens = [];

    if (directTokens?.length) {
      fcmTokens = directTokens;
    } else if (user_emails?.length) {
      const records = await base44.asServiceRole.entities.FCMToken.filter({ user_email: user_emails[0] });
      // For multiple emails, fetch each (simple approach)
      const all = [];
      for (const email of user_emails) {
        const r = await base44.asServiceRole.entities.FCMToken.filter({ user_email: email });
        all.push(...r);
      }
      fcmTokens = all.map(r => r.token);
    } else if (store_id) {
      const records = await base44.asServiceRole.entities.FCMToken.filter({ store_id });
      fcmTokens = records.map(r => r.token);
    } else if (driver_id) {
      const records = await base44.asServiceRole.entities.FCMToken.filter({ driver_id });
      fcmTokens = records.map(r => r.token);
    }

    if (fcmTokens.length === 0) {
      console.log('No FCM tokens found for target — skipping push');
      return Response.json({ skipped: true, reason: 'No FCM tokens registered for target' });
    }

    const results = await sendFCMToTokens(fcmTokens, title, msgBody, data || {});
    return Response.json({ success: true, tokens_targeted: fcmTokens.length, results });
  } catch (error) {
    console.error('sendFCMPush error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});