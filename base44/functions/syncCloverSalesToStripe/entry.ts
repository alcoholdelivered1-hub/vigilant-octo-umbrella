import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import Stripe from 'npm:stripe@14.21.0';
import { BEVERAGE_KING_STORE_ID, resolveCloverCredentials, autoDiscoverMerchantId, findActiveCloverEnvironment } from '../../shared/cloverCredentials.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch (_) { /* scheduled run */ }
    if (user && user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'sync';
    const storeId = body.store_id || BEVERAGE_KING_STORE_ID;

    // Resolve Clover credentials from shared module
    const { apiToken: _apiToken, merchantId: _merchantId, tokenSource: _tokenSource, cred, envToken, envMerchantId, credToken, credMerchantId } = await resolveCloverCredentials(base44, storeId);
    let apiToken = _apiToken;
    let merchantId = _merchantId;
    let tokenSource = _tokenSource;

    // Auto-discover the correct merchant ID from the token if the stored one fails
    let merchantAutoDiscovered = false;
    if (apiToken) {
      const result = await autoDiscoverMerchantId(apiToken, merchantId);
      merchantId = result.merchantId;
      merchantAutoDiscovered = result.merchantAutoDiscovered;
    }

    // --- STATUS action: return sync state + recent synced invoices ---
    if (action === 'status') {
      const syncState = (await base44.asServiceRole.entities.CloverOrderSync.filter({ store_id: storeId }))[0] || null;

      // Validate token: test against both production and sandbox Clover REST API
      let tokenValid = false;
      let validEnvironment = null;
      if (apiToken && merchantId) {
        for (const env of ['production', 'sandbox']) {
          const baseUrl = env === 'production'
            ? `https://api.clover.com/v3/merchants/${merchantId}`
            : `https://sandbox.dev.clover.com/v3/merchants/${merchantId}`;
          try {
            const testResp = await fetch(baseUrl, {
              headers: { 'Authorization': `Bearer ${apiToken}` },
            });
            if (testResp.ok) {
              tokenValid = true;
              validEnvironment = env;
              break;
            }
          } catch (_) { /* try next environment */ }
        }
      }

      // If credential token is invalid, try env secret as fallback
      if (!tokenValid && credToken && envToken && credToken !== envToken) {
        for (const env of ['production', 'sandbox']) {
          const baseUrl = env === 'production'
            ? `https://api.clover.com/v3/merchants/${envMerchantId}`
            : `https://sandbox.dev.clover.com/v3/merchants/${envMerchantId}`;
          try {
            const testResp = await fetch(baseUrl, {
              headers: { 'Authorization': `Bearer ${envToken}` },
            });
            if (testResp.ok) {
              tokenValid = true;
              validEnvironment = env;
              tokenSource = 'env_secret';
              apiToken = envToken;
              merchantId = envMerchantId;
              break;
            }
          } catch (_) { /* try next */ }
        }
      }

      let recentInvoices = [];
      try {
        const searchResult = await stripe.invoices.search({
          query: "metadata['source']:'clover_pos'",
          limit: 20,
        });
        recentInvoices = searchResult.data.map(inv => ({
          id: inv.id,
          number: inv.number,
          total: inv.total,
          amount_paid: inv.amount_paid,
          currency: inv.currency,
          status: inv.status,
          created: new Date(inv.created * 1000).toISOString(),
          clover_order_id: inv.metadata?.clover_order_id || null,
          description: inv.description,
        }));
      } catch (e) {
        console.error('Failed to search Stripe invoices:', e.message);
      }

      let totalCloverRevenue = 0;
      try {
        // Sum all paid Clover-originated invoices
        let hasMore = true;
        let startingAfter = null;
        while (hasMore) {
          const params = { query: "metadata['source']:'clover_pos'", limit: 100 };
          if (startingAfter) params.starting_after = startingAfter;
          const batch = await stripe.invoices.search(params);
          for (const inv of batch.data) {
            if (inv.status === 'paid') totalCloverRevenue += inv.total;
          }
          hasMore = batch.has_more;
          if (batch.data.length > 0) startingAfter = batch.data[batch.data.length - 1].id;
          if (!hasMore || batch.data.length === 0) break;
        }
      } catch (e) {
        console.error('Failed to sum Clover revenue:', e.message);
      }

      // Masked token preview for diagnostics
      const tokenPreview = apiToken
        ? (apiToken.length <= 8 ? apiToken.substring(0, 4) + '...' : apiToken.substring(0, 4) + '...' + apiToken.substring(apiToken.length - 4))
        : null;
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      return Response.json({
        success: true,
        sync_state: syncState,
        recent_invoices: recentInvoices,
        total_clover_revenue_cents: totalCloverRevenue,
        clover_configured: !!(apiToken && merchantId),
        token_valid: tokenValid,
        token_source: tokenSource,
        valid_environment: validEnvironment,
        token_preview: tokenPreview,
        token_length: apiToken?.length || 0,
        token_is_uuid: apiToken ? uuidPattern.test(apiToken) : false,
        merchant_id: merchantId,
        merchant_auto_discovered: merchantAutoDiscovered,
      });
    }

    // --- SYNC action: pull paid Clover POS orders and mirror them as paid Stripe invoices ---
    // Idempotent: re-runs skip orders already mirrored (matched by clover_order_id metadata).
    if (action === 'sync') {
      const { baseUrl, activeEnv } = await findActiveCloverEnvironment(apiToken, merchantId);
      if (!baseUrl) {
        return Response.json({ success: false, error: 'Clover credentials did not authenticate (production or sandbox)' }, { status: 502 });
      }
      const headers = { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json' };
      const store = await base44.asServiceRole.entities.Store.get(storeId);
      const APP_ID = Deno.env.get('BASE44_APP_ID') || '';

      // Dedicated Stripe customer for POS mirroring (created once, reused).
      let syncState = (await base44.asServiceRole.entities.CloverOrderSync.filter({ store_id: storeId }))[0] || null;
      let customerId = syncState?.stripe_customer_id;
      if (!customerId) {
        const cust = await stripe.customers.create({
          name: `Clover POS — ${store.name}`,
          metadata: { source: 'clover_pos', store_id: storeId },
        });
        customerId = cust.id;
      }

      // Fetch Clover orders and keep only fully paid ones.
      const paidOrders = [];
      let offset = 0;
      const limit = 100;
      while (true) {
        const url = `${baseUrl}/orders?expand=payments&limit=${limit}&offset=${offset}`;
        const resp = await fetch(url, { headers });
        if (!resp.ok) {
          return Response.json({ success: false, error: `Clover /orders returned ${resp.status}` }, { status: 502 });
        }
        const orders = (await resp.json()).elements || [];
        for (const o of orders) {
          const payments = o.payments?.elements || [];
          const paidAmount = payments
            .filter(p => (p.result || 'SUCCESS') === 'SUCCESS')
            .reduce((s, p) => s + (p.amount || 0), 0);
          if (o.total > 0 && paidAmount >= o.total) paidOrders.push(o);
        }
        if (orders.length < limit) break;
        offset += limit;
        if (offset > 2000) break; // safety cap per run
      }

      // Dedup set: clover_order_ids already mirrored as Stripe invoices.
      const alreadyMirrored = new Set();
      let hasMore = true;
      let startingAfter = null;
      while (hasMore) {
        const params = { query: "metadata['source']:'clover_pos'", limit: 100 };
        if (startingAfter) params.starting_after = startingAfter;
        const batch = await stripe.invoices.search(params);
        for (const inv of batch.data) {
          if (inv.metadata?.clover_order_id) alreadyMirrored.add(inv.metadata.clover_order_id);
        }
        hasMore = batch.has_more;
        if (batch.data.length > 0) startingAfter = batch.data[batch.data.length - 1].id;
        if (!hasMore || batch.data.length === 0) break;
      }

      let created = 0;
      let skipped = 0;
      const errors = [];
      for (const o of paidOrders) {
        if (alreadyMirrored.has(o.id)) { skipped++; continue; }
        try {
          const inv = await stripe.invoices.create({
            customer: customerId,
            collection_method: 'send_invoice',
            auto_advance: false,
            description: `Clover POS Sale — Order ${o.id}`,
            metadata: {
              source: 'clover_pos',
              clover_order_id: o.id,
              store_id: storeId,
              ...(APP_ID ? { base44_app_id: APP_ID } : {}),
            },
          });
          await stripe.invoiceItems.create({
            customer: customerId,
            invoice: inv.id,
            amount: o.total,
            currency: o.currency || 'usd',
            description: `Clover POS Sale — Order ${o.id}`,
          });
          await stripe.invoices.finalizeInvoice(inv.id, { auto_advance: false });
          await stripe.invoices.pay(inv.id, { paid_out_of_band: true });
          created++;
        } catch (e) {
          errors.push(`${o.id}: ${e.message}`);
          console.error('[clover-sync] mirror failed for', o.id, e.message);
        }
      }

      const now = new Date().toISOString();
      const summary = `Synced ${created} new, skipped ${skipped} already mirrored, ${paidOrders.length} paid orders found.`;
      const statePayload = {
        store_id: storeId,
        stripe_customer_id: customerId,
        last_synced_at: now,
        total_synced: (syncState?.total_synced || 0) + created,
        last_sync_status: created > 0 || paidOrders.length === 0 ? 'success' : 'error',
        last_sync_summary: summary + (errors.length ? ` Errors: ${errors.length}.` : ''),
      };
      if (syncState) {
        await base44.asServiceRole.entities.CloverOrderSync.update(syncState.id, statePayload);
      } else {
        await base44.asServiceRole.entities.CloverOrderSync.create(statePayload);
      }

      return Response.json({
        success: true,
        action: 'sync',
        merchant_id: merchantId,
        environment: activeEnv,
        paid_orders_found: paidOrders.length,
        created,
        skipped_already_mirrored: skipped,
        errors: errors.slice(0, 20),
      });
    }

    return Response.json({
      error: `Action '${action}' is not supported. Use action: 'status' or 'sync'.`,
    }, { status: 400 });
  } catch (error) {
    console.error('syncCloverSalesToStripe error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});