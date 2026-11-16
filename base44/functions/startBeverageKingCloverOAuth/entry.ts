import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';
import { setupStore, requireUnambiguousRetailer } from '../../shared/retailerSetupAccess.ts';

const storeId = '6a32d14d09b760f592dbf19e';
const storeOwnerEmail = 'bevking71603@gmail.com';
const callbackUrl = 'https://alcohol-delivered-0c72f042.base44.app/functions/connectBeverageKingClover';

function base64Url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function sign(value: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secrets.get('CLOVER_APP_SECRET')),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return base64Url(new Uint8Array(signature));
}

export default async function(req) {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'You must be logged in to connect Clover.' }, { status: 401 });
    if (user.role !== 'admin' && user.email?.toLowerCase() !== storeOwnerEmail) {
      return Response.json({ error: 'You are not authorized to connect Beverage King Clover.' }, { status: 403 });
    }

    const body = await req.json();
    const canonical = await setupStore(base44,user,body.store_id || storeId);
    await requireUnambiguousRetailer(base44,canonical);
    if (canonical.id !== storeId) return Response.json({ error:'This authorization is configured only for the canonical Beverage King merchant. Administrator setup is required for another store.' },{ status:409 });
    const payload = {
      store_id: canonical.id,
      user_email: user.email,
      nonce: crypto.randomUUID(),
      exp: Date.now() + 10 * 60 * 1000,
    };
    const encoded = base64Url(new TextEncoder().encode(JSON.stringify(payload)));
    const state = `${encoded}.${await sign(encoded)}`;

    const authorizeUrl = new URL('https://www.clover.com/oauth/v2/authorize');
    authorizeUrl.search = new URLSearchParams({
      client_id: secrets.get('CLOVER_APP_ID'),
      redirect_uri: callbackUrl,
      merchant_id: 'YJSBZTD0WJ201',
      state,
    }).toString();

    return Response.json({ authorize_url: authorizeUrl.toString() });
  } catch (error) {
    console.error('Start Beverage King Clover OAuth error:', error.message);
    return Response.json({ error: error.message || 'Unable to start Clover authorization.' }, { status: error.status || 500 });
  }
}