import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';
import { encryptToken } from '../../shared/cloverConnection.ts';

const storeId = '6a32d14d09b760f592dbf19e';
const expectedMerchantId = 'YJSBZTD0WJ201';
const returnUrl = 'https://alcohol-delivered-0c72f042.base44.app/admin/beverage-king-golive';

function redirectResult(status, message = '') {
  return Response.redirect(`${returnUrl}?clover=${status}${message ? `&message=${encodeURIComponent(message)}` : ''}`, 302);
}

function fromBase64Url(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
}

function base64Url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function expectedSignature(value: string) {
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

async function verifyState(state: string) {
  const [encoded, signature] = state.split('.');
  if (!encoded || !signature) throw new Error('Invalid authorization session.');
  const expected = await expectedSignature(encoded);
  if (signature !== expected) throw new Error('Invalid authorization session.');
  const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(encoded)));
  if (payload.store_id !== storeId || !payload.exp || Date.now() > payload.exp) {
    throw new Error('Authorization session expired. Please try again.');
  }
  return payload;
}

export default async function(req) {
  try {
    if (req.method !== 'GET') return Response.json({ error: 'Method not allowed' }, { status: 405 });

    const url = new URL(req.url);
    if (url.searchParams.get('error')) return redirectResult('denied', 'Clover authorization was cancelled.');

    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state') || '';
    if (!code) return redirectResult('error', 'Start the Clover connection from the Partner Financial Dashboard.');

    await verifyState(state);

    const tokenResponse = await fetch('https://api.clover.com/oauth/v2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: secrets.get('CLOVER_APP_ID'), client_secret: secrets.get('CLOVER_APP_SECRET'), code }),
    });
    const token = await tokenResponse.json();
    if (!tokenResponse.ok || !token.access_token || !token.refresh_token) throw new Error(token.message || 'Clover token exchange failed');

    const merchantId = url.searchParams.get('merchant_id') || token.merchant_id || expectedMerchantId;
    const merchantResponse = await fetch(`https://api.clover.com/v3/merchants/${merchantId}`, {
      headers: { Authorization: `Bearer ${token.access_token}`, Accept: 'application/json' },
    });
    const merchant = await merchantResponse.json();
    if (!merchantResponse.ok) throw new Error(merchant.message || 'Unable to verify Clover merchant');
    if (merchantId !== expectedMerchantId || !/beverage king/i.test(merchant.name || '')) {
      return redirectResult('wrong-account', `Please authorize Beverage King, not ${merchant.name || 'another merchant'}.`);
    }

    const base44 = createClientFromRequest(req);
    const access = await encryptToken(token.access_token);
    const refresh = await encryptToken(token.refresh_token);
    const data = {
      store_id: storeId,
      merchant_id: merchantId,
      merchant_name: merchant.name,
      encrypted_access_token: access.encrypted,
      access_token_iv: access.iv,
      encrypted_refresh_token: refresh.encrypted,
      refresh_token_iv: refresh.iv,
      access_token_expires_at: new Date(token.access_token_expiration * 1000).toISOString(),
      refresh_token_expires_at: new Date(token.refresh_token_expiration * 1000).toISOString(),
      status: 'connected',
      connected_at: new Date().toISOString(),
    };
    const existing = await base44.asServiceRole.entities.CloverConnection.filter({ store_id: storeId });
    if (existing[0]) await base44.asServiceRole.entities.CloverConnection.update(existing[0].id, data);
    else await base44.asServiceRole.entities.CloverConnection.create(data);

    return redirectResult('connected');
  } catch (error) {
    console.error('Beverage King Clover connection error:', error.message);
    return redirectResult('error', error.message);
  }
}