/**
 * Admin-only. Clears a store's stored Clover credential (api_token,
 * refresh_token, merchant_id) and marks it not configured.
 *
 * Use when the stored credential is scoped to the WRONG merchant — e.g.
 * Beverage King's record currently holds the platform's "Alcohol Delivered LLC"
 * token — so that background syncs (the every-10-minutes inventory workflow)
 * stop pulling/pushing against the wrong POS until a proper merchant-scoped
 * OAuth (cloverOAuthExchange) is completed.
 *
 * POST body: { store_id?: string }  (defaults to Beverage King)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { BEVERAGE_KING_STORE_ID } from '../../shared/cloverCredentials.ts';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const storeId = body.store_id || BEVERAGE_KING_STORE_ID;

    const cred = (await base44.asServiceRole.entities.StorePosCredential.filter({ store_id: storeId }))[0];
    if (!cred) {
      return Response.json({ cleared: false, reason: 'No Clover credential on file for this store', store_id: storeId });
    }

    await base44.asServiceRole.entities.StorePosCredential.update(cred.id, {
      api_token: '',
      refresh_token: '',
      is_configured: false,
      notes: `Cleared by ${user.email} on ${new Date().toISOString()} — previous credential (merchant_id: ${cred.merchant_id || 'n/a'}) was scoped to the wrong merchant. Re-authorize via merchant-scoped OAuth.`,
    });

    return Response.json({
      cleared: true,
      store_id: storeId,
      previous_merchant_id: cred.merchant_id || null,
      next_step: 'Complete merchant-scoped OAuth (cloverOAuthExchange) logged in as the store\'s own Clover merchant to re-connect.',
    });
  } catch (error) {
    console.error('resetStoreCloverCredential error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
