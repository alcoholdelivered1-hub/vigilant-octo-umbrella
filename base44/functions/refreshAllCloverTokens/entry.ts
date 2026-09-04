/**
 * refreshAllCloverTokens
 * Proactively refreshes every store's Clover v2 access_token using its stored
 * refresh_token. Clover v2 access_tokens are short-lived; this keeps connections
 * alive without waiting for a 401. Designed to run on a daily schedule (service
 * role — no user auth), but also safe to invoke manually from admin tooling.
 *
 * POST body: (none) — refreshes all eligible Clover credentials.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { refreshCloverToken } from '../../shared/cloverCredentials.ts';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);

    const creds = await base44.asServiceRole.entities.StorePosCredential.list('-created_date', 500);

    const eligible = creds.filter(
      (c) => (c.pos_system || 'clover') === 'clover' && (c.refresh_token || c.api_secret || '').trim(),
    );

    let refreshed = 0;
    let failed = 0;
    let skipped = 0;
    const details = [];

    for (const c of eligible) {
      const r = await refreshCloverToken(base44, c.store_id);
      if (r.refreshed) {
        refreshed += 1;
        details.push({ store_id: c.store_id, store_name: c.store_name, refreshed: true });
      } else {
        failed += 1;
        details.push({ store_id: c.store_id, store_name: c.store_name, refreshed: false, error: r.error });
      }
    }

    skipped = creds.length - eligible.length;

    return Response.json({
      success: true,
      total_credentials: creds.length,
      eligible: eligible.length,
      refreshed,
      failed,
      skipped_no_refresh_token: skipped,
      details,
    });
  } catch (error) {
    console.error('[refreshAllCloverTokens] error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}