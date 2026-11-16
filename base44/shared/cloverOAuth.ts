// Store-scoped Clover authorization. Every helper is pure except the HMAC helpers,
// which take the secret as an argument so the rules can be tested without runtime secrets.
// A connection is only ever created from a signed state issued to one store and from a
// merchant identity that Clover itself returns for that authorization.
import { cloverState } from './readiness/readinessEvidence.ts';
import { text } from './readiness/readinessEvidence.ts';

export const CLOVER_CALLBACK_FUNCTION = 'connectStoreClover';
export const STATE_TTL_MINUTES = 10;

function base64Url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(base64), character => character.charCodeAt(0));
}

async function hmac(value, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return base64Url(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))));
}

// The callback must be reachable from outside the app, so it is built from the
// server-set app origin and never from the request host.
export function cloverCallbackUrl(appUrl) {
  const origin = text(appUrl).replace(/\/+$/, '');
  if (!/^https:\/\/[^/]+$/.test(origin)) throw new Error('The app address is unavailable; start the connection again from the app.');
  return `${origin}/functions/${CLOVER_CALLBACK_FUNCTION}`;
}

// The provider sends the retailer's browser straight back to us, so the redirect target
// must be absolute. It is built only from the server-set app origin (falling back to the
// published app) and a same-origin path, so the callback can never leave the app.
export function callbackRedirectTarget(origin, path, status, message = '', fallbackOrigin = '') {
  const base = text(origin).replace(/\/+$/, '') || text(fallbackOrigin).replace(/\/+$/, '');
  if (!/^https:\/\/[^/]+$/.test(base)) return '';
  const target = new URL(safeReturnPath(path, '/onboarding'), 'https://app.local');
  target.searchParams.set('clover', text(status) || 'error');
  const note = text(message);
  if (note) target.searchParams.set('message', note);
  return `${base}${target.pathname}${target.search}`;
}

// Same-origin relative paths only: a signed state can never redirect off the app.
export function safeReturnPath(value, fallback) {
  const raw = text(value);
  if (!raw || raw.length > 300) return fallback;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return fallback;
  return raw;
}

export async function signState(payload, secret) {
  if (!text(secret)) throw new Error('Clover authorization is not configured.');
  const encoded = base64Url(new TextEncoder().encode(JSON.stringify(payload)));
  return `${encoded}.${await hmac(encoded, secret)}`;
}

export async function verifyState(state, { secret, storeId, now = Date.now() }) {
  const invalid = 'This authorization link is invalid. Start the connection again from the store setup page.';
  const [encoded, signature] = text(state).split('.');
  if (!encoded || !signature || !text(secret)) throw new Error(invalid);
  if (signature !== await hmac(encoded, secret)) throw new Error(invalid);
  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(fromBase64Url(encoded)));
  } catch {
    throw new Error(invalid);
  }
  if (!payload || !text(payload.store_id)) throw new Error(invalid);
  if (!Number.isFinite(payload.exp) || now > payload.exp) {
    throw new Error('This authorization link expired before it was completed. Start the connection again.');
  }
  if (storeId && payload.store_id !== storeId) {
    throw new Error('This authorization was started for a different retailer.');
  }
  return payload;
}

// What the provider sent back, before any token exchange is attempted.
export function callbackIntent(params) {
  if (text(params.get('error'))) {
    return { outcome: 'cancelled', message: 'Clover authorization was cancelled. No connection was saved.' };
  }
  const code = text(params.get('code'));
  const state = text(params.get('state'));
  if (!code || !state) {
    return { outcome: 'invalid', message: 'This authorization link is incomplete. Start the connection from the store setup page.' };
  }
  return { outcome: 'proceed', code, state };
}

export function tokenFromResponse(ok, body) {
  const token = body || {};
  if (!ok) throw new Error(text(token.message) || 'Clover rejected the authorization code.');
  if (!text(token.access_token) || !text(token.refresh_token)) {
    throw new Error('Clover did not return usable credentials for this merchant.');
  }
  const accessExpiry = Number(token.access_token_expiration);
  const refreshExpiry = Number(token.refresh_token_expiration);
  if (!Number.isFinite(accessExpiry) || accessExpiry <= 0 || !Number.isFinite(refreshExpiry) || refreshExpiry <= 0) {
    throw new Error('Clover did not return token expiry, so the connection cannot be verified.');
  }
  return {
    access_token: text(token.access_token),
    refresh_token: text(token.refresh_token),
    merchant_id: text(token.merchant_id),
    access_token_expiration: Number(token.access_token_expiration),
    refresh_token_expiration: Number(token.refresh_token_expiration),
  };
}

// The merchant identity is whatever Clover returns for this token, never a value from
// the retailer's onboarding form.
export function merchantFromResponse(ok, body, expectedId) {
  const merchant = body || {};
  if (!ok) throw new Error(text(merchant.message) || 'Unable to verify the Clover merchant.');
  const id = text(merchant.id);
  const name = text(merchant.name);
  if (!/^[A-Za-z0-9]{6,20}$/.test(id)) throw new Error('Clover did not return a usable merchant identity.');
  if (expectedId && id !== text(expectedId)) {
    throw new Error('The authorized merchant does not match the merchant Clover reported for this authorization.');
  }
  if (!name) throw new Error('Clover did not return a verified merchant name.');
  return { id, name };
}

// One merchant belongs to one retailer. Reconnecting the same store is fine;
// taking over another retailer's merchant is not.
export function merchantConflict(connections, merchantId, storeId) {
  const id = text(merchantId).toLowerCase();
  if (!id) return '';
  const other = (connections || []).find(row => text(row.merchant_id).toLowerCase() === id
    && text(row.store_id)
    && text(row.store_id) !== text(storeId));
  if (!other) return '';
  return `This Clover merchant is already connected to ${text(other.merchant_name) || 'another retailer'}. Each retailer must authorize its own merchant.`;
}

// Reconnecting updates the store's existing record; a first authorization creates one.
export function connectionAction(rows, storeId) {
  const existing = (rows || []).find(row => text(row.store_id) === text(storeId));
  return existing ? { action: 'update', id: existing.id } : { action: 'create' };
}

export function connectionRecord({ storeId, merchant, token, encryptedAccess, encryptedRefresh, now }) {
  return {
    store_id: storeId,
    merchant_id: merchant.id,
    merchant_name: merchant.name,
    encrypted_access_token: encryptedAccess.encrypted,
    access_token_iv: encryptedAccess.iv,
    encrypted_refresh_token: encryptedRefresh.encrypted,
    refresh_token_iv: encryptedRefresh.iv,
    access_token_expires_at: new Date(token.access_token_expiration * 1000).toISOString(),
    refresh_token_expires_at: new Date(token.refresh_token_expiration * 1000).toISOString(),
    status: 'connected',
    connected_at: now,
  };
}

// The dashboard reads this instead of inferring a register from free-text onboarding fields.
export function connectionStatus(rows, store, today) {
  const state = cloverState(rows || [], store, today);
  return {
    status: state.status,
    reason: state.reason,
    connected: state.status === 'connected',
    needs_authorization: state.status !== 'connected',
  };
}