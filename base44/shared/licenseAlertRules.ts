export const licenseAlertRecipient = 'alcohol.delivered1@gmail.com';

export async function allLicenseRecords(entity) {
  const items = [];
  let cursor;
  do {
    const page = await entity.list({ limit: 200, ...(cursor ? { cursor } : {}) });
    items.push(...page.items);
    cursor = page.has_more ? page.next_cursor : null;
  } while (cursor);
  return items;
}

export function evaluateLicenseAlerts(stores, permits, today) {
  const alerts = [];
  const date = Date.parse(`${today}T00:00:00Z`);
  for (const store of stores) {
    const push = (documentId, kind, key, message, expiry) => alerts.push({ alert_key: `${store.id}:${documentId}:${key}`, store_id: store.id, store_name: store.name, document_id: documentId, kind, message, ...(expiry ? { expiration_date: expiry } : {}), active: true, recipient_email: licenseAlertRecipient });
    if (String(store.license_status).toLowerCase() === 'pending' || /pending/i.test(store.license_number || '')) {
      push(store.id, 'pending', 'pending', `${store.name}: license is PENDING verification.`);
    }
    const documents = [{ id: store.id, expiration_date: store.license_expiration_date, status: store.license_status, label: 'ABC retail license' },
      ...permits.filter(p => p.store_id === store.id && p.permit_type !== 'arkansas_abc_third_party_delivery').map(p => ({ ...p, label: 'Store business license' }))];
    for (const doc of documents) {
      if (doc.id !== store.id && /pending/i.test(doc.status || '')) push(doc.id, 'pending', 'pending', `${store.name}: ${doc.label} is PENDING.`);
      const days = Math.round((Date.parse(`${doc.expiration_date}T00:00:00Z`) - date) / 86400000);
      if (!Number.isFinite(days) || days > 30 || ['revoked', 'suspended'].includes(doc.status)) continue;
      const kind = days < 0 ? 'expired' : 'expiring';
      const stage = days < 0 ? 'expired' : days <= 7 ? '7' : '30';
      push(doc.id, kind, `${doc.expiration_date}:${stage}`, `${store.name}: ${doc.label} ${days < 0 ? 'expired' : `expires in ${days} days`} (${doc.expiration_date}).`, doc.expiration_date);
    }
  }
  return alerts;
}