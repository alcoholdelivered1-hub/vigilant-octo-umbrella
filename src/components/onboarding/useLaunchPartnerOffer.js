import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export default function useLaunchPartnerOffer(storeId) {
  const client = useQueryClient();
  const key = ['launch-partner-offer', storeId];
  const call = async (payload) => {
    const { data } = await base44.functions.invoke('launchPartnerOffer', { store_id: storeId, ...payload });
    if (data.error) throw new Error(data.error);
    return data;
  };
  const query = useQuery({ queryKey: key, queryFn: () => call({ action: 'status' }), enabled: !!storeId, refetchInterval: 60000 });
  const mutation = useMutation({ mutationFn: call, onSuccess: data => {
    client.setQueryData(key, data);
    client.invalidateQueries({ queryKey: ['launch-partner-placements'] });
  } });
  return { ...query, mutation };
}