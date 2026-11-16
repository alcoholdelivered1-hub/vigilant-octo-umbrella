import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import partnerProgress from '@/components/retailers/partnerProgress';
const entities = ['Store', 'RetailerSetupSubmission', 'StoreSetupDocument', 'RetailerAgreement'];
export default function usePartnerOverview(user) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ['partner-onboarding-overview', user?.id], enabled: user?.role === 'admin', retry: false,
    refetchOnWindowFocus: false, staleTime: 30000,
    queryFn: async () => {
      const results = [];
      for (const name of entities) {
        const records = []; let cursor = null;
        do { const page = await base44.entities[name].list({ sort: name === 'Store' ? 'name' : '-created_date', limit: 100, cursor }); records.push(...page.items); cursor = page.has_more ? page.next_cursor : null; } while (cursor);
        results.push(records);
      }
      return partnerProgress(...results);
    }
  });
  useEffect(() => {
    if (user?.role !== 'admin') return;
    let timer;
    const refresh = () => { clearTimeout(timer); timer = setTimeout(() => client.invalidateQueries({ queryKey: ['partner-onboarding-overview', user.id] }), 500); };
    const unsubscribe = entities.map(name => base44.entities[name].subscribe(refresh));
    return () => { clearTimeout(timer); unsubscribe.forEach(stop => stop()); };
  }, [user?.id, user?.role, client]);
  return query;
}