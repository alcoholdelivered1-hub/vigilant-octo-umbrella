import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';
import { allSetupRecords } from '../../shared/retailerSetupAccess.ts';
import { encryptToken } from '../../shared/cloverConnection.ts';
import {
  callbackIntent, callbackRedirectTarget, connectionAction, connectionRecord, merchantConflict,
  merchantFromResponse, safeReturnPath, tokenFromResponse, verifyState,
} from '../../shared/cloverOAuth.ts';

const FALLBACK_PATH = '/onboarding';
const PUBLISHED_APP_ORIGIN = 'https://alcohol-delivered-0c72f042.base44.app';

// Clover sends the retailer's browser directly to this function, so the redirect back to
// the app has to be absolute. It is built from the server-set app origin and a same-origin
// path only, never from the request host.
function redirectResult(req, path, status, message = '') {
  const target = callbackRedirectTarget(
    req.headers.get('X-Base44-App-Url'),
    path,
    status,
    message,
    PUBLISHED_APP_ORIGIN,
  );
  if (!target) {
    console.error('Store Clover callback could not resolve an app origin to redirect to.');
    return new Response('Clover connection finished. Return to the app to review the register status.', {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
  return Response.redirect(target, 302);
}

export default async function(req) {
  let returnPath = FALLBACK_PATH;
  try {
    if (req.method !== 'GET') return Response.json({ error: 'Method not allowed' }, { status: 405 });

    const url = new URL(req.url);
    const intent = callbackIntent(url.searchParams);

    // The signed state is the only proof of which store this authorization belongs to.
    let payload = null;
    let stateError = '';
    const rawState = url.searchParams.get('state') || '';
    if (rawState) {
      try {
        payload = await verifyState(rawState, { secret: secrets.get('CLOVER_APP_SECRET') });
        returnPath = safeReturnPath(payload.return_path, FALLBACK_PATH);
      } catch (error) {
        stateError = error.message;
      }
    }

    if (intent.outcome === 'cancelled') return redirectResult(req, returnPath, 'cancelled', intent.message);
    if (intent.outcome === 'invalid') return redirectResult(req, returnPath, 'error', intent.message);
    if (!payload) {
      return redirectResult(req, returnPath, 'error', stateError || 'Start the Clover connection from the store setup page.');
    }

    const base44 = createClientFromRequest(req);
    const store = await base44.asServiceRole.entities.Store.get(payload.store_id);
    if (!store) return redirectResult(req, returnPath, 'error', 'This retailer record no longer exists.');

    const tokenResponse = await fetch('https://api.clover.com/oauth/v2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: secrets.get('CLOVER_APP_ID'),
        client_secret: secrets.get('CLOVER_APP_SECRET'),
        code: intent.code,
      }),
      signal: AbortSignal.timeout(15000),
    });
    const tokenBody = await tokenResponse.json().catch(() => ({}));
    const token = tokenFromResponse(tokenResponse.ok, tokenBody);

    const merchantId = token.merchant_id || url.searchParams.get('merchant_id') || tokenBody.merchant_id || '';
    if (!merchantId) return redirectResult(req, returnPath, 'error', 'Clover did not report a merchant for this authorization.');

    const merchantResponse = await fetch(`https://api.clover.com/v3/merchants/${encodeURIComponent(merchantId)}`, {
      headers: { Authorization: `Bearer ${token.access_token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
    const merchantBody = await merchantResponse.json().catch(() => ({}));
    const merchant = merchantFromResponse(merchantResponse.ok, merchantBody, merchantId);

    const connections = await allSetupRecords(base44.asServiceRole.entities.CloverConnection);
    const conflict = merchantConflict(connections, merchant.id, store.id);
    if (conflict) return redirectResult(req, returnPath, 'wrong-account', conflict);

    const encryptedAccess = await encryptToken(token.access_token);
    const encryptedRefresh = await encryptToken(token.refresh_token);
    const record = connectionRecord({
      storeId: store.id,
      merchant,
      token,
      encryptedAccess,
      encryptedRefresh,
      now: new Date().toISOString(),
    });

    const storeRows = connections.filter(row => row.store_id === store.id);
    const target = connectionAction(storeRows, store.id);
    if (target.action === 'update') {
      await base44.asServiceRole.entities.CloverConnection.update(target.id, record);
    } else {
      await base44.asServiceRole.entities.CloverConnection.create(record);
    }

    return redirectResult(req, returnPath, 'connected', `Connected ${merchant.name}.`);
  } catch (error) {
    console.error('Store Clover connection error:', error.message);
    return redirectResult(req, returnPath, 'error', error.message);
  }
}