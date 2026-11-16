import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { differenceInCalendarDays, isValid, parseISO } from 'date-fns';
import { base44 } from '@/api/base44Client';

async function readAll(entity) {
  const records = [];
  let cursor = null;
  do {
    const page = await entity.filter({}, { limit: 200, sort: '-updated_date', cursor });
    records.push(...page.items);
    cursor = page.has_more ? page.next_cursor : null;
  } while (cursor);
  return records;
}

export default function useStoreExpiry() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['store-expiry-tracker'], queryFn: async () => {
    const [stores, permits] = await Promise.all([readAll(base44.entities.Store), readAll(base44.entities.BusinessPermit)]);
    return { stores, permits };
  }, refetchInterval: 60000 });
  useEffect(() => {
    const refresh = () => client.invalidateQueries({ queryKey: ['store-expiry-tracker'] });
    const unsubscribe = [base44.entities.Store.subscribe(refresh), base44.entities.BusinessPermit.subscribe(refresh)];
    return () => unsubscribe.forEach(stop => stop());
  }, [client]);
  const { stores = [], permits = [] } = query.data || {};
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = type => parts.find(p => p.type === type).value;
  const today = parseISO(`${part('year')}-${part('month')}-${part('day')}`);
  const documents = stores.map(store => ({ key: `license-${store.id}`, store, label: 'ABC retail license', number: store.license_number, expiration: store.license_expiration_date }));
  permits.filter(p => p.permit_type !== 'arkansas_abc_third_party_delivery').forEach(permit => {
    const matches = permit.store_email ? stores.filter(s => s.email?.toLowerCase() === permit.store_email.toLowerCase()) : [];
    const store = permit.store_id ? stores.find(s => s.id === permit.store_id) : matches.length === 1 ? matches[0] : null;
    if (store) documents.push({ key: `permit-${permit.id}`, store, label: permit.permit_type === 'city_business_license' ? 'City business license' : 'Store permit', number: permit.permit_number, expiration: permit.expiration_date });
  });
  const dated = documents.map(d => ({ ...d, days: d.expiration && isValid(parseISO(d.expiration)) ? differenceInCalendarDays(parseISO(d.expiration), today) : null }));
  const rows = dated.filter(d => d.days !== null && d.days >= 0 && d.days <= 30).sort((a, b) => a.days - b.days || a.store.name.localeCompare(b.store.name));
  return { ...query, rows, missingDates: dated.filter(d => d.days === null).length, storeCount: new Set(rows.map(d => d.store.id)).size };
}