// Rule-level checks for the single readiness evaluation shared by the compliance
// dashboard and the launch gate. Pure functions only: no database, no network.
import { assertEquals, assert } from 'jsr:@std/assert@1';
import {
  agreementIsApproved, cloverRequiredFor, cloverState, isPlaceholder, licenseNumberIsValid, merchantIdIsValid,
  permitState, posProviderOf, readinessConfigSignature, sandboxEvidenceFromFields,
  sandboxMissingParts, sandboxState, taxReady,
} from './readinessEvidence.ts';
import { READINESS_CHECKS } from './readinessChecks.ts';
import { evaluateStoreReadiness } from './evaluateStoreReadiness.ts';

const today = '2026-10-24';
const store = {
  id: 'store_1', name: 'Test Wines', email: 'owner@testwines.com', city: 'Pine Bluff', county: 'Jefferson',
  license_number: 'AR-123456', license_status: 'active', license_expiration_date: '2027-01-31',
  sales_tax_rate: 0.095, stripe_connect_account_id: 'acct_123', compliance_status: 'compliant',
};

Deno.test('placeholder values never count as verified evidence', () => {
  for (const value of ['Pending verification', 'Pending authorization', 'pending_verification', 'PENDING-VERIFY', 'TBD', 'N/A', 'na', 'unknown', 'not provided', '-', '  ', null, undefined]) {
    assert(isPlaceholder(value), `${value} should be a placeholder`);
    assertEquals(licenseNumberIsValid(value), false);
  }
  assert(licenseNumberIsValid('AR-123456'));

  // A real Clover merchant id must never be mistaken for a placeholder because of
  // alphanumeric runs inside it ("NA", "pending"-like fragments).
  for (const value of ['K564NATGH4071', 'K564NATGH4071'.toLowerCase(), 'M3N0PEND1NG', 'C0123NABE4']) {
    assertEquals(isPlaceholder(value), false, `${value} is a real merchant id`);
  }
  assertEquals(merchantIdIsValid('K564NATGH4071'), true);
  assertEquals(merchantIdIsValid('Pending authorization'), false);
  assertEquals(merchantIdIsValid('Pending verification'), false);
  assertEquals(merchantIdIsValid(''), false);
  assertEquals(merchantIdIsValid('K1'), false);
});

Deno.test('both permit types follow the same issue, expiry and document rules', () => {
  const base = { store_id: 'store_1', status: 'active', document_on_file: true, permit_number: 'ABC-1', issue_date: '2026-01-01' };
  assertEquals(permitState(null, { store, today }).status, 'missing');
  assertEquals(permitState({ ...base, store_id: '' }, { store, today }).status, 'unlinked');
  assertEquals(permitState({ ...base, status: 'pending' }, { store, today }).status, 'inactive');
  assertEquals(permitState({ ...base, document_on_file: false }, { store, today }).status, 'no_document');
  assertEquals(permitState({ ...base, permit_number: 'Pending verification' }, { store, today }).status, 'placeholder');
  assertEquals(permitState({ ...base }, { store, today }).status, 'no_expiration');
  assertEquals(permitState({ ...base, expiration_date: '2026-01-01' }, { store, today }).status, 'expired');
  assertEquals(permitState({ ...base, issue_date: '2027-01-01', expiration_date: '2028-01-01' }, { store, today }).status, 'not_yet_valid');
  assertEquals(permitState({ ...base, expiration_date: '2027-01-01' }, { store, today }).status, 'current');
});

Deno.test('an uploaded or retailer-signed agreement is not an approved agreement', () => {
  const draft = { store_id: 'store_1', status: 'draft', review_status: 'pending_review', file_uri: 'private://a' };
  assertEquals(agreementIsApproved(draft, []), false);
  const submitted = { ...draft, status: 'submitted' };
  assertEquals(agreementIsApproved(submitted, []), false, 'review approval is still required');
  assertEquals(agreementIsApproved({ ...submitted, review_status: 'approved' }, []), false, 'countersigned copy is still required');
  assertEquals(agreementIsApproved({ ...submitted, review_status: 'approved', countersigned_file_uri: 'private://b' }, []), true);
  assertEquals(agreementIsApproved(null, [{ kind: 'signed_agreement', status: 'pending_review', file_uri: 'private://a' }]), false);
  assertEquals(agreementIsApproved(null, [{ kind: 'signed_agreement', status: 'approved', file_uri: 'private://a' }]), true);
});

Deno.test('tax needs a confirmed record, its evidence and a configured rate', () => {
  const tax = { status: 'confirmed', source: 'AR DFA', confirmed_at: '2026-02-01', notes: 'Pine Bluff 9.5%' };
  assertEquals(taxReady(null, store).status, 'missing');
  assertEquals(taxReady({ ...tax, status: 'pending' }, store).status, 'pending');
  assertEquals(taxReady({ ...tax, source: '' }, store).status, 'incomplete');
  assertEquals(taxReady({ ...tax, confirmed_at: '' }, store).status, 'incomplete');
  assertEquals(taxReady({ ...tax, notes: ' ' }, store).status, 'incomplete');
  assertEquals(taxReady(tax, { ...store, sales_tax_rate: 0 }).status, 'incomplete');
  assertEquals(taxReady(tax, store).status, 'ready');
});

Deno.test('the register requirement comes from the approved POS configuration', () => {
  assertEquals(posProviderOf({ step: 'pos', status: 'submitted', fields: { pos_provider: 'Clover' } }), '');
  assertEquals(posProviderOf({ step: 'pos', status: 'approved', fields: { pos_provider: 'Clover' } }), 'Clover');
  assert(cloverRequiredFor('Clover Flex'));
  assertEquals(cloverRequiredFor('Manual price book'), false);

  const row = { store_id: 'store_1', status: 'connected', merchant_id: 'K564NATGH4071', merchant_name: 'Test Wines' };
  assertEquals(cloverState([], store, today).status, 'missing');
  assertEquals(cloverState([{ ...row, status: 'expired' }], store, today).status, 'expired');
  assertEquals(cloverState([{ ...row, status: 'disconnected' }], store, today).status, 'pending');
  assertEquals(cloverState([{ ...row, merchant_id: 'Pending' }], store, today).status, 'pending');
  assertEquals(cloverState([{ ...row, access_token_expires_at: '2026-01-01T00:00:00.000Z' }], store, today).status, 'expired');
  assertEquals(cloverState([row], store, today).status, 'connected');
});

Deno.test('a connected register needs this store\'s own verified connection record', () => {
  const verified = { store_id: 'store_1', status: 'connected', merchant_id: 'K564NATGH4071', merchant_name: 'Test Wines', connected_at: '2026-09-01T00:00:00.000Z' };

  // Verified, active, unexpired connection for this store.
  assertEquals(cloverState([verified], store, today).status, 'connected');

  // Missing merchant identity is never inferred from the connection existing.
  assertEquals(cloverState([{ ...verified, merchant_id: '' }], store, today).status, 'pending');
  assertEquals(cloverState([{ ...verified, merchant_id: undefined }], store, today).status, 'pending');
  assertEquals(cloverState([{ ...verified, merchant_name: '' }], store, today).status, 'pending');

  // Legacy free-text values carried over from onboarding review.
  assertEquals(cloverState([{ ...verified, merchant_id: 'Pending authorization' }], store, today).status, 'pending');
  assertEquals(cloverState([{ ...verified, merchant_id: 'Pending verification' }], store, today).status, 'pending');

  // A merchant id with no verified authorization is not a connection.
  assertEquals(cloverState([{ ...verified, status: 'disconnected' }], store, today).status, 'pending');
  assertEquals(cloverState([{ ...verified, status: 'pending' }], store, today).status, 'pending');

  // Expiry, whether recorded on the row or on the stored tokens.
  assertEquals(cloverState([{ ...verified, status: 'expired' }], store, today).status, 'expired');
  assertEquals(cloverState([{ ...verified, refresh_token_expires_at: '2026-10-01T00:00:00.000Z' }], store, today).status, 'expired');

  // Another store's connection never satisfies this store, and legacy rows with no
  // store link are not guessed at.
  assertEquals(cloverState([{ ...verified, store_id: 'store_2' }], store, today).status, 'missing');
  assertEquals(cloverState([{ ...verified, store_id: '' }], store, today).status, 'missing');
  assertEquals(cloverState([{ ...verified, store_id: undefined }], store, today).status, 'missing');

  // The newest record wins when a store has reconnected.
  const reconnected = cloverState([
    { ...verified, status: 'disconnected', connected_at: '2026-08-01T00:00:00.000Z' },
    { ...verified, connected_at: '2026-09-01T00:00:00.000Z' },
  ], store, today);
  assertEquals(reconnected.status, 'connected');
  assertEquals(cloverState([
    verified,
    { ...verified, status: 'expired', connected_at: '2026-10-01T00:00:00.000Z' },
  ], store, today).status, 'expired');
});

Deno.test('sandbox evidence requires every part and goes stale when configuration changes', () => {
  const fields = { test_order_reference: 'TEST-1', test_amount: 12.5, retailer_accepted: true, notification_confirmed: true, handoff_confirmed: true, device_name: 'iPad Air', tested_at: '2026-10-01' };
  const evidence = sandboxEvidenceFromFields(fields, { config_signature: 'sig-a' });
  assertEquals(sandboxMissingParts(evidence), []);
  assertEquals(sandboxMissingParts(sandboxEvidenceFromFields({ ...fields, handoff_confirmed: false })), ['pickup/handoff confirmation']);
  assertEquals(sandboxState({ sandbox_evidence: evidence }, 'sig-a').status, 'verified');
  assertEquals(sandboxState({ sandbox_evidence: evidence }, 'sig-b').status, 'stale');
  assertEquals(sandboxState({}, 'sig-a').status, 'missing');

  const signature = readinessConfigSignature({ store, posProvider: 'Clover', cloverConnection: { merchant_id: 'K1', status: 'connected' }, agreement: { id: 'a1', terms_hash: 'h1' }, tax: { rate: 0.095 } });
  const changedRate = readinessConfigSignature({ store: { ...store, sales_tax_rate: 0.1 }, posProvider: 'Clover', cloverConnection: { merchant_id: 'K1', status: 'connected' }, agreement: { id: 'a1', terms_hash: 'h1' }, tax: { rate: 0.095 } });
  assert(signature !== changedRate, 'a tax-rate change must invalidate the evidence');
});

Deno.test('one evaluation drives every surface and placeholders cannot pass', () => {
  const index = { submissions: [], documents: [], agreements: [], taxes: [], clover: [], onboarding: [], coverage: [], tokens: [], zones: [], permits: [], products: [], drivers: [] };
  const placeholderStore = { ...store, license_number: 'Pending verification' };
  const readiness = evaluateStoreReadiness({ store: placeholderStore, index, today });
  assertEquals(readiness.checks.map(check => check.key), READINESS_CHECKS.map(check => check.key));
  assertEquals(readiness.checks.find(check => check.key === 'license').status, 'placeholder');
  assertEquals(readiness.ready, false);
  assert(readiness.blockers.length > 0);

  const ambiguous = evaluateStoreReadiness({
    store, today, index: { ...index, onboarding: [{ id: 'o1', store_id: 'store_1' }, { id: 'o2', store_id: 'store_1' }] },
  });
  assertEquals(ambiguous.checks.find(check => check.key === 'test').status, 'missing');
  assertEquals(ambiguous.legacy_relationships.ambiguous, true);

  const verified = evaluateStoreReadiness({ store, today, index });
  assertEquals(verified.checks.find(check => check.key === 'license').status, 'incomplete', 'an unapproved license submission cannot pass');
  assert(verified.checks.find(check => check.key === 'pos').status === 'missing');
  assertEquals(verified.checks.find(check => check.key === 'webhook').status, 'verification');
});