import useRetailerLaunchPreviews from '@/components/partner/useRetailerLaunchPreviews';

export default function useLaunchFocus(stores, refreshVersion) {
  const query = useRetailerLaunchPreviews(refreshVersion, '', stores.length > 0);
  const entries = stores.map(store => ({ store, data: query.data?.find(item => item.store_id === store.id) }));
  const beverage = entries.find(({ store }) => /beverage king/i.test(store.name));
  const colonial = entries.find(({ store }) => /colonial wines/i.test(store.name));
  const outstanding = item => item.data.checks.filter(check => check.status !== 'complete').length;
  const candidates = entries.filter(item => item.data && item !== beverage && item !== colonial && !/distribut/i.test(item.store.name));
  candidates.sort((a, b) => outstanding(a) - outstanding(b) || a.store.name.localeCompare(b.store.name));
  const failures = query.isError ? stores.length : 0;
  const loading = query.isPending;
  return { focus: [beverage, colonial, !loading ? candidates[0] : null].filter(Boolean), failures, loading, compared: entries.filter(item => item.data).length };
}