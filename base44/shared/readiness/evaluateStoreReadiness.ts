import { READINESS_CHECKS } from './readinessChecks.ts';
import {
  agreementIsApproved, belongsToStore, cloverRequiredFor, cloverState, latestBy, licenseNumberIsValid,
  normalizeEmail, normalizeName, permitState, posProviderOf, readinessConfigSignature, sandboxState, taxReady, text,
} from './readinessEvidence.ts';
import { driverIsProductionQualified } from '../verifiedTaxDriverReadiness.ts';

// Evidence is sliced once, by store id, so every check evaluates this store's rows only.
export function scopedEvidence(index, store) {
  const all = index || {};
  const byStore = key => (all[key] || []).filter(row => row && row.store_id === store.id);
  const onboardingLinked = (all.onboarding || []).filter(row => row?.store_id === store.id);
  const legacyMatches = (all.onboarding || []).filter(row => !row?.store_id && normalizeName(row?.name) === normalizeName(store.name));
  return {
    submissions: byStore('submissions'),
    documents: byStore('documents'),
    agreements: byStore('agreements'),
    taxes: byStore('taxes'),
    cloverConnections: byStore('clover'),
    products: byStore('products'),
    coverage: byStore('coverage'),
    tokens: byStore('tokens'),
    permits: (all.permits || []).filter(row => belongsToStore(row, store)),
    onboardingRecords: [...onboardingLinked, ...legacyMatches],
    drivers: all.drivers || [],
    zones: all.zones || [],
  };
}

function status(state, reason, extra = {}) {
  return { status: state, reason, ...extra };
}

// Onboarding approval is the mechanism that maps evidence onto a store, so each
// information task also requires its reviewed version.
function approvedStep(evidence, key) {
  return (evidence.submissions || []).find(row => row.step === key && row.status === 'approved' && row.mapped_at) || null;
}

function approvedDocumentFor(evidence, step, kind) {
  if (!step) return false;
  const document = (evidence.documents || []).find(row => row.kind === kind);
  return Boolean(document && document.status === 'approved' && (step.document_ids || []).includes(document.id));
}

function evaluateCheck(key, { store, today, evidence, onboarding, agreement, posSubmission, posProvider, cloverConnection, signature, stripe, webhook }) {
  switch (key) {
    case 'profile': {
      const missing = [
        licenseNumberIsValid(store.license_number) ? null : 'a verified license number',
        text(store.email) ? null : 'owner email',
        text(store.address) ? null : 'address',
        text(store.county) ? null : 'county',
      ].filter(Boolean);
      if (missing.length) return status('missing', `Missing: ${missing.join(', ')}.`);
      if (!approvedStep(evidence, 'business')) return status('incomplete', 'Business and contact details await administrator approval.');
      return status('complete', 'Approved business details record the license number, owner email, address and county.');
    }
    case 'compliance':
      return store.compliance_status === 'compliant'
        ? status('complete', 'Retailer compliance status is compliant.')
        : status('missing', `Status: ${store.compliance_status || 'not recorded'}.${store.compliance_notes ? ` ${store.compliance_notes}` : ''}`);
    case 'license': {
      if (!licenseNumberIsValid(store.license_number)) return status('placeholder', `License number "${text(store.license_number) || 'blank'}" is not a verified value.`);
      if (store.license_status !== 'active') return status('missing', `License status is ${store.license_status || 'unknown'}.`);
      if (!store.license_expiration_date) return status('missing', 'License expiration date is not recorded.');
      if (store.license_expiration_date < today) return status('expired', `License expired ${store.license_expiration_date}.`);
      const step = approvedStep(evidence, 'license');
      if (!step) return status('incomplete', 'The retail license submission awaits administrator approval.');
      if (!approvedDocumentFor(evidence, step, 'retail_license')) return status('incomplete', 'An administrator must approve the current uploaded license document linked to the approved version.');
      return status('complete', `License ${text(store.license_number)} is active through ${store.license_expiration_date} and its reviewed document is on file.`);
    }
    case 'operations': {
      const missing = [
        text(store.phone) ? null : 'phone',
        text(store.operating_hours_start) ? null : 'opening time',
        text(store.operating_hours_end) ? null : 'closing time',
        Number.isFinite(store.latitude) ? null : 'pickup latitude',
        Number.isFinite(store.longitude) ? null : 'pickup longitude',
      ].filter(Boolean);
      if (missing.length) return status('missing', `Missing: ${missing.join(', ')}.`);
      if (!approvedStep(evidence, 'operations')) return status('incomplete', 'Hours and location await administrator approval.');
      return status('complete', 'Approved hours, phone and pickup coordinates are recorded.');
    }
    case 'agreement': {
      if (agreementIsApproved(agreement, evidence.documents)) return status('complete', 'Both signed copies and the administrator contract review are on file.');
      if (!agreement) return status('missing', 'No retailer agreement is on file.');
      if (agreement.review_status === 'needs_correction') return status('missing', agreement.review_note || 'The agreement needs correction.');
      if (agreement.status !== 'submitted') return status('missing', 'The agreement has not been submitted for review.');
      return status('missing', 'The agreement is awaiting administrator contract review.');
    }
    case 'abc_permit': {
      const result = permitState((evidence.permits || []).find(p => p.permit_type === 'arkansas_abc_third_party_delivery'), { store, today });
      return status(result.status === 'current' ? 'complete' : result.status, result.reason);
    }
    case 'city_license': {
      const result = permitState((evidence.permits || []).find(p => p.permit_type === 'city_business_license'), { store, today });
      return status(result.status === 'current' ? 'complete' : result.status, result.reason);
    }
    case 'tax': {
      const result = taxReady(latestBy(evidence.taxes), store);
      return status(result.status === 'ready' ? 'complete' : result.status, result.reason);
    }
    case 'pos': {
      if (!posSubmission) return status('missing', 'No approved POS configuration is recorded for this store.');
      if (!cloverRequiredFor(posProvider)) return status('not_required', `Approved POS configuration "${posProvider}" does not require a register connection.`);
      const result = cloverState(evidence.cloverConnections, store, today);
      return status(result.status === 'connected' ? 'complete' : result.status, result.reason);
    }
    case 'inventory': {
      const sellable = (evidence.products || []).filter(p => p.in_stock === true && Number(p.price) > 0 && (p.stock_quantity == null || Number(p.stock_quantity) > 0));
      if (!sellable.length) return status('missing', 'No sellable product with a price is recorded for this store.');
      const inventoryStep = evidence.submissions.find(s => s.step === 'inventory' && s.status === 'approved' && s.mapped_at);
      if (!inventoryStep) return status('incomplete', `${sellable.length} priced products are recorded but the inventory review has not been approved.`);
      if (!approvedDocumentFor(evidence, inventoryStep, 'inventory_export')) return status('incomplete', 'An administrator must approve the current inventory export linked to the approved version.');
      return status('complete', `${sellable.length} priced products recorded and the inventory review is approved.`);
    }
    case 'test': {
      if (evidence.onboardingRecords.length > 1) return status('missing', 'Multiple onboarding records match this store; an administrator must resolve the record before test evidence can be trusted.');
      if (!approvedStep(evidence, 'device')) return status('missing', 'The device and notification sandbox test has not been submitted and approved.');
      const result = sandboxState(onboarding, signature);
      return status(result.status === 'verified' ? 'complete' : result.status, result.reason);
    }
    case 'stripe': {
      const saved = text(store.stripe_connection_status) || 'disconnected';
      if (stripe?.verification) {
        const v = stripe.verification;
        if (v.verified) return status('complete', `Connected account ${text(v.account_id)} has charges, payouts and details verified.`);
        return status('missing', v.error || `Stripe: charges and payouts must both be enabled. ${v.disabled_reason || (v.requirements || []).join(', ') || 'Complete hosted verification.'}`);
      }
      return status('verification', `Saved status: ${saved}. Account ownership, charges and payouts require a live verification check.`);
    }
    case 'webhook': {
      if (!webhook) return status('verification', 'Payment webhook delivery has not been checked.');
      if (webhook.ready) return status('complete', 'Payment webhook is enabled with the required events and its signing secret is saved.');
      if (!webhook.secret_configured) return status('missing', 'The payment webhook signing secret is missing.');
      if (!webhook.active) return status('missing', `The payment webhook endpoint is not enabled${webhook.missing_events?.length ? ` for: ${webhook.missing_events.join(', ')}` : ''}.`);
      return status('verification', 'Payment webhook delivery requires verification.');
    }
    case 'driver': {
      const qualified = (evidence.drivers || []).some(driver => driverIsProductionQualified(driver)
        && [driver.current_latitude, driver.current_longitude].every(Number.isFinite)
        && (evidence.coverage.some(row => row.driver_id === driver.id)
          || (driver.service_city && driver.service_city.trim().toLowerCase() === store.city?.trim().toLowerCase())));
      return qualified ? status('complete', 'An administrator-qualified driver covers this store.') : status('missing', 'No qualified driver with current compliance covers this store.');
    }
    case 'zone': {
      const zoned = (evidence.zones || []).some(zone => zone.county?.trim().toLowerCase() === store.county?.trim().toLowerCase()
        && zone.radius_miles > 0 && Number.isFinite(zone.center_latitude) && Number.isFinite(zone.center_longitude));
      return zoned ? status('complete', `A legal delivery zone covers ${text(store.county)} County.`) : status('missing', `No legal delivery zone is configured for ${text(store.county) || 'this'} county.`);
    }
    default:
      return status('missing', 'This requirement has no evaluation rule.');
  }
}

// The one evaluation both the compliance dashboard and the launch gate use.
export function evaluateStoreReadiness({ store, index, today, stripe = null, webhook = null }) {
  const evaluationDate = today || new Date().toISOString().slice(0, 10);
  const evidence = scopedEvidence(index, store);
  const onboarding = evidence.onboardingRecords.length === 1 ? evidence.onboardingRecords[0] : null;
  const agreement = latestBy(evidence.agreements, ['submitted_at', 'updated_date', 'created_date']);
  const posSubmission = evidence.submissions.find(s => s.step === 'pos' && s.status === 'approved') || null;
  const posProvider = posProviderOf(posSubmission);
  const cloverConnection = latestBy(evidence.cloverConnections, ['connected_at', 'updated_date', 'created_date']);
  const signature = readinessConfigSignature({ store, posProvider, cloverConnection, agreement, tax: latestBy(evidence.taxes) });
  const legacyLink = evidence.onboardingRecords.some(row => !row.store_id);

  const checks = READINESS_CHECKS.map(definition => {
    const outcome = evaluateCheck(definition.key, { store, today: evaluationDate, evidence, onboarding, agreement, posSubmission, posProvider, cloverConnection, signature, stripe, webhook });
    return {
      key: definition.key,
      label: definition.label,
      blocking: definition.blocking,
      href: definition.href === 'setup' ? `/onboarding?store_id=${encodeURIComponent(store.id)}` : definition.href,
      status: outcome.status,
      message: definition.message,
      reason: outcome.reason,
    };
  });

  const blockers = checks.filter(check => check.blocking && check.status !== 'complete').map(check => check.message);
  const tasks = Object.fromEntries(checks.map(check => [check.key, check.status === 'complete' || check.status === 'not_required']));
  const missing = checks.filter(check => !tasks[check.key]).map(check => check.key);
  const ready = checks.every(check => !check.blocking || check.status === 'complete');

  return {
    store_id: store.id,
    store_name: store.name,
    city: store.city,
    county: store.county,
    state: store.state,
    is_active: store.is_active,
    onboarding_status: store.onboarding_status,
    compliance_status: store.compliance_status,
    stage: store.onboarding_status || 'pending',
    ready,
    fully_live: store.is_active === true && store.onboarding_status === 'live' && ready,
    tasks,
    missing,
    blocking_count: checks.filter(check => check.blocking && check.status !== 'complete').length,
    complete_count: checks.filter(check => check.status === 'complete' || check.status === 'not_required').length,
    total_count: checks.length,
    checks,
    blockers,
    legacy_relationships: {
      onboarding_records: evidence.onboardingRecords.length,
      legacy_name_link: legacyLink,
      ambiguous: evidence.onboardingRecords.length > 1,
      permits: evidence.permits.filter(p => !p.store_id).length,
      unlinked_permits: (index?.permits || []).filter(p => !p.store_id && !p.store_email).length,
    },
    evaluated_at: new Date().toISOString(),
  };
}

export function blockersFor(readiness) {
  return [...new Set(readiness.blockers.filter(message => typeof message === 'string' && message))];
}

export function emailMatches(row, email) {
  return normalizeEmail(row?.store_email) === normalizeEmail(email);
}