import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, AlertTriangle, Store, RefreshCw, Loader2,
  CheckCircle2, Search, ChevronDown, ChevronUp, Bell
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const LOW_THRESHOLD = 5;

function StockPill({ count, type }) {
  if (!count) return null;
  const styles = {
    out: 'bg-red-100 text-red-700 border-red-200',
    low: 'bg-amber-100 text-amber-700 border-amber-200',
    ok: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  };
  const labels = { out: 'out of stock', low: 'low stock', ok: 'healthy' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-semibold ${styles[type]}`}>
      {count} {labels[type]}
    </span>
  );
}

function StoreRow({ store, products, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);

  const tracked = products.filter(p => p.stock_quantity != null);
  const outItems = tracked.filter(p => p.stock_quantity === 0);
  const lowItems = tracked.filter(p => p.stock_quantity > 0 && p.stock_quantity <= LOW_THRESHOLD);
  const flagged = [...outItems, ...lowItems].sort((a, b) => a.stock_quantity - b.stock_quantity);
  const hasIssues = flagged.length > 0;

  if (!hasIssues) return null; // Only show stores with issues

  const healthScore = tracked.length
    ? Math.round(((tracked.length - outItems.length - lowItems.length) / tracked.length) * 100)
    : 100;

  return (
    <div className={`border rounded-2xl overflow-hidden ${outItems.length > 0 ? 'border-red-200' : 'border-amber-200'}`}>
      <button
        onClick={() => setOpen(v => !v)}
        className={`w-full p-4 flex items-center gap-3 text-left transition-colors ${outItems.length > 0 ? 'bg-red-50/60 hover:bg-red-50' : 'bg-amber-50/60 hover:bg-amber-50'}`}
      >
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${outItems.length > 0 ? 'bg-red-100' : 'bg-amber-100'}`}>
          <Store className={`w-4 h-4 ${outItems.length > 0 ? 'text-red-600' : 'text-amber-600'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{store.name}</p>
          <p className="text-xs text-muted-foreground">{store.city}{store.county ? ` · ${store.county} Co.` : ''} · {tracked.length} tracked SKUs</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <StockPill count={outItems.length} type="out" />
          <StockPill count={lowItems.length} type="low" />
          <div className="hidden sm:flex items-center gap-1.5">
            <div className="w-16 h-1.5 bg-white rounded-full overflow-hidden border">
              <div
                className={`h-full rounded-full ${healthScore >= 80 ? 'bg-emerald-400' : healthScore >= 50 ? 'bg-amber-400' : 'bg-red-500'}`}
                style={{ width: `${healthScore}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground w-7">{healthScore}%</span>
          </div>
          {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="divide-y bg-card">
          {flagged.map(p => (
            <div key={p.id} className="px-4 py-3 flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${p.stock_quantity === 0 ? 'bg-red-500' : 'bg-amber-400'}`} />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium">{p.name}</span>
                {p.brand && <span className="text-xs text-muted-foreground ml-1.5">· {p.brand}</span>}
                {p.volume && <span className="text-xs text-muted-foreground ml-1">{p.volume}</span>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-sm font-bold tabular-nums ${p.stock_quantity === 0 ? 'text-red-600' : 'text-amber-600'}`}>
                  {p.stock_quantity === 0 ? 'OUT' : `${p.stock_quantity} left`}
                </span>
                <Badge variant="outline" className="text-xs capitalize hidden sm:inline-flex">{p.category}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function InventoryAlerts() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState('worst'); // worst | name | city
  const [notifying, setNotifying] = useState(false);

  const { data: products = [], isLoading: pLoading, refetch, isFetching } = useQuery({
    queryKey: ['inventory-alerts-products'],
    queryFn: () => base44.entities.Product.list('name', 5000),
    refetchInterval: 120000,
  });

  const { data: stores = [], isLoading: sLoading } = useQuery({
    queryKey: ['inventory-alerts-stores'],
    queryFn: () => base44.entities.Store.filter({ is_active: true }, 'name', 200),
  });

  const storeMap = useMemo(() => Object.fromEntries(stores.map(s => [s.id, s])), [stores]);

  // Global summary stats
  const tracked = useMemo(() => products.filter(p => p.stock_quantity != null), [products]);
  const outCount = useMemo(() => tracked.filter(p => p.stock_quantity === 0).length, [tracked]);
  const lowCount = useMemo(() => tracked.filter(p => p.stock_quantity > 0 && p.stock_quantity <= LOW_THRESHOLD).length, [tracked]);
  const healthyCount = useMemo(() => tracked.filter(p => p.stock_quantity > LOW_THRESHOLD).length, [tracked]);

  // Stores with issues
  const storesWithIssues = useMemo(() => {
    return stores
      .map(store => {
        const storeProducts = products.filter(p => {
          const matchStore = p.store_id === store.id;
          const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.brand?.toLowerCase().includes(search.toLowerCase());
          const matchCat = categoryFilter === 'all' || p.category === categoryFilter;
          return matchStore && matchSearch && matchCat;
        });
        const trackedProds = storeProducts.filter(p => p.stock_quantity != null);
        const out = trackedProds.filter(p => p.stock_quantity === 0).length;
        const low = trackedProds.filter(p => p.stock_quantity > 0 && p.stock_quantity <= LOW_THRESHOLD).length;
        return { store, products: storeProducts, out, low, total: trackedProds.length };
      })
      .filter(s => s.out > 0 || s.low > 0)
      .sort((a, b) => {
        if (sortBy === 'worst') return (b.out * 10 + b.low) - (a.out * 10 + a.low);
        if (sortBy === 'name') return a.store.name.localeCompare(b.store.name);
        if (sortBy === 'city') return (a.store.city || '').localeCompare(b.store.city || '');
        return 0;
      });
  }, [stores, products, search, categoryFilter, sortBy]);

  const affectedStoresCount = useMemo(() =>
    stores.filter(store => {
      const storeTracked = products.filter(p => p.store_id === store.id && p.stock_quantity != null);
      return storeTracked.some(p => p.stock_quantity <= LOW_THRESHOLD);
    }).length,
  [stores, products]);

  const handleNotifyAll = async () => {
    setNotifying(true);
    try {
      const res = await base44.functions.invoke('checkLowStock', {});
      if (res.data?.success) {
        toast.success(`Alerts sent! ${res.data.low_stock_count} products flagged.`);
      } else {
        toast.error(res.data?.error || 'Failed to send alerts');
      }
    } catch {
      toast.error('Failed to run low stock check');
    }
    setNotifying(false);
  };

  const isLoading = pLoading || sLoading;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div>
        <Link to="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="w-4 h-4" /> Back to Admin
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold flex items-center gap-2">
              <AlertTriangle className="w-7 h-7 text-amber-500" /> Inventory Alerts
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Stores running low or out of stock based on latest synced data
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
            <Button size="sm" onClick={handleNotifyAll} disabled={notifying} className="gap-2">
              {notifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
              {notifying ? 'Notifying…' : 'Notify All Stores'}
            </Button>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
          <p className="text-3xl font-bold text-red-600">{outCount}</p>
          <p className="text-xs text-red-700 font-medium mt-1">Out of Stock</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
          <p className="text-3xl font-bold text-amber-600">{lowCount}</p>
          <p className="text-xs text-amber-700 font-medium mt-1">Low Stock (≤{LOW_THRESHOLD})</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 text-center">
          <p className="text-3xl font-bold text-orange-600">{affectedStoresCount}</p>
          <p className="text-xs text-orange-700 font-medium mt-1">Affected Stores</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
          <p className="text-3xl font-bold text-emerald-600">{healthyCount}</p>
          <p className="text-xs text-emerald-700 font-medium mt-1">Healthy Items</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products or brands…" className="pl-9" />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {['beer', 'wine', 'spirits', 'mixers', 'accessories'].map(c => (
              <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="worst">Worst First</SelectItem>
            <SelectItem value="name">Store Name</SelectItem>
            <SelectItem value="city">City</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Store list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading inventory…
        </div>
      ) : storesWithIssues.length === 0 ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-12 text-center space-y-3">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
          <p className="font-semibold text-emerald-800 text-lg">All stores are well-stocked!</p>
          <p className="text-sm text-emerald-700">No products at or below {LOW_THRESHOLD} units across all {stores.length} stores.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {storesWithIssues.length} of {stores.length} stores have inventory issues
          </p>
          {storesWithIssues.map(({ store, products: storeProds }, i) => (
            <StoreRow
              key={store.id}
              store={store}
              products={storeProds}
              defaultOpen={i < 3}
            />
          ))}
        </div>
      )}
    </div>
  );
}