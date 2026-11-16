import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { findBeverageKingStores } from '../../shared/beverageKingStore.ts';
import { secrets } from 'base44:runtime';

import { beverageKingLaunchChecklist } from '../../shared/beverageKingLaunchChecklist.ts';
import { requireFinalRetailerApproval } from '../../shared/retailerDocumentGates.ts';
import { readRetailerLaunchEvidence } from '../../shared/readRetailerLaunchEvidence.ts';
import { requireUnambiguousRetailer } from '../../shared/retailerSetupAccess.ts';
import { driverIsProductionQualified, taxEvidenceIsComplete } from '../../shared/verifiedTaxDriverReadiness.ts';
import { attachDriverCompliance } from '../../shared/driverAnnualCompliance.ts';

const storeId = '6a32d14d09b760f592dbf19e';
const expectedMerchantId = 'YJSBZTD0WJ201';
const webhookUrl = 'https://alcohol-delivered-0c72f042.base44.app/functions/stripeWebhook';
const publicGoLiveUrl = 'https://alcohol-delivered.biz/admin/beverage-king-golive';

const fetchWithTimeout = (url, options = {}, timeoutMs = 6000) =>
  fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });

export default async function(req) {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    if (body.action && !['check', 'preview', 'stripe_reconnect'].includes(body.action)) {
      return Response.json({ error: 'Invalid action' }, { status: 400 });
    }
    const previewOnly = body.activate !== true;
    if (!previewOnly && (user.role !== 'admin' || body.final_consent !== true)) return Response.json({ error:'Final administrator approval and explicit activation consent are required.' },{ status:403 });
    const stores = await findBeverageKingStores(base44);
    if (stores.length !== 1) return Response.json({ error:'Beverage King ownership is ambiguous; resolve the canonical store before continuing.' },{ status:409 });
    const store = stores[0];
    if (body.store_id && body.store_id !== store.id) return Response.json({ error:'The selected store is not the canonical Beverage King record.' },{ status:409 });
    await requireUnambiguousRetailer(base44,store);
    if (!store) return Response.json({ error: 'Beverage King store record was not found' }, { status: 404 });
    const email = user.email?.trim().toLowerCase();
    const ownsStore = Boolean(email && [store.email, ...(store.contact_emails || [])].some(contact => contact?.trim().toLowerCase() === email));
    if (user.role !== 'admin' && !ownsStore) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const resolvedStoreId = store.id;
    if (!previewOnly) await requireFinalRetailerApproval(base44,store);

    // Reuse this already-working authenticated go-live endpoint to create the
    // Beverage King Stripe onboarding link. This avoids losing the Base44
    // session when navigating directly to a separate function route.
    if (body?.action === 'stripe_reconnect') {
      const stripeHeaders = {
        Authorization: `Bearer ${secrets.get('STRIPE_SECRET_KEY')}`,
        'Stripe-Version': '2025-10-29.clover',
      };
      const appReturnUrl = publicGoLiveUrl;
      const accountId = store?.stripe_connect_account_id || '';
      if (accountId) {
        const accountResponse = await fetchWithTimeout(`https://api.stripe.com/v1/accounts/${accountId}`, { headers: stripeHeaders });
        const account = await accountResponse.json().catch(() => ({}));
        const accountName = account?.business_profile?.name || account?.company?.name || '';
        const accountEmail = account?.email?.toLowerCase() || '';
        const accountMatchesStore = /beverage king/i.test(accountName)
          && accountEmail === store.email?.toLowerCase();

        if (accountResponse.ok && accountMatchesStore) {
          const linkResponse = await fetchWithTimeout('https://api.stripe.com/v1/account_links', {
            method: 'POST',
            headers: { ...stripeHeaders, 'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': crypto.randomUUID() },
            body: new URLSearchParams({
              account: accountId,
              type: 'account_onboarding',
              refresh_url: appReturnUrl,
              return_url: `${appReturnUrl}?stripe_reconnected=success`,
            }),
          });
          const link = await linkResponse.json();
          if (linkResponse.ok) return Response.json({ stripe_onboarding_url: link.url });
          return Response.json({
            error: `Stripe could not create an onboarding link: ${link?.error?.message || 'unknown error'}.`,
          }, { status: 502 });
        }

        if (!accountResponse.ok) {
          return Response.json({
            error: `The mapped Stripe account is not accessible: ${account?.error?.message || 'Stripe rejected the request'}.`,
          }, { status: 409 });
        }
      }

      return Response.json({
        error: accountId
          ? 'The mapped Stripe account name or owner email does not match Beverage King. Confirm the account before reconnecting; no new account was created.'
          : 'No existing Beverage King Stripe account is mapped. Map the verified retailer account before reconnecting; no new account was created.',
      }, { status: 409 });
    }

    const checks = {
      store_found: Boolean(store),
      retailer_agreement_signed: false,
      test_order_passed: false,
      compliance_clear: store?.compliance_status === 'compliant',
      license_present: Boolean(store?.license_number),
      abc_delivery_permit_documented: false,
      city_business_license_documented: false,
      tax_confirmation_recorded: false,
      inventory_synced: false,
      stripe_account_accessible: false,
      stripe_account_matches_store: false,
      stripe_details_submitted: false,
      stripe_charges_enabled: false,
      stripe_payouts_enabled: false,
      stripe_store_mapping: store?.stripe_connection_status === 'connected',
      webhook_active: false,
      webhook_secret_configured: false,
      firebase_service_account_configured: false,
      retailer_push_token_registered: false,
      available_driver_with_push: false,
    };
    const details = {
      store_id: resolvedStoreId,
      store_name: store?.name || null,
      compliance_status: store?.compliance_status || null,
      verified_inventory_count: 0,
      retailer_push_tokens: 0,
      available_drivers: 0,
      available_drivers_with_push: 0,
      stripe_account_id: store?.stripe_connect_account_id || null,
      abc_permit_number: null,
      abc_permit_expires: null,
      city_license_number: null,
      city_license_expires: null,
      tax_confirmation_source: null,
    };

    const onboarding = await base44.asServiceRole.entities.RetailerOnboarding.filter({ name: store.name }, '-updated_date', 1);
    const signedAgreements = await base44.asServiceRole.entities.RetailerAgreement.filter({ store_id: resolvedStoreId, status: 'submitted' }, '-submitted_at', 1);
    checks.retailer_agreement_signed = onboarding[0]?.agreement_signed === true || signedAgreements.some(a => a.file_uri && a.submitted_at && a.terms_hash && a.fields?.signature);
    checks.test_order_passed = onboarding[0]?.test_order_passed === true;
    const today = new Date().toISOString().slice(0, 10);
    const permitIsCurrent = (permit) => permit?.status === 'active'
      && permit.document_on_file === true
      && Boolean(permit.permit_number)
      && Boolean(permit.issue_date)
      && Boolean(permit.expiration_date)
      && permit.issue_date <= today
      && permit.expiration_date >= today;
    const permits = await base44.asServiceRole.entities.BusinessPermit.list();
    const abcPermit = permits.find((permit) => permit.permit_type === 'arkansas_abc_third_party_delivery' && permit.permit_number === '27500-01');
    const cityLicense = permits.find((permit) => permit.permit_type === 'city_business_license' && permit.permit_number === '1563');
    checks.abc_delivery_permit_documented = permitIsCurrent(abcPermit);
    checks.city_business_license_documented = permitIsCurrent(cityLicense);
    details.abc_permit_number = abcPermit?.permit_number || null;
    details.abc_permit_expires = abcPermit?.expiration_date || null;
    details.city_license_number = cityLicense?.permit_number || null;
    details.city_license_expires = cityLicense?.expiration_date || null;

    const taxConfirmations = await base44.asServiceRole.entities.TaxConfirmation.filter({ store_id: resolvedStoreId, status: 'confirmed' }, '-confirmed_at', 1);
    const taxConfirmation = taxConfirmations?.[0];
    checks.tax_confirmation_recorded = taxEvidenceIsComplete(taxConfirmation);
    details.tax_confirmation_source = checks.tax_confirmation_recorded ? taxConfirmation.source : null;

    try {
      const syncedProducts = await base44.asServiceRole.entities.Product.filter({
        store_id: resolvedStoreId,
        inventory_source: { $in: ['liquor_bee', 'csv'] },
        in_stock: true,
      }, '-last_synced_at', 5000);
      details.verified_inventory_count = syncedProducts.length;
      checks.inventory_synced = syncedProducts.length > 0;
    } catch (error) {
      details.inventory_error = error.message;
    }

    let stripeHeaders = null;
    let stripeReconnectUrl = null;
    try {
      const stripeSecret = secrets.get('STRIPE_SECRET_KEY');
      if (!stripeSecret) throw new Error('STRIPE_SECRET_KEY is not configured');
      stripeHeaders = {
        Authorization: `Bearer ${stripeSecret}`,
        'Stripe-Version': '2025-10-29.clover',
      };
    } catch (error) {
      details.stripe_error = error.message || 'Stripe credentials are not configured';
    }

    if (stripeHeaders && store?.stripe_connect_account_id) {
      try {
        const accountResponse = await fetchWithTimeout(`https://api.stripe.com/v1/accounts/${store.stripe_connect_account_id}`, { headers: stripeHeaders });
        const account = await accountResponse.json();
        checks.stripe_account_accessible = accountResponse.ok;
        const stripeName = account?.business_profile?.name || account?.company?.name || '';
        checks.stripe_account_matches_store = accountResponse.ok
          && /beverage king/i.test(stripeName)
          && account?.email?.toLowerCase() === store.email?.toLowerCase();
        checks.stripe_details_submitted = accountResponse.ok && account.details_submitted === true;
        checks.stripe_charges_enabled = accountResponse.ok && account.charges_enabled === true;
        checks.stripe_payouts_enabled = accountResponse.ok && account.payouts_enabled === true;
        const stripeReady = checks.stripe_account_accessible
          && checks.stripe_account_matches_store
          && checks.stripe_details_submitted
          && checks.stripe_charges_enabled
          && checks.stripe_payouts_enabled;
        if (stripeReady) {
          checks.stripe_store_mapping = true;
          if (!previewOnly && store.stripe_connection_status !== 'connected') {
            await base44.asServiceRole.entities.Store.update(resolvedStoreId, {
              stripe_connection_status: 'connected',
              stripe_connected_at: new Date().toISOString(),
            });
            details.stripe_store_mapping_updated = true;
          }
        }
        if (!accountResponse.ok) {
          details.stripe_error = account.error?.message || 'Stripe account is not accessible';
        }
      } catch (error) {
        details.stripe_error = error.name === 'TimeoutError'
          ? 'Stripe account check timed out'
          : (error.message || 'Stripe account check failed');
      }
    }

    if (stripeHeaders) {
      try {
        const webhookResponse = await fetchWithTimeout('https://api.stripe.com/v1/webhook_endpoints?limit=100', { headers: stripeHeaders });
        const webhooks = await webhookResponse.json();
        checks.webhook_active = webhookResponse.ok && Array.isArray(webhooks.data)
          && webhooks.data.some((endpoint) => endpoint.url === webhookUrl && endpoint.status === 'enabled'
            && (endpoint.enabled_events?.includes('*') || (
              endpoint.enabled_events?.includes('checkout.session.completed')
              && endpoint.enabled_events?.includes('checkout.session.async_payment_succeeded')
              && endpoint.enabled_events?.includes('account.updated')
              )));
        if (!webhookResponse.ok) details.webhook_error = webhooks?.error?.message || 'Stripe webhook check failed';
      } catch (error) {
        details.webhook_error = error.name === 'TimeoutError'
          ? 'Stripe webhook check timed out'
          : (error.message || 'Stripe webhook check failed');
      }
    }
    try {
      checks.webhook_secret_configured = Boolean(secrets.get('STRIPE_WEBHOOK_SECRET'));
    } catch {
      checks.webhook_secret_configured = false;
    }

    try {
      const firebase = JSON.parse(secrets.get('FIREBASE_SERVICE_ACCOUNT') || '{}');
      checks.firebase_service_account_configured = firebase.type === 'service_account' && Boolean(firebase.project_id && firebase.client_email && firebase.private_key?.includes('BEGIN PRIVATE KEY'));
    } catch {
      checks.firebase_service_account_configured = false;
    }
    const retailerTokens = await base44.asServiceRole.entities.FCMToken.filter({ store_id: resolvedStoreId });
    details.retailer_push_tokens = retailerTokens.length;
    checks.retailer_push_token_registered = retailerTokens.length > 0;

    const availableDrivers = await base44.asServiceRole.entities.Driver.filter({
      is_active: true,
      status: 'available',
      training_completed: true,
      background_check_status: 'clear',
    });
    const qualifiedDrivers = (await attachDriverCompliance(base44, availableDrivers)).filter(driverIsProductionQualified);
    details.available_drivers = qualifiedDrivers.length;
    for (const driver of qualifiedDrivers) {
      if (!driver.email) continue;
      const driverTokens = await base44.asServiceRole.entities.FCMToken.filter({ user_email: driver.email });
      if (driverTokens.length > 0) details.available_drivers_with_push += 1;
    }
    checks.available_driver_with_push = details.available_drivers_with_push > 0;

    const labels = {
      retailer_agreement_signed: 'The retailer partner agreement must be signed',
      test_order_passed: 'Admin must complete and record a sandbox payment, retailer notification and delivery handoff test',
      compliance_clear: 'Store compliance status must be compliant',
      license_present: 'Store license number is missing',
      abc_delivery_permit_documented: 'Arkansas ABC third-party delivery permit 27500-01 must be documented and current',
      city_business_license_documented: 'Pine Bluff business license 1563 must be documented and current',
      tax_confirmation_recorded: 'Record DFA Sales Tax confirmation and verify the destination/category checkout calculation before orders',
      inventory_synced: 'Download inventory from Liquor Bee (API key or CSV upload) so Beverage King products are available',
      stripe_account_accessible: 'Beverage King Stripe account is not accessible',
      stripe_account_matches_store: 'The mapped Stripe account name and owner email must match Beverage King',
      stripe_details_submitted: 'Stripe verification details are incomplete',
      stripe_charges_enabled: 'Stripe charges are not enabled',
      stripe_payouts_enabled: 'Stripe payouts are not enabled',
      stripe_store_mapping: 'Store is not mapped to a connected Stripe account',
      webhook_active: 'Stripe connected-account webhook endpoint is not active',
      webhook_secret_configured: 'Stripe webhook signing secret is not configured',
      firebase_service_account_configured: 'Firebase service account JSON is not configured for HTTP v1 push notifications',
      retailer_push_token_registered: 'Beverage King must enable notifications on its current store device',
      available_driver_with_push: 'An available, trained driver needs a real completed clearance report, verified age/license/vehicle and notifications',
    };
    const blockers = Object.entries(labels).filter(([key]) => !checks[key]).map(([, label]) => label);
    blockers.push(...await readRetailerLaunchEvidence(base44,store));

    let activated = false;
    if (blockers.length === 0 && !previewOnly) {
      await base44.asServiceRole.entities.Store.update(resolvedStoreId, {
        is_active: true,
        onboarding_status: 'live',
        compliance_notes: '',
      });
      const approvals = await base44.asServiceRole.entities.StoreLaunchApproval.filter({ store_id: resolvedStoreId, check_version: 'beverage_king_v1' }, '-approved_at', 1);
      if (!approvals.length) await base44.asServiceRole.entities.StoreLaunchApproval.create({ store_id: resolvedStoreId, check_version: 'beverage_king_v1', approved_at: new Date().toISOString() });
      activated = true;
    }
    const checklist = beverageKingLaunchChecklist(checks);

    return Response.json({
      ready: blockers.length === 0,
      activated,
      blockers,
      checks,
      details,
      checklist,
      done: checklist.filter(item => item.done).length,
      total: checklist.length,
      is_admin: user.role === 'admin',
      stripe_reconnect_url: stripeReconnectUrl,
      resulting_store_status: activated ? { is_active: true, onboarding_status: 'live' } : { is_active: store?.is_active ?? null, onboarding_status: store?.onboarding_status ?? null },
    });
  } catch (error) {
    console.error('Beverage King go-live error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}