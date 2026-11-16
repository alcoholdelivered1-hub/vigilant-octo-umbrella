// Arkansas local-option Sunday sales rules.
// Statewide baseline: off-premises alcohol sales are prohibited on Sunday
// unless a city or county local option authorizing Sunday sales has been
// certified by Arkansas ABC. Only a SundaySalesJurisdiction record with
// status 'certified' and an effective_date that has already arrived counts;
// a passed election alone is never in effect until ABC certification.

function normalize(value) {
  return String(value || '').replace(/\s+(city|town|village)$/i, '').trim().toLowerCase();
}

export function normalizeJurisdictionName(value) {
  return normalize(value);
}

// YYYY-MM-DD in America/Chicago so effective dates compare on the legal calendar day.
export function centralTimeDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

export function isSunday(date = new Date()) {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', weekday: 'short' }).format(date) === 'Sun';
}

export function findSundaySalesRecord(records, { city, county }) {
  const list = Array.isArray(records) ? records : [];
  const c = normalize(city);
  const k = normalize(county);
  if (c) {
    const cityMatch = list.find(r =>
      r.jurisdiction_type === 'city' && normalize(r.city) === c && (!k || normalize(r.county) === k)
    );
    if (cityMatch) return cityMatch;
  }
  return list.find(r => r.jurisdiction_type === 'county' && normalize(r.county) === k) || null;
}

export function jurisdictionLabel(record) {
  if (!record) return 'this area';
  return record.jurisdiction_type === 'city'
    ? `${record.city}, ${record.county} County`
    : `${record.county} County`;
}

/**
 * Pure Sunday-delivery gate. Call with the delivery city/county and the
 * SundaySalesJurisdiction records; returns whether Sunday alcohol delivery is
 * legal there today, plus a customer-facing reason when it is not.
 */
export function evaluateSundayDelivery(records, { city, county }, now = new Date()) {
  if (!isSunday(now)) return { is_sunday: false, allowed: true, record: null, reason: null };

  const record = findSundaySalesRecord(records, { city, county });
  if (!record) {
    return {
      is_sunday: true, allowed: false, record: null,
      reason: 'Arkansas law does not allow Sunday alcohol sales in this area. No Sunday local option is certified here.',
    };
  }

  if (record.status === 'certified' && record.effective_date) {
    if (centralTimeDateKey(now) >= String(record.effective_date)) {
      return { is_sunday: true, allowed: true, record, reason: null };
    }
    return {
      is_sunday: true, allowed: false, record,
      reason: `Sunday alcohol sales in ${jurisdictionLabel(record)} begin ${record.effective_date}. Alcohol delivery is not available on Sundays before then.`,
    };
  }

  return {
    is_sunday: true, allowed: false, record,
    reason: `Sunday alcohol sales in ${jurisdictionLabel(record)} were approved by voters but are not in effect yet — Arkansas ABC has not certified the local option.`,
  };
}