import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
const unique = values => [...new Set(values.filter(Boolean).map(value => String(value).trim()).filter(Boolean))];
const join = values => unique(values).join('\n');
const address = row => [row.address, [row.city, row.state || 'AR', row.zip_code].filter(Boolean).join(' ')].filter(Boolean).join('\n');
async function readAll(entity, filter = {}) {
  const records = []; let cursor;
  do { const page = await entity.filter(filter, { limit: 100, sort: '-updated_date', ...(cursor ? { cursor } : {}) }); records.push(...page.items); cursor = page.has_more ? page.next_cursor : null; } while (cursor);
  return records;
}
export default function usePrintableRetailerContacts(enabled) {
  return useQuery({ queryKey: ['print-retailer-contacts'], enabled, retry: false, queryFn: async () => {
    const stores = await readAll(base44.entities.Store);
    const onboarding = await readAll(base44.entities.RetailerOnboarding);
    const signups = await readAll(base44.entities.RetailerSignup);
    const submissions = await readAll(base44.entities.RetailerSetupSubmission, { step: 'business' });
    const saved = stores.map(store => {
      const related = onboarding.filter(row => row.store_id === store.id);
      const latest = submissions.find(row => row.store_id === store.id);
      const fields = latest?.fields || {};
      return { name: store.name, county: store.county, address: address(store),
        contacts: join([fields.representative_name && `${fields.representative_name}${fields.representative_title ? ` (${fields.representative_title})` : ''}`, ...related.map(row => row.contact_name && `${row.contact_name}${row.contact_title ? ` (${row.contact_title})` : ''}`)]),
        phones: join([store.phone, store.notification_phone && `${store.notification_phone} (SMS notifications)`, fields.phone && fields.phone !== store.phone ? `${fields.phone} (setup: ${latest.status})` : '']),
        emails: join([store.email, ...(store.contact_emails || []), ...related.map(row => row.contact_email), fields.email && fields.email !== store.email ? `${fields.email} (setup: ${latest.status})` : '']),
        notes: join([store.license_number && `ABC license: ${store.license_number}`, ...related.map(row => row.pos_contact && `POS contact: ${row.pos_contact}`), latest && `Representative details from ${latest.status} setup submission.`]) };
    });
    const pending = onboarding.filter(row => !stores.some(store => store.id === row.store_id)).map(row => ({ name: row.name, address: row.address, contacts: join([row.contact_name, row.contact_title]), emails: row.contact_email, notes: row.pos_contact && `POS contact: ${row.pos_contact}` }));
    const signupRows = signups.map(row => ({ name: row.store_name, county: row.county, address: address(row), contacts: row.contact_name, phones: row.contact_phone, emails: row.contact_email, website: row.website, notes: `Signup status: ${row.status || 'pending'}` }));
    const sort = rows => rows.sort((a, b) => (a.county || '').localeCompare(b.county || '') || (a.name || '').localeCompare(b.name || ''));
    return [{ title: 'Saved retailer stores', rows: sort(saved) }, { title: 'Other onboarding contacts', rows: sort(pending) }, { title: 'Retailer signup contacts', rows: sort(signupRows) }];
  } });
}