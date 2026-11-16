// Rule-level checks for store-scoped Clover authorization. No network, no secrets:
// the HMAC secret is passed in, and every outcome the callback can reach is exercised.
import { assertEquals, assert, assertRejects } from 'jsr:@std/assert@1';
import {
  callbackIntent, callbackRedirectTarget, cloverCallbackUrl, connectionAction, connectionRecord,
  connectionStatus, merchantConflict, merchantFromResponse, safeReturnPath, signState,
  tokenFromResponse, verifyState,
} from './cloverOAuth.ts';

const secret = 'test-clover-app-secret';
const today = '2026-10-24';
const now = Date.parse('2026-10-24T12:00:00.000Z');
const store = { id: 'store_1', name: 'Woodlands Fine Wine & Spirits' };
const otherStore = { id: 'store_2', name: 'Other Wines' };

const tokenBody = {
  access_token: 'access-token-1',
  refresh_token: 'refresh-token-1',
  merchant_id: 'K564NATGH4071',
  access_token_expiration: 1792891200,
  refresh_token_expiration: 1824427200,
};
const merchantBody = { id: 'K564NATGH4071', name: 'Woodlands Fine Wine & Spirits' };
const payload = {
  store_id: store.id,
  user_email: 'owner@woodlands.test',
  return_path: `/onboarding?store_id=${store.id}`,
  nonce: 'nonce-1',
  exp: now + 5 * 60 * 1000,
};

function query(values) {
  return new URLSearchParams(values);
}

Deno.test('authorization success stores one verified connection for the initiating store', async () => {
  const state = await signState(payload, secret);
  const verified = await verifyState(state, { secret, storeId: store.id, now });
  assertEquals(verified.store_id, store.id);

  const intent = callbackIntent(query({ code: 'code-1', state }));
  assertEquals(intent.outcome, 'proceed');

  const token = tokenFromResponse(true, tokenBody);
  const merchant = merchantFromResponse(true, merchantBody, token.merchant_id);
  assertEquals(merchant, { id: 'K564NATGH4071', name: 'Woodlands Fine Wine & Spirits' });

  assertEquals(connectionAction([], store.id), { action: 'create' });
  const record = connectionRecord({
    storeId: store.id,
    merchant,
    token,
    encryptedAccess: { encrypted: 'enc-access', iv: 'iv-access' },
    encryptedRefresh: { encrypted: 'enc-refresh', iv: 'iv-refresh' },
    now: '2026-10-24T12:00:00.000Z',
  });
  assertEquals(record.store_id, store.id);
  assertEquals(record.merchant_id, 'K564NATGH4071');
  assertEquals(record.status, 'connected');
  assertEquals(record.connected_at, '2026-10-24T12:00:00.000Z');
  assert(record.access_token_expires_at.startsWith('2026-10-'));

  const status = connectionStatus([{ ...record, id: 'c1' }], store, today);
  assertEquals(status.status, 'connected');
  assertEquals(status.needs_authorization, false);
});

Deno.test('cancelling at Clover saves nothing', () => {
  const cancelled = callbackIntent(query({ error: 'access_denied', state: 'anything' }));
  assertEquals(cancelled.outcome, 'cancelled');
  assert(/cancelled/i.test(cancelled.message));
  assertEquals(connectionAction([], store.id), { action: 'create' }, 'a cancel still leaves the store unconnected');
  assertEquals(connectionStatus([], store, today).needs_authorization, true);
});

Deno.test('invalid credentials never create a connection', () => {
  assertThrowsMessage(() => tokenFromResponse(false, { message: 'Invalid authorization code' }), 'Invalid authorization code');
  assertThrowsMessage(() => tokenFromResponse(true, { access_token: 'a' }), 'did not return usable credentials');
  assertThrowsMessage(() => tokenFromResponse(true, { ...tokenBody, access_token_expiration: null }), 'token expiry');
  assertThrowsMessage(() => merchantFromResponse(false, { message: 'Not found' }), 'Not found');
  // The merchant identity must come from Clover, and must look like a real merchant.
  assertThrowsMessage(() => merchantFromResponse(true, { id: '', name: 'Woodlands' }), 'usable merchant identity');
  assertThrowsMessage(() => merchantFromResponse(true, { id: 'Pending authorization', name: 'Woodlands' }), 'usable merchant identity');
  assertThrowsMessage(() => merchantFromResponse(true, { id: 'K564NATGH4071', name: ' ' }), 'verified merchant name');
});

Deno.test('expired authorization links and expired tokens both require reauthorization', async () => {
  const state = await signState({ ...payload, exp: now - 1000 }, secret);
  await assertRejects(
    () => verifyState(state, { secret, storeId: store.id, now }),
    Error,
    'expired before it was completed',
  );

  const expiredRow = {
    id: 'c1', store_id: store.id, status: 'connected',
    merchant_id: 'K564NATGH4071', merchant_name: 'Woodlands Fine Wine & Spirits',
    access_token_expires_at: '2026-10-01T00:00:00.000Z',
  };
  const status = connectionStatus([expiredRow], store, today);
  assertEquals(status.status, 'expired');
  assertEquals(status.needs_authorization, true);

  const refreshExpired = connectionStatus([{ ...expiredRow, access_token_expires_at: '', refresh_token_expires_at: '2026-10-01T00:00:00.000Z' }], store, today);
  assertEquals(refreshExpired.status, 'expired');

  const flagged = connectionStatus([{ ...expiredRow, access_token_expires_at: '', status: 'expired' }], store, today);
  assertEquals(flagged.status, 'expired');
});

Deno.test('a state issued for one store cannot complete another store\u2019s connection', async () => {
  const state = await signState(payload, secret);
  await assertRejects(
    () => verifyState(state, { secret, storeId: otherStore.id, now }),
    Error,
    'different retailer',
  );

  // A state signed with a different secret is not accepted at all.
  const foreign = await signState({ ...payload, store_id: otherStore.id }, 'another-secret');
  await assertRejects(
    () => verifyState(foreign, { secret, storeId: otherStore.id, now }),
    Error,
    'invalid',
  );

  // Tampering with the payload invalidates the signature.
  const [encoded, signature] = state.split('.');
  const tampered = `${encoded}x.${signature}`;
  await assertRejects(() => verifyState(tampered, { secret, storeId: store.id, now }), Error, 'invalid');

  // Another retailer's merchant is refused, and their record is untouched.
  const taken = [{ id: 'c9', store_id: otherStore.id, merchant_id: 'K564NATGH4071', merchant_name: 'Other Wines' }];
  assert(/already connected/i.test(merchantConflict(taken, 'K564NATGH4071', store.id)));
  assertEquals(merchantConflict([], 'K564NATGH4071', store.id), '');
});

Deno.test('reconnecting a store updates its own record instead of adding a second one', () => {
  const rows = [{ id: 'c1', store_id: store.id, status: 'expired', merchant_id: 'K564NATGH4071' }];
  assertEquals(connectionAction(rows, store.id), { action: 'update', id: 'c1' });

  // The same merchant reconnecting to its own store is not a conflict.
  assertEquals(merchantConflict(rows, 'K564NATGH4071', store.id), '');

  const refreshed = connectionRecord({
    storeId: store.id,
    merchant: { id: 'K564NATGH4071', name: 'Woodlands Fine Wine & Spirits' },
    token: tokenFromResponse(true, tokenBody),
    encryptedAccess: { encrypted: 'enc-access-2', iv: 'iv-access-2' },
    encryptedRefresh: { encrypted: 'enc-refresh-2', iv: 'iv-refresh-2' },
    now: '2026-10-24T13:00:00.000Z',
  });
  assertEquals(refreshed.status, 'connected');
  assertEquals(refreshed.encrypted_access_token, 'enc-access-2');
  assertEquals(connectionStatus([{ ...refreshed, id: 'c1' }], store, '2026-10-24').status, 'connected');
});

Deno.test('callback and redirect inputs stay on the app', () => {
  assertEquals(callbackIntent(query({})).outcome, 'invalid');
  assertEquals(callbackIntent(query({ code: 'c' })).outcome, 'invalid');

  assertEquals(safeReturnPath('/onboarding?store_id=store_1', '/fallback'), '/onboarding?store_id=store_1');
  assertEquals(safeReturnPath('https://evil.example/steal', '/fallback'), '/fallback');
  assertEquals(safeReturnPath('//evil.example', '/fallback'), '/fallback');
  assertEquals(safeReturnPath('/\\evil.example', '/fallback'), '/fallback');
  assertEquals(safeReturnPath('', '/fallback'), '/fallback');

  assertEquals(cloverCallbackUrl('https://alcohol-delivered-0c72f042.base44.app/'), 'https://alcohol-delivered-0c72f042.base44.app/functions/connectStoreClover');
  assertThrowsMessage(() => cloverCallbackUrl(''), 'app address is unavailable');
});

Deno.test('the callback redirect is absolute and can never leave the app', () => {
  // Absolute, so the browser can follow it straight from Clover.
  assertEquals(
    callbackRedirectTarget('https://alcohol-delivered-0c72f042.base44.app', '/onboarding?store_id=store_1', 'connected', 'Connected Woodlands Fine Wine & Spirits.'),
    'https://alcohol-delivered-0c72f042.base44.app/onboarding?store_id=store_1&clover=connected&message=Connected+Woodlands+Fine+Wine+%26+Spirits.',
  );
  // No usable origin header: the published app origin is used instead.
  assertEquals(
    callbackRedirectTarget('', '/onboarding', 'cancelled', 'Cancelled.', 'https://published.example.app'),
    'https://published.example.app/onboarding?clover=cancelled&message=Cancelled.',
  );
  // Off-app return paths fall back to the onboarding page on the app origin.
  assertEquals(
    callbackRedirectTarget('https://alcohol-delivered-0c72f042.base44.app', 'https://evil.example/x', 'error', 'nope'),
    'https://alcohol-delivered-0c72f042.base44.app/onboarding?clover=error&message=nope',
  );
  // A relative or unset origin on both sides yields no redirect at all (never a runtime host).
  assertEquals(callbackRedirectTarget('', '/onboarding', 'error', ''), '');
  assertEquals(callbackRedirectTarget('http://insecure.example', '/onboarding', 'error', ''), '');
});

function assertThrowsMessage(fn, expected) {
  let message = '';
  try {
    fn();
  } catch (error) {
    message = error.message;
  }
  assert(message, 'expected a thrown error');
  assert(message.includes(expected), `expected "${message}" to include "${expected}"`);
}