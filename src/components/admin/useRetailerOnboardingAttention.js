import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

const sources = [['RetailerAgreement', 'submitted'], ['StoreSetupDocument', 'pending_review']];
async function loadSubmissions() {
  const groups = await Promise.all(sources.map(async ([entity, status]) => {
    const records = []; let cursor = null;
    do {
      const page = await base44.entities[entity].filter({ status }, { sort: '-created_date', limit: 100, cursor });
      records.push(...page.items); cursor = page.next_cursor;
    } while (cursor);
    return records.map(record => ({ ...record, entity, reviewKey: `${entity}:${record.id}:${record.submitted_at || record.created_date}`, label: entity === 'RetailerAgreement' ? 'Submitted retailer agreement' : `${record.kind.replace(/_/g, ' ')}: ${record.filename}` }));
  }));
  const agreementDocuments = new Set(groups[0].map(record => record.document_id).filter(Boolean));
  return [...groups[0], ...groups[1].filter(record => !agreementDocuments.has(record.id))];
}
export default function useRetailerOnboardingAttention() {
  const client = useQueryClient();
  const { data: user } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });
  const enabled = user?.role === 'admin';
  const queryKey = ['retailer-onboarding-attention', user?.id];
  const query = useQuery({ queryKey, queryFn: loadSubmissions, enabled, refetchInterval: 15000 });
  const storageKey = user?.id ? `retailer-onboarding-reviewed:${user.id}` : '';
  const [version, setVersion] = useState(0);
  const reviewed = useMemo(() => new Set(storageKey ? (localStorage.getItem(storageKey) || '').split('|').filter(Boolean) : []), [storageKey, version]);
  useEffect(() => {
    if (!enabled) return;
    const unsubscribers = sources.map(([entity]) => base44.entities[entity].subscribe(() => client.invalidateQueries({ queryKey: ['retailer-onboarding-attention', user.id] })));
    return () => unsubscribers.forEach(unsubscribe => unsubscribe());
  }, [client, enabled, user?.id]);
  const markReviewed = useCallback(item => {
    if (!storageKey) return;
    const saved = new Set((localStorage.getItem(storageKey) || '').split('|').filter(Boolean));
    saved.add(item.reviewKey); localStorage.setItem(storageKey, [...saved].join('|'));
    setVersion(value => value + 1);
  }, [storageKey]);
  return { pending: enabled ? (query.data || []).filter(item => !reviewed.has(item.reviewKey)) : [], markReviewed, isLoading: query.isLoading, error: query.error, refetch: query.refetch };
}