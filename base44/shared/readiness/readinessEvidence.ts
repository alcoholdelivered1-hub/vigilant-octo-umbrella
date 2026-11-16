// Pure readiness rules. No I/O, no secrets, no clock reads: every caller passes `today`
// so the compliance dashboard and the launch gate always reach the same verdict.

export function text(value) {
  return String(value ?? '').trim();
}

export function normalizeEmail(value) {
  return text(value).toLowerCase();
}

export function normalizeName(value) {
  return text(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Whole-word placeholder phrases only. A substring test would reject real values
// (a Clover merchant id such as K564NATGH4071 contains "na", a licence can contain "unknown"-like runs),
// so every alternative is anchored to token boundaries and matched case-insensitively.
const PLACEHOLDER = /(?:^|[^a-z0-9])(?:pending|verif[a-z]*|unverified|tbd|unknown|placeholder|n\/?a|none|not\s+provided|to\s+be\s+determined)(?![a-z0-9])/i;

// Any free-text placeholder ("Pending verification", "TBD", "XXX") is not evidence.
export function isPlaceholder(value) {
  const raw = text(value);
  if (!raw) return true;
  if (PLACEHOLDER.test(raw)) return true;
  if (!/[a-z0-9]/i.test(raw)) return true;
  if (/^([^a-z0-9])\1+$/i.test(raw)) return true;
  return false;
}

export function licenseNumberIsValid(value) {
  const raw = text(value);
  return raw.length >= 3 && /^[A-Za-z0-9][A-Za-z0-9 .-]{2,}$/.test(raw) && !isPlaceholder(raw);
}

export function merchantIdIsValid(value) {
  const raw = text(value);
  return /^[A-Za-z0-9]{6,20}$/.test(raw) && !isPlaceholder(raw);
}

// Evidence must provably belong to this store. Legacy rows without a store id are
// accepted only when their store email matches; ambiguous rows are never approved.
export function belongsToStore(row, store) {
  if (!row || !store) return false;
  if (row.store_id) return row.store_id === store.id;
  if (row.store_email && store.email) return normalizeEmail(row.store_email) === normalizeEmail(store.email);
  return false;
}

export function linkageOf(row, store) {
  if (row?.store_id === store?.id) return 'store_id';
  if (!row?.store_id && row?.store_email && normalizeEmail(row.store_email) === normalizeEmail(store?.email)) return 'legacy_email';
  return 'unlinked';
}

export function latestBy(rows, dateKeys = ['submitted_at', 'updated_date', 'created_date']) {
  const stamp = row => {
    for (const key of dateKeys) {
      const value = row?.[key];
      if (value && Number.isFinite(Date.parse(value))) return Date.parse(value);
    }
    return 0;
  };
  return [...(rows || [])].sort((a, b) => stamp(b) - stamp(a))[0] || null;
}

export function agreementIsApproved(agreement, documents) {
  if (agreement && agreement.status === 'submitted' && agreement.review_status === 'approved' && agreement.file_uri && agreement.countersigned_file_uri) return true;
  const uploaded = (documents || []).find(d => d.kind === 'signed_agreement');
  return !agreement && uploaded?.status === 'approved' ? Boolean(uploaded.file_uri) : false;
}

// Issue date, expiration date, document and verification rules are identical for every
// permit type; only the type differs. Placeholder numbers never count as verified.
export function permitState(permit, { store, today }) {
  if (!permit) return { status: 'missing', reason: 'No permit record is on file for this store.' };
  const linkage = linkageOf(permit, store);
  if (linkage === 'unlinked') return { status: 'unlinked', reason: 'This permit is not linked to the store by id or store email; an administrator must link it.' };
  if (permit.status !== 'active') return { status: 'inactive', reason: `Permit status is ${permit.status || 'not recorded'}.` };
  if (permit.document_on_file !== true) return { status: 'no_document', reason: 'No permit document is on file.' };
  if (!text(permit.permit_number) || isPlaceholder(permit.permit_number)) return { status: 'placeholder', reason: `Permit number is not a verified value (${text(permit.permit_number) || 'blank'}).` };
  if (!permit.issue_date) return { status: 'no_issue_date', reason: 'Permit issue date is missing.' };
  if (!permit.expiration_date) return { status: 'no_expiration', reason: 'Permit expiration date is missing.' };
  if (permit.issue_date > today) return { status: 'not_yet_valid', reason: `Permit takes effect ${permit.issue_date}.` };
  if (permit.expiration_date < today) return { status: 'expired', reason: `Permit expired ${permit.expiration_date}.` };
  return { status: 'current', reason: `Permit ${text(permit.permit_number)} is current through ${permit.expiration_date}.` };
}

export function taxReady(tax, store) {
  const rate = Number(store?.sales_tax_rate);
  if (!tax) return { status: 'missing', reason: 'No confirmed DFA tax record is on file.' };
  if (tax.status !== 'confirmed') return { status: 'pending', reason: 'Tax confirmation is not confirmed.' };
  if (!text(tax.source)) return { status: 'incomplete', reason: 'Tax confirmation is missing its authority source.' };
  if (!tax.confirmed_at) return { status: 'incomplete', reason: 'Tax confirmation is missing its confirmation date.' };
  if (!text(tax.notes)) return { status: 'incomplete', reason: 'Tax confirmation is missing its coverage notes.' };
  if (!Number.isFinite(rate) || rate <= 0 || rate > 0.5) return { status: 'incomplete', reason: 'The store sales tax rate is not configured.' };
  return { status: 'ready', reason: `Tax confirmed from ${text(tax.source)}; rate ${(rate * 100).toFixed(3)}%.` };
}

// The register requirement comes from the approved POS configuration only.
export function posProviderOf(posSubmission) {
  return posSubmission?.status === 'approved' ? text(posSubmission.fields?.pos_provider) : '';
}

export function cloverRequiredFor(posProvider) {
  return /clover/i.test(posProvider || '');
}

export function cloverState(connections, store, today) {
  const rows = (connections || []).filter(row => row.store_id === store.id);
  if (!rows.length) return { status: 'missing', reason: 'No register connection is on file for this store.' };
  const connection = latestBy(rows, ['connected_at', 'updated_date', 'created_date']);
  if (connection.status === 'expired') return { status: 'expired', reason: 'The register authorization expired and must be reauthorized.' };
  if (connection.status === 'disconnected') return { status: 'pending', reason: 'The register connection is not authorized.' };
  if (connection.status !== 'connected') return { status: 'pending', reason: `Register connection status is ${connection.status || 'unknown'}.` };
  const tokenExpired = connection.access_token_expires_at && connection.access_token_expires_at < `${today}T00:00:00.000Z`;
  const refreshExpired = connection.refresh_token_expires_at && connection.refresh_token_expires_at < `${today}T00:00:00.000Z`;
  if (tokenExpired || refreshExpired) return { status: 'expired', reason: 'The stored register authorization has expired and must be reauthorized.' };
  if (!merchantIdIsValid(connection.merchant_id)) return { status: 'pending', reason: 'The register merchant identity is not verified.' };
  if (!text(connection.merchant_name)) return { status: 'pending', reason: 'The register merchant name is not verified.' };
  return { status: 'connected', reason: `Register verified as ${text(connection.merchant_name)} (${text(connection.merchant_id)}).` };
}

const SANDBOX_PARTS = [
  ['test_order_reference', 'sandbox order reference'],
  ['test_amount', 'sandbox test amount'],
  ['retailer_accepted', 'retailer acceptance'],
  ['notification_confirmed', 'notification delivery result'],
  ['handoff_confirmed', 'pickup/handoff confirmation'],
  ['device_name', 'tested device'],
  ['tested_at', 'test date'],
];

export function sandboxEvidenceFromFields(fields, extra = {}) {
  return {
    test_order_reference: text(fields?.test_order_reference),
    test_amount: Number(fields?.test_amount),
    retailer_accepted: fields?.retailer_accepted === true,
    notification_confirmed: fields?.notification_confirmed === true,
    handoff_confirmed: fields?.handoff_confirmed === true,
    device_name: text(fields?.device_name),
    tested_at: text(fields?.tested_at),
    notes: text(fields?.notes),
    ...extra,
  };
}

export function sandboxMissingParts(evidence) {
  return SANDBOX_PARTS
    .filter(([key]) => {
      const value = evidence?.[key];
      if (key === 'test_amount') return !Number.isFinite(value) || value <= 0 || value > 100;
      if (key === 'tested_at') return !/^\d{4}-\d{2}-\d{2}$/.test(text(value));
      if (key === 'retailer_accepted' || key === 'notification_confirmed' || key === 'handoff_confirmed') return value !== true;
      return !text(value) || isPlaceholder(value);
    })
    .map(([, label]) => label);
}

// Any change to licence, POS, register, payment account, contract terms or tax rate
// invalidates previously recorded sandbox evidence.
export function readinessConfigSignature({ store, posProvider, cloverConnection, agreement, tax }) {
  return JSON.stringify([
    store?.id || '',
    text(store?.license_number),
    text(store?.license_expiration_date),
    text(posProvider),
    text(cloverConnection?.merchant_id),
    text(cloverConnection?.status),
    text(store?.stripe_connect_account_id),
    text(agreement?.id),
    text(agreement?.terms_hash || agreement?.terms_version),
    Number.isFinite(Number(store?.sales_tax_rate)) ? Number(store.sales_tax_rate) : '',
    Number.isFinite(Number(tax?.rate)) ? Number(tax.rate) : '',
  ]);
}

export function sandboxState(onboarding, signature) {
  const evidence = onboarding?.sandbox_evidence;
  if (!evidence || typeof evidence !== 'object' || !Object.keys(evidence).length) return { status: 'missing', reason: 'No structured sandbox test evidence is recorded.' };
  const missing = sandboxMissingParts(evidence);
  if (missing.length) return { status: 'incomplete', reason: `Sandbox test evidence is missing: ${missing.join(', ')}.` };
  if (text(evidence.config_signature) !== signature) return { status: 'stale', reason: 'Configuration or evidence changed after this sandbox test; rerun and re-record the test.' };
  return { status: 'verified', reason: `Sandbox order ${text(evidence.test_order_reference)} for $${Number(evidence.test_amount).toFixed(2)} recorded on ${text(evidence.tested_at)}.` };
}