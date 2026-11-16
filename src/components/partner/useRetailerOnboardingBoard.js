import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export default function useRetailerOnboardingBoard(user) {
  const client = useQueryClient();
  const queryKey = ['retailer-onboarding-board', user?.id, user?.role];
  const query = useQuery({
    queryKey, enabled: Boolean(user),
    queryFn: async () => {
      const stores = [];
      const filter = user.role === 'admin' ? {} : { $or: [{ email: user.email }, { contact_emails: { $in: [user.email] } }] };
      let cursor = null;
      do {
        const page = await base44.entities.Store.filter(filter, { sort: 'name', limit: 100, cursor });
        stores.push(...page.items);
        cursor = page.next_cursor;
      } while (cursor);
      return stores;
    },
  });
  const move = useMutation({
    mutationFn: ({ id, status }) => {
      if (user.role !== 'admin' || status === 'live') throw new Error('Submit in Retailer Setup. Live activation requires final administrator approval and launch checks.');
      return base44.entities.Store.update(id,{ onboarding_status:status });
    },
    onMutate: async ({ id, status }) => {
      await client.cancelQueries({ queryKey });
      const previous = client.getQueryData(queryKey);
      client.setQueryData(queryKey, stores => stores?.map(store => store.id === id ? { ...store, onboarding_status: status } : store));
      return { previous };
    },
    onError: (_error, _variables, context) => client.setQueryData(queryKey, context.previous),
    onSuccess: () => client.invalidateQueries({ queryKey: ['retailer-stores'] }),
    onSettled: () => client.invalidateQueries({ queryKey }),
  });
  useEffect(() => {
    if (!user) return;
    return base44.entities.Store.subscribe(() => client.invalidateQueries({ queryKey: ['retailer-onboarding-board'] }));
  }, [user?.id, client]);
  return { query, move };
}