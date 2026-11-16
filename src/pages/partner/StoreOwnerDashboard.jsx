import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Store, Package, Settings, ShoppingBag, Loader2, AlertCircle, Map, BarChart2, ShieldCheck, History, DollarSign } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ActiveOrdersPanel from '@/components/partner/ActiveOrdersPanel';
import RetailerInventoryWorkspace from '@/components/inventory/RetailerInventoryWorkspace';
import CityHiveConnectionPanel from '@/components/partner/CityHiveConnectionPanel';
import StoreSettingsPanel from '@/components/partner/StoreSettingsPanel';
import StoreOrderMap from '@/components/partner/StoreOrderMap';
import MapOrderSidebar from '@/components/partner/MapOrderSidebar';
import StoreAnalyticsPanel from '@/components/partner/StoreAnalyticsPanel';
import StoreCompliancePanel from '@/components/partner/StoreCompliancePanel';
import StoreOrderHistory from '@/components/partner/StoreOrderHistory';
import StoreRevenuePanel from '@/components/partner/StoreRevenuePanel';
import { cn } from '@/lib/utils';
import FCMSetup from '@/components/notifications/FCMSetup';
import PendingOrderAlert from '@/components/partner/PendingOrderAlert';
import RetailerDirectContact from '@/components/partner/RetailerDirectContact';
import RetailerChatButton from '@/components/messaging/RetailerChatButton';
import useOwnerStores from '@/components/partner/useOwnerStores';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { FIREBASE_CONFIG, FIREBASE_VAPID_KEY } from '@/lib/firebaseConfig';
import { toast } from 'sonner';

const ACTIVE_STATUSES = ['pending', 'confirmed', 'preparing', 'pickup_ready', 'in_transit'];

const TABS = [
  { id: 'orders',    label: 'Orders',        icon: ShoppingBag },
  { id: 'inventory', label: 'Inventory',     icon: Package },
  { id: 'history',   label: 'Order History', icon: History },
  { id: 'map',       label: 'Delivery Map',  icon: Map, advanced: true },
  { id: 'revenue',   label: 'Revenue',       icon: DollarSign, advanced: true },
  { id: 'analytics', label: 'Analytics',     icon: BarChart2, advanced: true },
  { id: 'compliance', label: 'Compliance',   icon: ShieldCheck, advanced: true },
  { id: 'settings',  label: 'Settings',      icon: Settings, advanced: true },
];

export default function StoreOwnerDashboard() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.find(item => item.id === params.get('tab'))?.id || 'orders';
  const [showTools, setShowTools] = useState(false);
  const setTab = id => setParams(previous => { const next = new URLSearchParams(previous); next.set('tab', id); return next; });
  const selectedStore = params.get('store_id') || '';
  const [selectedOrderId, setSelectedOrderId] = useState(null);

  const { data: user, isLoading: userLoading, isError: userError, refetch: reloadUser } = useQuery({
    queryKey: ['me'],
    queryFn: () => base44.auth.me(),
  });

  const { data: allStores = [], isLoading: storesLoading, isError: storesError, refetch: reloadStores } = useOwnerStores(user);
  const storageKey = `owner-selected-store:${user?.id || user?.email || ''}`;
  const rememberedStore = localStorage.getItem(storageKey);
  const email = user?.email?.trim().toLowerCase();
  const preferredStore = allStores.find(store => email && [store.email, ...(store.contact_emails || [])].some(contact => contact?.trim().toLowerCase() === email))
    || (user?.role === 'admin' && allStores.find(store => /beverage king/i.test(store.name))) || allStores[0];
  const resolvedStore = [selectedStore, rememberedStore, preferredStore?.id].find(id => allStores.some(store => store.id === id)) || '';
  const setSelectedStore = id => {
    localStorage.setItem(storageKey, id);
    setSelectedOrderId(null);
    setParams(previous => { const next = new URLSearchParams(previous); next.set('store_id', id); return next; });
  };
  const storeObj = allStores.find(s => s.id === resolvedStore);
  const storeName = storeObj?.name || '';

  // Active orders used by the map tab
  const { data: activeOrders = [], isError: ordersError, refetch: reloadOrders } = useQuery({
    queryKey: ['store-active-orders', resolvedStore],
    queryFn: async () => {
      const { data } = await base44.functions.invoke('getStoreActiveOrders', { store_id: resolvedStore });
      if (data?.error || !Array.isArray(data?.orders)) throw new Error(data?.error || 'Could not load store orders.');
      return data.orders;
    },
    enabled: !!resolvedStore,
    refetchInterval: 15000,
  });

  const queryClient = useQueryClient();

  const acceptMutation = useMutation({
    mutationFn: async ({ id }) => {
      const { data } = await base44.functions.invoke('updateRetailerOrderStatus', { order_id: id, status: 'confirmed' });
      if (data?.success !== true) throw new Error(data?.error || 'Order acceptance was not confirmed.');
      return data;
    },
    onSuccess: () => Promise.all(['store-active-orders', 'retailer-active-orders'].map(key => queryClient.invalidateQueries({ queryKey: [key, resolvedStore] }))),
    onError: error => toast.error(error?.response?.data?.error || error.message),
  });

  // Real-time push: refresh orders instantly when an order is created or updated
  useEffect(() => {
    const unsubscribe = base44.entities.Order.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['store-active-orders', resolvedStore] });
    });
    return unsubscribe;
  }, [resolvedStore, queryClient]);

  const isLoading = userLoading || storesLoading;

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading your dashboard…
    </div>
  );

  if (userError || storesError) return <div role="alert" className="p-8 space-y-3 text-center"><p className="text-destructive">Could not load your store dashboard.</p><Button variant="outline" onClick={() => { reloadUser(); if (user) reloadStores(); }}>Try again</Button></div>;

  if (allStores.length === 0) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <AlertCircle className="w-12 h-12 text-muted-foreground/40 mb-4" />
      <h2 className="font-display text-xl font-bold mb-2">No Store Found</h2>
      <p className="text-muted-foreground text-sm max-w-xs">
        Your account isn't linked to any store yet. Your login must match the store's primary email or one of its saved contact emails; contact the administrator to link it.
      </p>
      <div className="mt-4"><RetailerDirectContact /></div>
    </div>
  );

  return (
    <div className="flex flex-col h-full min-h-screen md:min-h-0">
      <PendingOrderAlert orders={activeOrders} onAccept={(o) => acceptMutation.mutateAsync({ id: o.id })} />
      {/* Header */}
      <div className="px-4 pt-6 pb-4 flex flex-wrap items-center justify-between gap-3 border-b">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="font-display text-xl font-bold">Store Orders</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{storeName}</p>
          </div>
          {activeOrders.length > 0 && (
            <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              {activeOrders.length} active
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <FCMSetup
            firebaseConfig={FIREBASE_CONFIG}
            vapidKey={FIREBASE_VAPID_KEY}
            storeId={resolvedStore}
          />
          {allStores.length > 1 && (
            <Select value={resolvedStore} onValueChange={setSelectedStore}>
              <SelectTrigger className="w-48 h-9">
                <Store className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Select store" />
              </SelectTrigger>
              <SelectContent>
                {allStores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
        <p className="text-muted-foreground">{storeObj?.is_active && storeObj?.onboarding_status === 'live' ? 'Recorded store status: live' : 'Store setup is still under review.'}</p>
        <Button asChild variant="outline"><Link to={'/onboarding?store_id=' + encodeURIComponent(resolvedStore)}>Review store setup</Link></Button>
      </div>
      <div className="px-4 py-3 shrink-0 space-y-3"><RetailerDirectContact /><RetailerChatButton key={resolvedStore} storeId={resolvedStore} storeName={storeName} /></div>

      {/* Tabs */}
      <div className="flex gap-0 border-b overflow-x-auto shrink-0 px-4">
        {TABS.filter(t => !t.advanced || showTools || t.id === tab).map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors',
                tab === t.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="w-4 h-4" />
              {t.label}
              {t.id === 'orders' && activeOrders.length > 0 && (
                <span className="ml-0.5 bg-primary text-primary-foreground text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {activeOrders.length}
                </span>
              )}
            </button>
          );
        })}
        <button type="button" aria-expanded={showTools} onClick={() => setShowTools(value => !value)} className="min-h-11 whitespace-nowrap px-4 py-3 text-sm font-medium text-primary">{showTools ? 'Fewer tools' : 'More tools'}</button>
      </div>

      {ordersError && <div role="alert" className="px-4 py-3 text-sm text-destructive">Could not load live orders. The store map is still available. <Button variant="outline" size="sm" onClick={() => reloadOrders()}>Retry orders</Button></div>}
      {/* Live Map Tab — full-height split layout */}
      {tab === 'map' && (
        <div className="flex flex-col md:flex-row flex-1 min-h-0 md:overflow-hidden md:h-[560px] md:flex-none">
          {/* Sidebar */}
          <div className="w-full md:w-72 max-h-64 md:max-h-none shrink-0 border-b md:border-b-0 md:border-r bg-card overflow-y-auto">
            <MapOrderSidebar
              orders={activeOrders}
              selectedOrderId={selectedOrderId}
              onSelectOrder={setSelectedOrderId}
              storeId={resolvedStore}
            />
          </div>
          {/* Map */}
          <div className="flex-1 min-w-0 min-h-[360px] p-3">
            <StoreOrderMap
              orders={activeOrders}
              store={storeObj}
              selectedOrderId={selectedOrderId}
              onSelectOrder={setSelectedOrderId}
            />
          </div>
        </div>
      )}

      {/* Other tabs */}
      {tab !== 'map' && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 py-6">
            {tab === 'orders'    && <ActiveOrdersPanel storeId={resolvedStore} storeName={storeName} />}
            {tab === 'history'   && <StoreOrderHistory storeId={resolvedStore} storeName={storeName} />}
            {tab === 'revenue'   && <StoreRevenuePanel storeId={resolvedStore} />}
            {tab === 'inventory' && storeObj && (
              <div className="space-y-4">
                <CityHiveConnectionPanel storeId={resolvedStore} />
                <RetailerInventoryWorkspace key={resolvedStore} store={storeObj} />
              </div>
            )}
            {tab === 'analytics' && <StoreAnalyticsPanel storeId={resolvedStore} />}
            {tab === 'compliance' && <StoreCompliancePanel storeId={resolvedStore} />}
            {tab === 'settings'  && <StoreSettingsPanel storeId={resolvedStore} />}
          </div>
        </div>
      )}
    </div>
  );
}