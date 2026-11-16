import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export default function useOwnerStores(user) {
  return useQuery({
    queryKey: ['owner-stores', user?.email, user?.role],
    queryFn: async () => {
      const stores = [];
      let cursor = null;
      do {
        const page = await base44.entities.Store.list({ sort: 'name', limit: 100, cursor });
        stores.push(...page.items);
        cursor = page.has_more === true ? page.next_cursor : null;
      } while (cursor);
      const email = user.email?.trim().toLowerCase();
      return user.role === 'admin' ? stores : stores.filter(store => email &&
        [store.email, ...(store.contact_emails || [])].some(contact => contact?.trim().toLowerCase() === email));
    },
    enabled: !!user,
  });
}