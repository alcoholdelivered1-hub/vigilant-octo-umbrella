import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';
import { requireUnambiguousRetailer, setupError, setupStore } from '../../shared/retailerSetupAccess.ts';
import {
  cloverCallbackUrl, connectionStatus, safeReturnPath, signState, STATE_TTL_MINUTES,
} from '../../shared/cloverOAuth.ts';

// Reports the saved register state for one store, or starts Clover authorization for
// that store's own merchant. Only an administrator or the store's own contacts may ask.
export default async function(req) {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'You must be signed in to connect a Clover register.' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const store = await setupStore(base44, user, body.store_id);
    const today = new Date().toISOString().slice(0, 10);
    const rows = await base44.asServiceRole.entities.CloverConnection.filter({ store_id: store.id });
    const status = connectionStatus(rows, store, today);

    if (body.action === 'status') return Response.json({ status });

    // A duplicate or ambiguous retailer record must be resolved before any credential is stored.
    await requireUnambiguousRetailer(base44, store);

    const fallbackPath = `/onboarding?store_id=${encodeURIComponent(store.id)}`;
    const payload = {
      store_id: store.id,
      user_email: user.email,
      return_path: safeReturnPath(body.return_path, fallbackPath),
      nonce: crypto.randomUUID(),
      exp: Date.now() + STATE_TTL_MINUTES * 60 * 1000,
    };
    const state = await signState(payload, secrets.get('CLOVER_APP_SECRET'));
    const redirectUri = cloverCallbackUrl(req.headers.get('X-Base44-App-Url'));

    // No merchant_id is sent: the retailer signs in to Clover and authorizes their own merchant.
    const authorizeUrl = new URL('https://www.clover.com/oauth/v2/authorize');
    authorizeUrl.search = new URLSearchParams({
      client_id: secrets.get('CLOVER_APP_ID'),
      redirect_uri: redirectUri,
      state,
    }).toString();

    return Response.json({ authorize_url: authorizeUrl.toString(), status });
  } catch (error) {
    console.error('Store Clover authorization error:', error.message);
    return Response.json({ error: error.message || 'Unable to start Clover authorization.' }, { status: error.status || 500 });
  }
}