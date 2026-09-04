import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Package, Bell, CheckCircle2, Search, Filter, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const LOW_THRESHOLD = 5;
const OUT_THRESHOLD = 0;

function StockBar({ qty, max = 20 }) {
  const pct = Math.min(100, Math.round((qty / max) * 100));
  const color = qty === 0 ? 'bg-red-500' : qty <= LOW_THRESHOLD ? 'bg-amber-400' : 'bg-emerald-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-bold w-6 text-right ${qty === 0 ? 'text-red-600' : qty <= LOW_THRESHOLD ? 'text-amber-600' : 'text-emerald-600'}`}>
        {qty}
      </span>
    </div>
  );
}

export default function LowStockDashboard() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [storeFilter, setStoreFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [notifying, setNotifying] = useState(false);

  const { data: products = [], isLoading: pLoading, refetch } = useQuery({
    queryKey: ['low-stock-products'],
    queryFn: () => base44.entities.Product.list(),
    refetchInterval: 60000,
  });

  const { data: stores = [] } = useQuery({
    queryKey: ['stores-list'],
    queryFn: () => base44.entities.Store.list(),
  });

  const storeMap = Object.fromEntries(stores.map(s => [s.id, s]));

  // Only products that track quantity
  const tracked = products.filter(p => p.stock_quantity !== null && p.stock_quantity !== undefined);
  const outOfStock = tracked.filter(p => p.stock_quantity === 0);
  const lowStock = tracked.filter(p => p.stock_quantity > 0 && p.stock_quantity <= LOW_THRESHOLD);
  const healthy = tracked.filter(p => p.stock_quantity > LOW_THRESHOLD);
  const untracked = products.filter(p => p.stock_quantity === null || p.stock_quantity === undefined);

  // Filtered list — show out-of-stock + low-stock by default
  const flagged = [...outOfStock, ...lowStock].filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.brand?.toLowerCase().includes(search.toLowerCase());
    const matchStore = storeFilter === 'all' || p.store_id === storeFilter;
    const matchCat = categoryFilter === 'all' || p.category === categoryFilter;
    return matchSearch && matchStore && matchCat;
  }).sort((a, b) => a.stock_quantity - b.stock_quantity);

  const handleNotifyAll = async () => {
    setNotifying(true);
    try {
      const res = await base44.functions.invoke('checkLowStock', {});
      if (res.data?.success) {
        toast.success(`Alerts sent! ${res.data.low_stock_count} products flagged.${res.data.stores_notified?.length ? ` Stores notified: ${res.data.stores_notified.join(', ')}` : ''}`);
      } else {
        toast.error(res.data?.error || 'Failed to send alerts');
      }
    } catch (e) {
      toast.error('Failed to run low stock check');
    }
    setNotifying(false);
  };

  const handleMarkRestocked = async (product) => {
    await base44.entities.Product.update(product.id, { in_stock: true, stock_quantity: null });
    queryClient.invalidateQueries({ queryKey: ['low-stock-products'] });
    toast.success(`${product.name} marked as restocked`);
  };

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
          <p className="text-3xl font-bold text-red-600">{outOfStock.length}</p>
          <p className="text-xs text-red-700 font-medium mt-1">Out of Stock</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
          <p className="text-3xl font-bold text-amber-600">{lowStock.length}</p>
          <p className="text-xs text-amber-700 font-medium mt-1">Low Stock (≤{LOW_THRESHOLD})</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
          <p className="text-3xl font-bold text-emerald-600">{healthy.length}</p>
          <p className="text-xs text-emerald-700 font-medium mt-1">Healthy Stock</p>
        </div>
        <div className="bg-muted border rounded-2xl p-4 text-center">
          <p className="text-3xl font-bold text-muted-foreground">{untracked.length}</p>
          <p className="text-xs text-muted-foreground font-medium mt-1">Not Tracked</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-1 gap-2 flex-wrap">
          <div className="relative flex-1 min-w-40">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..." className="pl-9" />
          </div>
          <Select value={storeFilter} onValueChange={setStoreFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All Stores" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stores</SelectItem>
              {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {['beer', 'wine', 'spirits', 'mixers', 'accessories'].map(c => (
                <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button size="sm" onClick={handleNotifyAll} disabled={notifying || flagged.length === 0} className="gap-2">
            {notifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
            {notifying ? 'Sending...' : 'Notify Stores'}
          </Button>
        </div>
      </div>

      {/* Flagged product list */}
      <div className="bg-card rounded-2xl border">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Flagged Items
          </h3>
          <span className="text-xs text-muted-foreground">{flagged.length} items</span>
        </div>

        {pLoading ? (
          <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>
        ) : flagged.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <p className="font-medium text-emerald-700">All tracked stock levels are healthy</p>
            <p className="text-xs text-muted-foreground">No items at or below {LOW_THRESHOLD} units</p>
          </div>
        ) : (
          <div className="divide-y">
            {flagged.map(p => {
              const store = storeMap[p.store_id];
              const isOut = p.stock_quantity === 0;
              return (
                <div key={p.id} className={`p-4 flex items-center gap-4 ${isOut ? 'bg-red-50/30' : 'bg-amber-50/20'}`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isOut ? 'bg-red-100' : 'bg-amber-100'}`}>
                    <Package className={`w-4 h-4 ${isOut ? 'text-red-600' : 'text-amber-600'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">{p.name}</span>
                      {p.brand && <span className="text-xs text-muted-foreground">· {p.brand}</span>}
                      <Badge variant="outline" className={`text-xs capitalize ${isOut ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                        {isOut ? 'Out of Stock' : 'Low Stock'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {store?.name || 'Unknown Store'} · {p.category} {p.volume ? `· ${p.volume}` : ''}
                    </p>
                    <div className="mt-2 max-w-40">
                      <StockBar qty={p.stock_quantity} />
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-shrink-0 text-xs"
                    onClick={() => handleMarkRestocked(p)}
                  >
                    Mark Restocked
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Store-level summary */}
      {stores.length > 0 && (
        <div className="bg-card rounded-2xl border">
          <div className="p-4 border-b">
            <h3 className="font-semibold">Stock Status by Store</h3>
          </div>
          <div className="divide-y">
            {stores.map(store => {
              const storeProducts = tracked.filter(p => p.store_id === store.id);
              const storeOut = storeProducts.filter(p => p.stock_quantity === 0).length;
              const storeLow = storeProducts.filter(p => p.stock_quantity > 0 && p.stock_quantity <= LOW_THRESHOLD).length;
              const storeOk = storeProducts.filter(p => p.stock_quantity > LOW_THRESHOLD).length;
              return (
                <div key={store.id} className="p-4 flex items-center gap-4">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{store.name}</p>
                    <p className="text-xs text-muted-foreground">{store.city} · {storeProducts.length} tracked products</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {storeOut > 0 && <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">{storeOut} out</Badge>}
                    {storeLow > 0 && <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">{storeLow} low</Badge>}
                    {storeOut === 0 && storeLow === 0 && <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">All clear</Badge>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}