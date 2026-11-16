import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export default function useRetailerInventory(storeId) {
  const client = useQueryClient();
  const query = useInfiniteQuery({
    queryKey: ['retailer-inventory', storeId],
    initialPageParam: null,
    queryFn: ({ pageParam }) => base44.entities.Product.filter({ store_id: storeId }, { sort: '-created_date', limit: 50, cursor: pageParam }),
    getNextPageParam: page => page.has_more ? page.next_cursor : undefined,
    enabled: Boolean(storeId),
    retry: false,
  });
  const mutation = useMutation({
    mutationFn: async payload => {
      const { data } = await base44.functions.invoke('updateRetailerProduct', { ...payload, store_id: storeId });
      if (data?.success !== true) throw new Error(data?.error || 'The product change could not be saved.');
      return data;
    },
    onSuccess: () => Promise.all(['retailer-inventory', 'store-products', 'portal-products', 'products'].map(key => client.invalidateQueries({ queryKey: [key, storeId] }))),
  });
  return { query, mutation, products: query.data?.pages.flatMap(page => page.items) || [] };
}