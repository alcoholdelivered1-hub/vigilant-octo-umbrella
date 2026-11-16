import { base44 } from '@/api/base44Client';

export async function getPublicStores({ storeId, liveOnly = false } = {}) {
  const { data } = await base44.functions.invoke('public-store-directory', { store_id: storeId, live_only: liveOnly });
  if (!Array.isArray(data?.stores)) throw new Error(data?.error || 'Stores could not be loaded.');
  return data.stores;
}
