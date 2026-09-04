import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Store, Package, Settings, ShoppingBag, Loader2, AlertCircle, Map, BarChart2, ShieldCheck, History, DollarSign, LogIn, UserPlus, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ActiveOrdersPanel from '@/components/partner/ActiveOrdersPanel';
import StoreOrderAlerts from '@/components/partner/StoreOrderAlerts';
import InventoryManagerPanel from '@/components/partner/InventoryManagerPanel';
import StoreSettingsPanel from '@/components/partner/StoreSettingsPanel';
import StoreOrderMap from '@/components/partner/StoreOrderMap';
import MapOrderSidebar from '@/components/partner/MapOrderSidebar';
import StoreAnalyticsPanel from '@/components/partner/StoreAnalyticsPanel';
import StoreCompliancePanel from '@/components/partner/StoreCompliancePanel';
import StoreOrderHistory from '@/components/partner/StoreOrderHistory';
import StoreRevenuePanel from '@/components/partner/StoreRevenuePanel';
import CloverConnect from '@/pages/partner/CloverConnect';
import { cn } from '@/lib/utils';
import FCMSetup from '@/components/notifications/FCMSetup';
import { FIREBASE_CONFIG, FIREBASE_VAPID_KEY } from '@/lib/firebaseConfig';

const ACTIVE_STATUSES = ['pending', 'confirmed', 'preparing', 'pickup_ready', 'in_transit'];

const TABS = [
  { id: 'map',       label: 'Live Map',      icon: Map },
  { id: 'orders',    label: 'Orders List',   icon: ShoppingBag },
  { id: 'history',   label: 'Order History', icon: History },
  { id: 'revenue',   label: 'Revenue',       icon: DollarSign },
  { id: 'inventory', label: 'Inventory',     icon: Package },
  { id: 'analytics', label: 'Analytics',     icon: BarChart2 },
  { id: 'compliance', label: 'Compliance',   icon: ShieldCheck },
  { id: 'clover',     label: 'Clover POS',     icon: CreditCard },
  { id: 'settings',  label: 'Settings',      icon: Settings },
];

export default function StoreOwnerDashboard() {
  const [tab, setTab] = useState('map');
  const [selectedStore, setSelectedStore] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState(null);

  const { data: user, isLoading: userLoading, isError: authError } = useQuery({
    queryKey: ['me'],
    queryFn: () => base44.auth.me(),
    retry: false,
  });

  const { data: allStores = [], isLoading: storesLoading } = useQuery({
    queryKey: ['owner-stores', user?.email, user?.role],
    queryFn: async () => {
      if (user?.role === 'admin') {
        return base44.entities.Store.filter({ is_active: true }, 'name', 100);
      }
      return base44.entities.Store.filter({ email: user.email }, 'name', 100);
    },
    enabled: !!user,
  });

  // Not logged in — show login/register prompt instead of "No Store Found"
  const isNotLoggedIn = authError && !user;

  useEffect(() => {
    if (allStores.length > 0 && !selectedStore) {
      setSelectedStore(allStores[0].id);
    }
  }, [allStores]);

  const resolvedStore = selectedStore || allStores[0]?.id || '';
  const storeObj = allStores.find(s => s.id === resolvedStore);
  const storeName = storeObj?.name || '';

  // Active orders used by the map tab
  const { data: activeOrders = [] } = useQuery({
    queryKey: ['store-active-orders', resolvedStore],
    queryFn: () => base44.entities.Order.filter({ store_id: resolvedStore }, '-created_date', 100),
    select: data => data.filter(o => ACTIVE_STATUSES.includes(o.status)),
    enabled: !!resolvedStore,
    refetchInterval: 15000,
  });

  const isLoading = userLoading || storesLoading;

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading your dashboard…
    </div>
  );

  if (isNotLoggedIn) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <Store className="w-8 h-8 text-primary" />
      </div>
      <h2 className="font-display text-2xl font-bold mb-2">Store Dashboard Access</h2>
      <p className="text-muted-foreground text-sm max-w-md mb-6">
        You need to register and log in with the email your store is registered under to access your dashboard.
      </p>
      <div className="flex items-center gap-3">
        <Link to="/register">
          <Button className="gap-2">
            <UserPlus className="w-4 h-4" /> Register
          </Button>
        </Link>
        <Link to="/login">
          <Button variant="outline" className="gap-2">
            <LogIn className="w-4 h-4" /> Log In
          </Button>
        </Link>
      </div>
      <p className="text-xs text-muted-foreground mt-4 max-w-sm">
        Use the same email that's on file for your store. If you're not sure which email that is, contact the administrator.
      </p>
    </div>
  );

  if (allStores.length === 0) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <AlertCircle className="w-12 h-12 text-muted-foreground/40 mb-4" />
      <h2 className="font-display text-xl font-bold mb-2">No Store Found</h2>
      <p className="text-muted-foreground text-sm max-w-xs">
        Your account isn't linked to any store yet. Make sure your store's notification email matches your login email, or contact the administrator.
      </p>
    </div>
  );

  return (
    <div className="flex flex-col h-full min-h-screen md:min-h-0">
      {/* Header */}
      <div className="px-4 pt-6 pb-4 flex flex-wrap items-center justify-between gap-3 border-b">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="font-display text-xl font-bold">Store Dashboard</h1>
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

      {/* Real-time incoming order alerts */}
      <StoreOrderAlerts
        storeIds={allStores.map(s => s.id)}
        storeNames={Object.fromEntries(allStores.map(s => [s.id, s.name]))}
      />

      {/* Tabs */}
      <div className="flex gap-0 border-b overflow-x-auto shrink-0 px-4">
        {TABS.map(t => {
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
              {t.id === 'map' && activeOrders.length > 0 && (
                <span className="ml-0.5 bg-primary text-primary-foreground text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {activeOrders.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Live Map Tab — full-height split layout */}
      {tab === 'map' && (
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Sidebar */}
          <div className="w-72 shrink-0 border-r bg-card overflow-y-auto">
            <MapOrderSidebar
              orders={activeOrders}
              selectedOrderId={selectedOrderId}
              onSelectOrder={setSelectedOrderId}
              storeId={resolvedStore}
            />
          </div>
          {/* Map */}
          <div className="flex-1 min-w-0 p-3">
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
            {tab === 'inventory' && <InventoryManagerPanel storeId={resolvedStore} />}
            {tab === 'analytics' && <StoreAnalyticsPanel storeId={resolvedStore} />}
            {tab === 'compliance' && <StoreCompliancePanel storeId={resolvedStore} />}
            {tab === 'clover'     && <CloverConnect storeId={resolvedStore} />}
            {tab === 'settings'  && <StoreSettingsPanel storeId={resolvedStore} />}
          </div>
        </div>
      )}
    </div>
  );
}