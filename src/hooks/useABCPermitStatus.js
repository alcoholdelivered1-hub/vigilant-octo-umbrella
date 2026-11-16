import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { differenceInCalendarDays, isValid, parseISO } from 'date-fns';
import { base44 } from '@/api/base44Client';

async function readAll(entity, filter = {}, sort = '-updated_date') {
  const records = [];
  let cursor = null;
  do {
    const page = await entity.filter(filter, { limit: 200, sort, cursor });
    records.push(...page.items);
    cursor = page.has_more ? page.next_cursor : null;
  } while (cursor);
  return records;
}

const PERMIT_LABELS = {
  arkansas_abc_third_party_delivery: 'ABC Third-Party Delivery Permit',
  city_business_license: 'City Business License',
  employer_background_check: 'Employer Background Check',
};

const STATUS_META = {
  active: { label: 'Active', className: 'bg-green-100 text-green-700 border-green-200' },
  expired: { label: 'Expired', className: 'bg-red-100 text-red-700 border-red-200' },
  suspended: { label: 'Suspended', className: 'bg-orange-100 text-orange-700 border-orange-200' },
  revoked: { label: 'Revoked', className: 'bg-red-100 text-red-700 border-red-200' },
};

const LICENSE_STATUS_META = {
  active: { label: 'Active', className: 'bg-green-100 text-green-700 border-green-200' },
  pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  expired: { label: 'Expired', className: 'bg-red-100 text-red-700 border-red-200' },
  suspended: { label: 'Suspended', className: 'bg-orange-100 text-orange-700 border-orange-200' },
  unknown: { label: 'Unknown', className: 'bg-gray-100 text-gray-600 border-gray-200' },
};

function todayCST() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = type => parts.find(p => p.type === type).value;
  return parseISO(`${part('year')}-${part('month')}-${part('day')}`);
}

function daysUntil(expirationDate, today) {
  if (!expirationDate || !isValid(parseISO(expirationDate))) return null;
  return differenceInCalendarDays(parseISO(expirationDate), today);
}

function urgencyLevel(days) {
  if (days === null) return 'unknown';
  if (days < 0) return 'expired';
  if (days <= 7) return 'critical';
  if (days <= 30) return 'urgent';
  if (days <= 60) return 'soon';
  return 'current';
}

export default function useABCPermitStatus() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ['abc-permit-status'],
    queryFn: async () => {
      const [stores, permits] = await Promise.all([
        readAll(base44.entities.Store),
        readAll(base44.entities.BusinessPermit),
      ]);
      return { stores, permits };
    },
    refetchInterval: 60000,
  });

  useEffect(() => {
    const refresh = () => client.invalidateQueries({ queryKey: ['abc-permit-status'] });
    const unsubscribers = [
      base44.entities.Store.subscribe(refresh),
      base44.entities.BusinessPermit.subscribe(refresh),
    ];
    return () => unsubscribers.forEach(stop => stop && stop());
  }, [client]);

  const { stores = [], permits = [] } = query.data || {};
  const today = todayCST();

  // Build store-permit lookup
  const storePermits = new Map();
  for (const permit of permits) {
    const matches = permit.store_id
      ? stores.filter(s => s.id === permit.store_id)
      : permit.store_email
        ? stores.filter(s => s.email?.toLowerCase() === permit.store_email.toLowerCase())
        : [];
    const store = matches[0] || null;
    const days = daysUntil(permit.expiration_date, today);
    const urgency = urgencyLevel(days);
    storePermits.set(permit.id, { permit, store, days, urgency });
  }

  // Build store rows with license + permit info
  const storeRows = stores.map(store => {
    const licenseDays = daysUntil(store.license_expiration_date, today);
    const licenseUrgency = urgencyLevel(licenseDays);
    const storePermitRecords = permits.filter(p =>
      (p.store_id && p.store_id === store.id) ||
      (p.store_email && store.email?.toLowerCase() === p.store_email.toLowerCase())
    );
    const deliveryPermit = storePermitRecords.find(p => p.permit_type === 'arkansas_abc_third_party_delivery');
    const cityLicense = storePermitRecords.find(p => p.permit_type === 'city_business_license');
    const deliveryDays = deliveryPermit ? daysUntil(deliveryPermit.expiration_date, today) : null;
    const deliveryUrgency = deliveryPermit ? urgencyLevel(deliveryDays) : 'unknown';
    return {
      store,
      licenseDays,
      licenseUrgency,
      deliveryPermit: deliveryPermit || null,
      deliveryDays,
      deliveryUrgency,
      cityLicense: cityLicense || null,
      hasDeliveryPermit: Boolean(deliveryPermit),
    };
  });

  // Summary counts
  const allDocuments = [
    ...stores.map(s => ({ type: 'store_license', store: s, days: daysUntil(s.license_expiration_date, today), status: s.license_status, expiration: s.license_expiration_date })),
    ...permits.map(p => ({ type: p.permit_type, store: storePermits.get(p.id)?.store, days: daysUntil(p.expiration_date, today), status: p.status, expiration: p.expiration_date })),
  ].filter(d => d.expiration);

  const summary = {
    totalStores: stores.length,
    activeLicenses: stores.filter(s => s.license_status === 'active').length,
    expiredLicenses: stores.filter(s => s.license_status === 'expired' || (s.license_expiration_date && daysUntil(s.license_expiration_date, today) < 0)).length,
    deliveryPermits: permits.filter(p => p.permit_type === 'arkansas_abc_third_party_delivery').length,
    activeDeliveryPermits: permits.filter(p => p.permit_type === 'arkansas_abc_third_party_delivery' && p.status === 'active').length,
    needsRenewal: allDocuments.filter(d => d.days !== null && d.days >= 0 && d.days <= 60).length,
    expired: allDocuments.filter(d => d.days !== null && d.days < 0).length,
    missingDates: allDocuments.filter(d => d.days === null).length,
  };

  return { ...query, storeRows, storePermits, summary, today };
}