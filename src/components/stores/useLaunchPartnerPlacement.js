import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export default function useLaunchPartnerPlacement() {
  const { data = [] } = useQuery({
    queryKey: ['launch-partner-placements'], staleTime: 60000, refetchInterval: 60000,
    queryFn: async () => {
      let cursor = null;
      const records = [];
      do {
        const page = await base44.entities.LaunchPartnerPlacement.filter({ ends_at: { $gt: new Date().toISOString() } }, { limit: 100, cursor });
        records.push(...page.items);
        cursor = page.next_cursor;
      } while (cursor);
      return records;
    },
  });
  const now = Date.now();
  const featured = new Set(data.filter(p => Date.parse(p.starts_at) <= now && Date.parse(p.ends_at) > now).map(p => p.store_id));
  return store => store.placement_tier === 'premium' ? 'premium' : featured.has(store.id) ? 'featured' : store.placement_tier || 'standard';
}