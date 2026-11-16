import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RefreshCw, Package, Store as StoreIcon, AlertCircle, CheckCircle2, Loader2, Wifi, WifiOff } from 'lucide-react';

const BEVERAGE_KING_STORE_ID = '6a32d14d09b760f592dbf19e';

export default function RealTimeInventory() {
  const [stores, setStores] = useState([]);
  const [counts, setCounts] = useState({});
  const [cityHiveStores, setCityHiveStores] = useState(new Set());
  const [cloverStores, setCloverStores] = useState(new Set());
  const [lastSync, setLastSync] = useState({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [syncResults, setSyncResults] = useState(null);
  const [selectedStore, setSelectedStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [storesPage, countsRes, cityHiveRes, cloverRes] = await Promise.all([
        base44.entities.Store.filter({ is_active: true }, { sort: 'name', limit: 500 }),
        base44.entities.Product.aggregate({ groupBy: 'store_id' }),
        base44.entities.CityHiveConnection.filter({}),
        base44.entities.CloverConnection.filter({}),
      ]);

      setStores(storesPage.items || []);

      const countMap = {};
      for (const row of (countsRes.rows || [])) {
        countMap[row.store_id] = row.count;
      }
      setCounts(countMap);

      setCityHiveStores(new Set(cityHiveRes.map(c => c.store_id)));
      setCloverStores(new Set(cloverRes.map(c => c.store_id)));

      const syncMap = {};
      for (const c of cityHiveRes) syncMap[c.store_id] = c.last_synced_at;
      setLastSync(syncMap);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const unsubscribe = base44.entities.Product.subscribe(() => { loadData(); });
    return unsubscribe;
  }, [loadData]);

  useEffect(() => {
    if (!selectedStore) return;
    const loadProducts = async () => {
      setLoadingProducts(true);
      try {
        const { items } = await base44.entities.Product.filter({ store_id: selectedStore }, { sort: 'name', limit: 100 });
        setProducts(items);
      } catch {
        setProducts([]);
      }
      setLoadingProducts(false);
    };
    loadProducts();

    const unsubscribe = base44.entities.Product.subscribe((event) => {
      if (!event.data || event.data?.store_id === selectedStore) loadProducts();
    });
    return unsubscribe;
  }, [selectedStore]);

  const handleSyncAll = async () => {
    setSyncing(true);
    setError('');
    try {
      const res = await base44.functions.invoke('syncAllStoreInventory', {});
      if (res.data?.success) {
        setSyncResults(res.data.summary);
        loadData();
      } else {
        setError(res.data?.error || 'Sync failed');
      }
    } catch (e) {
      setError(e.message);
    }
    setSyncing(false);
  };

  const getSyncSource = (storeId) => {
    if (cityHiveStores.has(storeId)) return 'CityHive';
    if (cloverStores.has(storeId)) return 'Clover';
    if (storeId === BEVERAGE_KING_STORE_ID) return 'Liquor Bee';
    return null;
  };

  const totalProducts = Object.values(counts).reduce((a, b) => a + (b || 0), 0);
  const syncedStores = stores.filter(s => getSyncSource(s.id)).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div>
        <Link to="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="w-4 h-4" /> Back to Admin
        </Link>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold flex items-center gap-2">
              <Package className="w-7 h-7 text-primary" /> Real-Time Inventory
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Live inventory across all stores. Updates automatically every day at 6 AM.
            </p>
          </div>
          <Button onClick={handleSyncAll} disabled={syncing} className="shrink-0">
            {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            {syncing ? 'Syncing...' : 'Sync All'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <StoreIcon className="w-4 h-4 text-primary" />
            <p className="text-xs text-muted-foreground">Total Stores</p>
          </div>
          <p className="text-2xl font-bold">{stores.length}</p>
        </div>
        <div className="bg-card border rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Package className="w-4 h-4 text-secondary" />
            <p className="text-xs text-muted-foreground">Total Products</p>
          </div>
          <p className="text-2xl font-bold">{totalProducts}</p>
        </div>
        <div className="bg-card border rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Wifi className="w-4 h-4 text-emerald-500" />
            <p className="text-xs text-muted-foreground">Auto-Synced</p>
          </div>
          <p className="text-2xl font-bold text-emerald-600">{syncedStores}</p>
        </div>
        <div className="bg-card border rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <WifiOff className="w-4 h-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Need Setup</p>
          </div>
          <p className="text-2xl font-bold text-muted-foreground">{stores.length - syncedStores}</p>
        </div>
      </div>

      {syncResults && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <p className="text-sm text-emerald-800">
            Synced {syncResults.synced} of {syncResults.total_stores} stores
            {syncResults.errors > 0 && ` (${syncResults.errors} errors)`}
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="bg-card border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Store</th>
                <th className="text-left px-4 py-3 font-semibold hidden sm:table-cell">City</th>
                <th className="text-left px-4 py-3 font-semibold">Sync Source</th>
                <th className="text-right px-4 py-3 font-semibold">Products</th>
                <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Last Sync</th>
              </tr>
            </thead>
            <tbody>
              {stores.map(store => {
                const source = getSyncSource(store.id);
                const count = counts[store.id] || 0;
                const syncTime = lastSync[store.id];
                return (
                  <tr
                    key={store.id}
                    onClick={() => setSelectedStore(selectedStore === store.id ? null : store.id)}
                    className={`border-b cursor-pointer hover:bg-muted/30 ${selectedStore === store.id ? 'bg-primary/5' : ''}`}
                  >
                    <td className="px-4 py-3 font-medium">{store.name}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{store.city}</td>
                    <td className="px-4 py-3">
                      {source ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-700">
                          <Wifi className="w-3 h-3" /> {source}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground">
                          <WifiOff className="w-3 h-3" /> No POS
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-bold">{count}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs hidden md:table-cell">
                      {syncTime ? new Date(syncTime).toLocaleString() : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selectedStore && (
        <div className="bg-card border rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">
              {stores.find(s => s.id === selectedStore)?.name} — Live Products
            </h3>
            {loadingProducts && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          </div>
          {products.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No products found. Run a sync or add products manually.</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-96 overflow-y-auto">
              {products.map(p => (
                <div key={p.id} className="border rounded-lg px-3 py-2 text-xs">
                  <p className="font-medium truncate">{p.name}</p>
                  <div className="flex items-center justify-between mt-1 text-muted-foreground">
                    <span>{p.category}</span>
                    <span className="font-bold">${p.price?.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`inline-block w-2 h-2 rounded-full ${p.in_stock ? 'bg-emerald-500' : 'bg-red-400'}`} />
                    <span className="text-muted-foreground">{p.in_stock ? 'In Stock' : 'Out'}</span>
                    {p.stock_quantity != null && <span className="text-muted-foreground">({p.stock_quantity})</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}