import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';
import { getRetailerStripeAccount, retailerPaymentsReady, retailerStripeRequest } from '../../shared/retailerStripe.ts';
import { retailerOnboardingProgress } from '../../shared/retailerOnboardingProgress.ts';
import { loadStoreReadiness } from '../../shared/storeReadiness.ts';
import { webhookStatus } from '../../shared/readiness/paymentWebhookPolicy.ts';
import { retailerLaunchPreviews } from '../../shared/retailerLaunchPreviews.ts';
import { requireFinalRetailerApproval } from '../../shared/retailerDocumentGates.ts';
import { retailerProviderChecks } from '../../shared/retailerProviderChecks.ts';
import { allSetupRecords } from '../../shared/retailerSetupAccess.ts';

const APP_URL = 'https://alcohol-delivered-0c72f042.base44.app';

export default async function(req) {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Sign in required' }, { status: 401 });
    const { store_id, activate = false, action, preview_only = false, automatic = false, consent, final_consent } = await req.json();
    if ((automatic === true || action === 'auto_launch') && user.role !== 'admin') return Response.json({ error:'Only administrators may run automatic launch checks.' },{ status:403 });
    if (activate === true && (user.role !== 'admin' || (automatic !== true && final_consent !== true))) return Response.json({ error:'Explicit final administrator approval is required to activate a store.' },{ status:403 });
    const isAdmin = user.role === 'admin';
    const requestActivation = action === 'request_activation';
    const requestedAt = new Date().toISOString();
    if (action === 'preview_batch') {
      if (preview_only !== true || activate !== false || automatic !== false || consent !== undefined || store_id !== undefined) return Response.json({ error: 'Batch previews are read-only.' }, { status: 400 });
      const results = await retailerLaunchPreviews(base44, user, Boolean(secrets.get('STRIPE_WEBHOOK_SECRET')));
      return Response.json({ results, preview: true, activated: false });
    }
    if (requestActivation && (consent !== true || preview_only !== false || automatic !== false || activate !== false)) return Response.json({ error: 'Confirm your authorization before requesting activation.' }, { status: 400 });
    if (!isAdmin && !requestActivation && (preview_only !== true || activate !== false || action || automatic !== false || typeof store_id !== 'string' || !store_id)) {
      return Response.json({ error: 'Only your own read-only onboarding checklist is available.' }, { status: 403 });
    }
    if (store_id !== undefined && (typeof store_id !== 'string' || store_id.length > 100)) return Response.json({ error: 'Invalid store selection' }, { status: 400 });
    if (action === 'auto_launch') {
      const pendingStatuses = ['pending', 'invited', 'contract_sent', 'contract_signed', 'inventory_added'];
      const results = [];
      const approvedStoreIds = new Set();
      if (preview_only !== true) {
        const approvals = await allSetupRecords(base44.asServiceRole.entities.RetailerSetupSubmission, { step:'launch',status:'approved' });
        for (const approval of approvals) approvedStoreIds.add(approval.store_id);
      }
      // Snapshot candidates before activation changes the pending-store query.
      const candidates = store_id
        ? [await base44.asServiceRole.entities.Store.get(store_id)]
        : await allSetupRecords(base44.asServiceRole.entities.Store, { onboarding_status: { $in: pendingStatuses } }, 'created_date');
      for (const candidate of candidates) {
          if (!candidate || !pendingStatuses.includes(candidate.onboarding_status)) continue;
          if (preview_only === true) {
            results.push({ id: candidate.id, name: candidate.name });
            continue;
          }
          if (!approvedStoreIds.has(candidate.id)) {
            results.push({ store_id:candidate.id,store_name:candidate.name,ready:false,activated:false,blockers:['Submit for launch review and obtain final administrator approval before automatic activation.'] });
            continue;
          }
          // Each store finishes independently; one failed check cannot stop other retailers.
          try {
            const result = await base44.functions.invoke('retailerGoLive', { store_id: candidate.id, activate: true, automatic: true });
            if (result.data?.error) throw new Error(result.data.error);
            results.push({ store_id: candidate.id, ...result.data });
          } catch (error) {
            console.error('Automatic launch check failed:', candidate.id, error.message);
            results.push({ store_id: candidate.id, store_name: candidate.name, activated: false, error: error.message });
          }
      }
      return Response.json(preview_only === true ? { preview: true, activated: false, stores: results } : { results });
    }
    if (!store_id) return Response.json({ error: 'store_id is required' }, { status: 400 });
    const store = await base44.asServiceRole.entities.Store.get(store_id);
    if (!store) return Response.json({ error: 'Store not found' }, { status: 404 });
    const email = user.email?.trim().toLowerCase();
    const ownsStore = Boolean(email && [store.email, ...(store.contact_emails || [])].some(contact => typeof contact === 'string' && contact.trim().toLowerCase() === email));
    if (!isAdmin && !ownsStore) return Response.json({ error: 'You do not have access to this store’s onboarding checklist.' }, { status: 403 });
    if (requestActivation) {
      const result = await base44.functions.invoke('retailerSetup', { action:'request_review',store_id,consent });
      return Response.json(result.data);
    }
    const launchRequested = activate === true;
    if (launchRequested) {
      try { await requireFinalRetailerApproval(base44,store); }
      catch (error) {
        if (automatic !== true) throw error;
        return Response.json({ ready:false,activated:false,store_name:store.name,blockers:[error.message] });
      }
    }
    const finish = async result => {
      if (requestActivation) await base44.asServiceRole.entities.RetailerActivationRequest.create({
        store_id: store.id, store_name: store.name,
        contact_emails: [...new Set([store.email, ...(store.contact_emails || [])].filter(Boolean))],
        requested_by: user.email, requested_at: requestedAt, consent_version: 'activation_request_v1',
        status: result.activated ? 'activated' : 'blocked', blockers: result.blockers || [],
      });
      return Response.json(result);
    };
    if (automatic === true && !['pending', 'invited', 'contract_sent', 'contract_signed', 'inventory_added'].includes(store.onboarding_status)) {
      return Response.json({ skipped: true, activated: false, store_name: store.name, reason: 'Store is not awaiting initial launch' });
    }
    // Retain all stronger Beverage King gates on the canonical merchant.
    if (activate === true && /beverage king/i.test(store.name)) {
      const result = await base44.functions.invoke('beverageKingGoLive',{ action:'check',store_id:store.id,activate:true,final_consent:true });
      return Response.json(result.data);
    }
    const readiness = await loadStoreReadiness(base44, store);
    const blockers = readiness.blockers;
    // Dashboard previews are read-only and never contact live payment services or activate a store.
    if (preview_only === true) {
      const progress = retailerOnboardingProgress(store, blockers, Boolean(secrets.get('STRIPE_WEBHOOK_SECRET')), readiness);
      if (!isAdmin) progress.checks = progress.checks.map(check => ({ ...check, href: `/onboarding?store_id=${encodeURIComponent(store.id)}` }));
      return Response.json(progress);
    }
    // Automatic checks stop at unresolved setup requirements without polling payments unnecessarily.
    if (requestActivation && !/^acct_[A-Za-z0-9]+$/.test(store.stripe_connect_account_id || '')) blockers.push('Connect this retailer’s own Stripe account before accepting payments.');
    if ((automatic === true || requestActivation) && blockers.length) return await finish({ ready: false, activated: false, blockers, store_name: store.name });
    // Beverage King must also pass every existing merchant-specific Clover, payment and notification check.
    if ((automatic === true || requestActivation) && store.email?.toLowerCase() === 'bevking71603@gmail.com') {
      const result = await base44.functions.invoke('beverageKingGoLive', { action: launchRequested ? 'check' : 'preview' });
      if (result.data?.error) throw new Error(result.data.error);
      return await finish(requestActivation
        ? { ready: result.data.ready, activated: result.data.activated, blockers: result.data.blockers, store_name: store.name }
        : { ...result.data, store_name: store.name });
    }
    const providerResult = await retailerProviderChecks(base44,store);
    blockers.push(...providerResult.blockers);
    let paymentReady = false;
    try {
      paymentReady = retailerPaymentsReady(await getRetailerStripeAccount(store));
      if (!paymentReady) blockers.push('The retailer must complete Stripe identity verification and bank setup.');
    } catch (error) { blockers.push(error.message); }
    // One webhook rule set, shared with the compliance dashboard.
    const endpoints = await retailerStripeRequest('/webhook_endpoints?limit=100');
    const webhook = webhookStatus({ secretConfigured: Boolean(secrets.get('STRIPE_WEBHOOK_SECRET')), endpoints: endpoints.data, appUrl: APP_URL });
    if (!webhook.ready) blockers.push('Configure retailer-payment webhook delivery before launch.');
    const ready = blockers.length === 0;
    if (launchRequested && ready) await base44.asServiceRole.entities.Store.update(store.id, {
      is_active: true, onboarding_status: 'live', stripe_connection_status: 'connected',
      stripe_connected_at: new Date().toISOString(),
    });
    return await finish({ ready, activated: Boolean(launchRequested && ready), blockers, store_name: store.name });
  } catch (error) {
    console.error('Retailer go-live error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}