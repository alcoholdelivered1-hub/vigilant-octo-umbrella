import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Search, Store, RefreshCw, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import StoreCard from '@/components/stores/StoreCard';
import { Skeleton } from '@/components/ui/skeleton';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

function haversineMiles(lat1, lon1, lat2, lon2) {
  const R = 3958.8;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export default function Stores() {
  const [search, setSearch] = useState('');
  const [userLoc, setUserLoc] = useState(null);
  const queryClient = useQueryClient();

  const { data: stores = [], isLoading } = useQuery({
    queryKey: ['stores'],
    queryFn: () => base44.entities.Store.filter({ is_active: true }),
  });

  const refreshing = usePullToRefresh(() =>
    queryClient.invalidateQueries({ queryKey: ['stores'] })
  );

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLoc({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => {},
      { timeout: 10000 }
    );
  }, []);

  const tierOrder = { premium: 0, featured: 1, standard: 2 };

  const filtered = stores
    .filter(s =>
      s.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.city?.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      // Sort by distance from user first (nearest town/county on top), then by placement tier
      if (userLoc) {
        const da = a.latitude && a.longitude ? haversineMiles(userLoc.lat, userLoc.lon, a.latitude, a.longitude) : Infinity;
        const db = b.latitude && b.longitude ? haversineMiles(userLoc.lat, userLoc.lon, b.latitude, b.longitude) : Infinity;
        if (da !== db) return da - db;
      }
      return (tierOrder[a.placement_tier] ?? 2) - (tierOrder[b.placement_tier] ?? 2);
    });

  // Group stores by city, sorted by distance to user (nearest city first)
  const grouped = filtered.reduce((acc, store) => {
    const city = store.city || 'Other';
    if (!acc[city]) acc[city] = [];
    acc[city].push(store);
    return acc;
  }, {});
  const cityNames = Object.keys(grouped).sort((a, b) => {
    if (!userLoc) return a.localeCompare(b);
    const da = Math.min(...grouped[a].map(s => s.latitude && s.longitude ? haversineMiles(userLoc.lat, userLoc.lon, s.latitude, s.longitude) : Infinity));
    const db = Math.min(...grouped[b].map(s => s.latitude && s.longitude ? haversineMiles(userLoc.lat, userLoc.lon, s.latitude, s.longitude) : Infinity));
    return da - db;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {refreshing && (
        <div className="flex justify-center py-3">
          <RefreshCw className="w-5 h-5 animate-spin text-primary" />
        </div>
      )}
      <div className="flex items-center justify-between gap-3 mb-6">
        <h1 className="font-display text-2xl font-bold">Retailers</h1>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 rounded-xl h-10"
            />
          </div>
          <Link
            to="/store-map"
            className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shrink-0"
          >
            <MapPin className="w-4 h-4" /> Map
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
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Store className="w-12 h-12 text-muted-foreground/30 mx-auto" />
          <p className="text-muted-foreground mt-4">No stores found</p>
        </div>
      ) : (
        <div className="space-y-8">
          {cityNames.map(city => (
            <div key={city}>
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="w-4 h-4 text-primary" />
                <h2 className="font-display text-lg font-bold">{city}</h2>
                <span className="text-xs text-muted-foreground">({grouped[city].length})</span>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {grouped[city].map(store => (
                  <StoreCard key={store.id} store={store} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}