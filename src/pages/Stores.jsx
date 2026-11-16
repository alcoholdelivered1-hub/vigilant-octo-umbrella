import React, { useState } from 'react';
import { getPublicStores } from '@/api/publicStores';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Search, Store, RefreshCw, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import StoreDirectoryGrid from '@/components/stores/StoreDirectoryGrid';
import useLaunchPartnerPlacement from '@/components/stores/useLaunchPartnerPlacement';
import { Skeleton } from '@/components/ui/skeleton';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

export default function Stores() {
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const { data: stores = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['stores', 'directory'],
    queryFn: () => getPublicStores(),
  });

  const refreshing = usePullToRefresh(() =>
    queryClient.invalidateQueries({ queryKey: ['stores'] })
  );

  const tierOrder = { premium: 0, featured: 1, standard: 2 };
  const placementTier = useLaunchPartnerPlacement();

  const filtered = stores
    .filter(s =>
      s.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.city?.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => (tierOrder[placementTier(a)] ?? 2) - (tierOrder[placementTier(b)] ?? 2));

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {refreshing && (
        <div className="flex justify-center py-3">
          <RefreshCw className="w-5 h-5 animate-spin text-primary" />
        </div>
      )}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold">Retailer Storefronts</h1>
          <p className="text-muted-foreground mt-1">Select View storefront to open each retailer’s individual design. Coming soon stores can be previewed, but aren’t accepting orders yet.</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search stores..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 rounded-xl"
            />
          </div>
          <Link
            to="/store-map"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shrink-0"
          >
            <MapPin className="w-4 h-4" /> Map View
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array(6).fill(0).map((_, i) => (
            <div key={i} className="bg-card rounded-2xl border overflow-hidden">
              <Skeleton className="aspect-[16/9]" />
              <div className="p-4 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div role="alert" className="text-center py-20 space-y-4">
          <p>Stores could not be loaded. Please try again.</p>
          <button className="rounded-xl border px-4 py-3" onClick={() => refetch()}>Retry loading stores</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Store className="w-12 h-12 text-muted-foreground/30 mx-auto" />
          <p className="text-muted-foreground mt-4">No stores found</p>
        </div>
      ) : (
        <StoreDirectoryGrid stores={filtered} />
      )}
    </div>
  );
}