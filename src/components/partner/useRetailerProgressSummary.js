import useRetailerLaunchPreviews from '@/components/partner/useRetailerLaunchPreviews';

export default function useRetailerProgressSummary(stores) {
  const query = useRetailerLaunchPreviews(0, '', stores.length > 0);
  const data = query.data && stores.map(store => {
    const preview = query.data.find(item => item.store_id === store.id);
    if (!preview) return { id: store.id, name: store.name, percent: null };
    const completed = preview.checks.filter(check => check.status === 'complete').length;
    return { id: store.id, name: store.name, completed, total: preview.checks.length, percent: Math.round(completed / preview.checks.length * 100), live: preview.live };
  }).sort((a, b) => (b.percent ?? -1) - (a.percent ?? -1) || a.name.localeCompare(b.name));
  return { ...query, data };
}