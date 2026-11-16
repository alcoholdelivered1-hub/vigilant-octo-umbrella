import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Store, Package, ShoppingBag, Truck, Loader2, AlertCircle, Bell, MapPin, CheckCircle2, Save } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import RetailerDirectContact from '@/components/partner/RetailerDirectContact';

const fmt = (n) => (Number(n) || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

const STATUS_FLOW = ['pending', 'confirmed', 'preparing', 'pickup_ready', 'in_transit', 'delivered'];

export default function RetailerPortal() {
  const [selectedStore, setSelectedStore] = useState('');
  const [tab, setTab] = useState('orders');
  const queryClient = useQueryClient();

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => base44.auth.me(),
  });

  const { data: allStores = [], isLoading: storesLoading } = useQuery({
    queryKey: ['portal-stores', user?.email, user?.role],
    queryFn: async () => {
      if (user?.role === 'admin') return base44.entities.Store.list('name', 200);
      return base44.entities.Store.filter({ email: user.email }, 'name', 100);
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (allStores.length > 0 && !selectedStore) setSelectedStore(allStores[0].id);
  }, [allStores]);

  const resolvedStore = selectedStore || allStores[0]?.id || '';

  const { data: activeOrders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['portal-active-orders', resolvedStore],
    queryFn: async () => (await base44.functions.invoke('getStoreActiveOrders', { store_id: resolvedStore })).data.orders,
    select: data => data.filter(o => ['pending', 'confirmed', 'preparing', 'pickup_ready', 'in_transit'].includes(o.status)),
    enabled: !!resolvedStore,
    refetchInterval: 15000,
  });

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['portal-products', resolvedStore],
    queryFn: () => base44.entities.Product.filter({ store_id: resolvedStore }, 'name', 300),
    enabled: !!resolvedStore,
  });

  // Real-time: refresh orders on any order change
  useEffect(() => {
    const unsubscribe = base44.entities.Order.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['portal-active-orders', resolvedStore] });
    });
    return unsubscribe;
  }, [resolvedStore, queryClient]);

  const acceptMutation = useMutation({
    mutationFn: async ({ id }) => {
      const { data } = await base44.functions.invoke('updateRetailerOrderStatus', { order_id: id, status: 'confirmed' });
      if (data?.success !== true) throw new Error(data?.error || 'Order acceptance was not confirmed.');
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['portal-active-orders', resolvedStore] }),
    onError: e => toast.error(e.response?.data?.error || e.message),
  });

  const markReadyMutation = useMutation({
    mutationFn: async ({ id }) => {
      const { data } = await base44.functions.invoke('updateRetailerOrderStatus', { order_id: id, status: 'pickup_ready' });
      if (data?.success !== true) throw new Error(data?.error || 'The pickup status was not updated.');
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['portal-active-orders', resolvedStore] }),
    onError: e => toast.error(e.response?.data?.error || e.message),
  });

  const productMutation = useMutation({
    mutationFn: ({ id, data }) => base44.functions.invoke('updateRetailerProduct', { product_id: id, ...data }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['portal-products', resolvedStore] }),
    onError: e => toast.error(e.response?.data?.error || e.message),
  });

  const isLoading = userLoading || storesLoading;

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading your portal…
    </div>
  );

  if (allStores.length === 0) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <AlertCircle className="w-12 h-12 text-muted-foreground/40 mb-4" />
      <h2 className="font-display text-xl font-bold mb-2">No Store Linked</h2>
      <p className="text-muted-foreground text-sm max-w-xs">
        Your account isn't linked to a store yet. Ensure your store's notification email matches your login email, or contact the administrator.
      </p>
      <div className="mt-4"><RetailerDirectContact /></div>
    </div>
  );

  const storeObj = allStores.find(s => s.id === resolvedStore);
  const pendingCount = activeOrders.filter(o => o.status === 'pending').length;

  const TABS = [
    { id: 'orders', label: 'Incoming Orders', icon: ShoppingBag, badge: pendingCount },
    { id: 'delivery', label: 'Delivery Status', icon: Truck },
    { id: 'inventory', label: 'Inventory', icon: Package },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-2">
            <Store className="w-7 h-7 text-primary" /> Retailer Portal
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Manage inventory, incoming orders, and live delivery status.</p>
          <div className="flex flex-wrap gap-4 mt-2">
            <Link to={`/onboarding?store_id=${resolvedStore}`} className="text-sm text-primary underline">Complete retailer setup</Link>
            <Link to={`/retailer-inventory?store_id=${resolvedStore}`} className="text-sm text-primary underline">Manage store inventory</Link>
            {resolvedStore === '6abe70789403f586d10561db' && <Link to={`/stores/${resolvedStore}`} className="text-sm text-primary underline">View Liquor King storefront</Link>}
          </div>
        </div>
        {allStores.length > 1 && (
          <Select value={resolvedStore} onValueChange={setSelectedStore}>
            <SelectTrigger className="w-full sm:w-64"><SelectValue /></SelectTrigger>
            <SelectContent>
              {allStores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      <RetailerDirectContact />

      {markReadyMutation.data?.driver_alert?.startsWith('failed:') && <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">Order {markReadyMutation.data.order_number} was marked ready, but the driver notification failed. Contact the assigned driver directly before pickup. Do not repeat the payment.</p>}

      {/* Pending alert banner */}
      {pendingCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
          <Bell className="w-5 h-5 text-amber-600 animate-pulse" />
          <p className="text-sm font-medium text-amber-800">
            {pendingCount} new order{pendingCount > 1 ? 's' : ''} awaiting your confirmation.
          </p>
        </div>
      )}

      {/* Store quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border rounded-2xl p-4">
          <ShoppingBag className="w-5 h-5 text-primary mb-2" />
          <p className="text-2xl font-bold">{activeOrders.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Active Orders</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <Bell className="w-5 h-5 text-amber-500 mb-2" />
          <p className="text-2xl font-bold text-amber-700">{pendingCount}</p>
          <p className="text-xs text-amber-700 mt-1">Pending Confirmation</p>
        </div>
        <div className="bg-card border rounded-2xl p-4">
          <Package className="w-5 h-5 text-muted-foreground mb-2" />
          <p className="text-2xl font-bold">{products.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Products Listed</p>
        </div>
        <div className="bg-card border rounded-2xl p-4">
          <Truck className="w-5 h-5 text-blue-500 mb-2" />
          <p className="text-2xl font-bold">{activeOrders.filter(o => o.status === 'in_transit').length}</p>
          <p className="text-xs text-muted-foreground mt-1">Out for Delivery</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                tab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-4 h-4" /> {t.label}
              {t.badge ? <span className="bg-secondary text-secondary-foreground text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center">{t.badge}</span> : null}
            </button>
          );
        })}
      </div>

      {/* Incoming Orders */}
      {tab === 'orders' && (
        ordersLoading ? (
          <div className="space-y-3">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)}</div>
        ) : activeOrders.length === 0 ? (
          <div className="text-center py-16 bg-card border rounded-2xl">
            <ShoppingBag className="w-12 h-12 text-muted-foreground/30 mx-auto" />
            <p className="text-muted-foreground mt-4">No active orders right now</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeOrders.map(o => (
              <div key={o.id} className="bg-card border rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <p className="font-semibold">{o.order_number || o.id}</p>
                    <p className="text-xs text-muted-foreground">{o.customer_name} · {o.customer_phone || o.customer_email}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
                    o.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                    o.status === 'in_transit' ? 'bg-blue-100 text-blue-700' :
                    o.status === 'pickup_ready' ? 'bg-purple-100 text-purple-700' : 'bg-muted text-muted-foreground'
                  }`}>{o.status.replace(/_/g, ' ')}</span>
                </div>
                <div className="text-sm space-y-0.5 mb-3">
                  {(o.items || []).map((it, i) => (
                    <p key={i} className="text-muted-foreground">{it.quantity}× {it.product_name} — {fmt(it.subtotal)}</p>
                  ))}
                  <p className="font-medium pt-1">Total: {fmt(o.total)}</p>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1"><MapPin className="w-3 h-3" /> {o.delivery_address}</p>
                </div>
                <div className="flex gap-2">
                  {o.status === 'pending' && (
                    <Button size="sm" onClick={() => acceptMutation.mutate({ id: o.id })} disabled={acceptMutation.isPending}>
                      <CheckCircle2 className="w-4 h-4 mr-1.5" /> Accept Order
                    </Button>
                  )}
                  {(o.status === 'confirmed' || o.status === 'preparing') && (
                    <Button size="sm" variant="outline" onClick={() => markReadyMutation.mutate({ id: o.id })} disabled={markReadyMutation.isPending}>
                      Mark Ready for Pickup
                    </Button>
                  )}
                  <span className="text-xs text-muted-foreground self-center ml-auto">{o.created_date ? format(new Date(o.created_date), 'MMM d, h:mm a') : ''}</span>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Delivery Status */}
      {tab === 'delivery' && (
        ordersLoading ? (
          <div className="space-y-3">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}</div>
        ) : activeOrders.length === 0 ? (
          <div className="text-center py-16 bg-card border rounded-2xl">
            <Truck className="w-12 h-12 text-muted-foreground/30 mx-auto" />
            <p className="text-muted-foreground mt-4">No deliveries in progress</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeOrders.map(o => {
              const stepIdx = STATUS_FLOW.indexOf(o.status);
              return (
                <div key={o.id} className="bg-card border rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-medium">{o.order_number || o.id}</p>
                    <span className="text-xs text-muted-foreground">{o.driver_name ? `Driver: ${o.driver_name}` : 'Awaiting driver'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {STATUS_FLOW.map((s, i) => (
                      <div key={s} className="flex-1 flex items-center">
                        <div className={`h-2 flex-1 rounded-full ${i <= stepIdx ? 'bg-primary' : 'bg-muted'}`} />
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>Placed</span><span>Confirmed</span><span>Preparing</span><span>Ready</span><span>En route</span><span>Delivered</span>
                  </div>
                  {o.driver_current_latitude && (
                    <p className="text-xs text-muted-foreground mt-2 font-mono">
                      Driver GPS: {o.driver_current_latitude?.toFixed(5)}, {o.driver_current_longitude?.toFixed(5)}
                      {o.driver_location_updated_at && ` · updated ${format(new Date(o.driver_location_updated_at), 'h:mm a')}`}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Inventory */}
      {tab === 'inventory' && (
        productsLoading ? (
          <div className="space-y-3">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)}</div>
        ) : products.length === 0 ? (
          <div className="text-center py-16 bg-card border rounded-2xl">
            <Package className="w-12 h-12 text-muted-foreground/30 mx-auto" />
            <p className="text-muted-foreground mt-4">No products listed yet</p>
            <Link to="/admin/inventory-upload" className="inline-block mt-4"><Button variant="outline" size="sm">Upload Inventory</Button></Link>
          </div>
        ) : (
          <div className="bg-card border rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Product</th>
                  <th className="text-left p-3 font-medium">Category</th>
                  <th className="text-left p-3 font-medium">Price</th>
                  <th className="text-left p-3 font-medium">Stock</th>
                  <th className="text-left p-3 font-medium">Available</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {products.map(p => (
                  <ProductRow key={p.id} product={p} onSave={(data) => productMutation.mutate({ id: p.id, data })} saving={productMutation.isPending} />
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}

function ProductRow({ product, onSave, saving }) {
  const [price, setPrice] = useState(product.price?.toString() || '');
  const [stock, setStock] = useState(product.stock_quantity?.toString() || '');
  const [dirty, setDirty] = useState(false);

  const markDirty = (setter) => (e) => { setter(e.target.value); setDirty(true); };

  return (
    <tr className="hover:bg-muted/30">
      <td className="p-3">
        <p className="font-medium">{product.name}</p>
        <p className="text-xs text-muted-foreground">{product.brand} · {product.volume}</p>
      </td>
      <td className="p-3 capitalize text-xs">{product.category}</td>
      <td className="p-3">
        <Input type="number" step="0.01" value={price} onChange={markDirty(setPrice)} className="h-8 w-24 text-xs" />
      </td>
      <td className="p-3">
        <Input type="number" value={stock} onChange={markDirty(setStock)} placeholder="—" className="h-8 w-20 text-xs" />
      </td>
      <td className="p-3">
        <div className="flex items-center gap-2">
          <Select
            value={product.in_stock ? 'yes' : 'no'}
            onValueChange={(v) => onSave({ in_stock: v === 'yes' })}
          >
            <SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="yes">In Stock</SelectItem>
              <SelectItem value="no">Out</SelectItem>
            </SelectContent>
          </Select>
          {dirty && (
            <Button size="sm" variant="ghost" className="h-8 px-2" disabled={saving} onClick={() => onSave({ price: parseFloat(price) || 0, stock_quantity: stock ? parseInt(stock) : null })}>
              <Save className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}