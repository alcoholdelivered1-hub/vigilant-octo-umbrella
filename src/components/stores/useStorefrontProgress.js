import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

export default function useStorefrontProgress(store) {
  const { user } = useAuth();
  const email = user?.email?.trim().toLowerCase();
  const canView = Boolean(user && (user.role === 'admin' || (email && [store.email, ...(store.contact_emails || [])].some(contact => typeof contact === 'string' && contact.trim().toLowerCase() === email))));
  const query = useQuery({
    queryKey: ['storefront-launch-progress', store.id, user?.id],
    enabled: canView,
    staleTime: 30000,
    refetchInterval: 60000,
    refetchOnWindowFocus: true,
    retry: false,
    queryFn: async () => {
      const { data } = await base44.functions.invoke('retailerGoLive', { store_id: store.id, preview_only: true, activate: false });
      if (!Array.isArray(data?.checks)) throw new Error(data?.error || 'Could not load go-live progress.');
      // Current review gates take precedence over legacy flags and saved store fields.
      const reviewPrefixes = { profile: 'Business and contact details:', license: 'Retail license and evidence:', operations: 'Hours, location and delivery eligibility:', inventory: 'Sellable inventory and pricing review:', test: 'Device and notification test:', agreement: 'Agreement:' };
      return { ...data, checks: data.checks.map(check => {
        const prefix = reviewPrefixes[check.key];
        const review = prefix && data.checks.find(item => item.status !== 'complete' && item.detail?.startsWith(prefix));
        return review ? { ...check, status: 'missing', detail: review.detail } : check;
      }) };
    },
  });
  return { ...query, canView, signedIn: Boolean(user) };
}