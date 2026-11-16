import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

export default function useRetailerLaunchPreviews(refreshVersion = 0, storeId = '', enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['retailer-launch-previews', user?.id, refreshVersion],
    enabled: Boolean(user && enabled),
    staleTime: 300000,
    refetchInterval: 300000,
    refetchOnWindowFocus: false,
    retry: false,
    queryFn: async () => {
      const { data } = await base44.functions.invoke('retailerGoLive', { action: 'preview_batch', preview_only: true, activate: false });
      if (!Array.isArray(data?.results)) throw new Error(data?.error || 'Could not load launch requirements.');
      return data.results;
    },
    select: results => {
      if (!storeId) return results;
      const result = results.find(item => item.store_id === storeId);
      if (!result) throw new Error('This retailer is unavailable or you do not have access.');
      return result;
    },
  });
}