import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Store, MapPin, Package, Truck, AlertCircle, CheckCircle2, Layers, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import DispatchOverlayMap from '@/components/admin/DispatchOverlayMap';
import StatusBadge from '@/components/shared/StatusBadge';
import { format } from 'date-fns';

const ACTIVE_STATUSES = ['pending', 'confirmed', 'preparing', 'pickup_ready', 'in_transit'];

const STATUS_COLOR = {
  pending:      'bg-amber-100 text-amber-700',
  confirmed:    'bg-blue-100 text-blue-700',
  preparing:    'bg-violet-100 text-violet-700',
  pickup_ready: 'bg-orange-100 text-orange-700',
  in_transit:   'bg-emerald-100 text-emerald-700',
};

function StatPill({ icon: Icon, label, value, color }) {
  return (
    <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 ${color}`}>
      <Icon className="w-4 h-4 shrink-0" />
      <div>
        <p className="text-xl font-bold leading-none">{value}</p>
        <p className="text-xs mt-0.5 opacity-75">{label}</p>
      </div>
    </div>
  );
}

export default function DispatchMap() {
  const queryClient = useQueryClient();
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [filterStatus, setFilterStatus] = useState('all');

  const { data: stores = [], isLoading: storesLoading } = useQuery({
    queryKey: ['dispatch-map-stores'],
    queryFn: () => base44.entities.Store.filter({ is_active: true }),
  });

  const { data: zones = [], isLoading: zonesLoading } = useQuery({
    queryKey: ['dispatch-map-zones'],
    queryFn: () => base44.entities.DeliveryZone.filter({ is_active: true }),
  });

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['dispatch-map-orders'],
    queryFn: () => base44.entities.Order.filter({ status: { $in: ACTIVE_STATUSES } }),
    refetchInterval: 10000,
    onSuccess: () => setLastUpdated(new Date()),
  });

  const { data: drivers = [], isLoading: driversLoading } = useQuery({
    queryKey: ['dispatch-map-drivers'],
    queryFn: () => base44.entities.Driver.filter({ status: { $in: ['available', 'on_delivery'] } }),
    refetchInterval: 10000,
  });

  // Real-time order updates
  useEffect(() => {
    const unsub = base44.entities.Order.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['dispatch-map-orders'] });
      setLastUpdated(new Date());
    });
    return unsub;
  }, []);

  // Real-time driver location updates
  useEffect(() => {
    const unsub = base44.entities.Driver.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['dispatch-map-drivers'] });
    });
    return unsub;
  }, []);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['dispatch-map-orders'] });
    setLastUpdated(new Date());
  };

  const filteredOrders = filterStatus === 'all' ? orders : orders.filter(o => o.status === filterStatus);

  const unassigned = orders.filter(o => !o.driver_id && ['confirmed', 'preparing', 'pickup_ready'].includes(o.status));
  const inTransit = orders.filter(o => o.status === 'in_transit');
  const pending = orders.filter(o => o.status === 'pending');

  const availableDrivers = drivers.filter(d => d.status === 'available');
  const onDeliveryDrivers = drivers.filter(d => d.status === 'on_delivery');

  const isLoading = storesLoading || zonesLoading || ordersLoading || driversLoading;

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-screen-2xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link to="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2">
              <ArrowLeft className="w-4 h-4" /> Back to Admin
            </Link>
            <h1 className="font-display text-3xl font-bold flex items-center gap-2">
              <Layers className="w-7 h-7 text-primary" /> Dispatch Efficiency Map
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Live overlay — delivery zones, stores &amp; active order locations
              <span className="ml-3 text-xs text-emerald-600 font-medium">
                Updated {format(lastUpdated, 'h:mm:ss a')}
              </span>
            </p>
          </div>
          <button
            onClick={refresh}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground border rounded-lg px-3 py-1.5 transition-colors shrink-0"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatPill icon={Store}        label="Active Stores"   value={stores.length}               color="bg-card border-border text-foreground" />
          <StatPill icon={MapPin}       label="Delivery Zones"  value={zones.length}                color="bg-blue-50 border-blue-200 text-blue-800" />
          <StatPill icon={Package}      label="Active Orders"   value={orders.length}               color="bg-violet-50 border-violet-200 text-violet-800" />
          <StatPill icon={AlertCircle}  label="Unassigned"      value={unassigned.length}           color={unassigned.length > 0 ? "bg-red-50 border-red-200 text-red-800" : "bg-card border-border text-foreground"} />
          <StatPill icon={Truck}        label="In Transit"      value={inTransit.length}            color="bg-emerald-50 border-emerald-200 text-emerald-800" />
          <StatPill icon={Users}        label="Active Drivers"  value={drivers.length}              color="bg-sky-50 border-sky-200 text-sky-800" />
        </div>

        {/* Status filter tabs */}
        <div className="flex flex-wrap gap-2">
          {['all', ...ACTIVE_STATUSES].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors capitalize ${
                filterStatus === s
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-muted-foreground border-border hover:bg-muted'
              }`}
            >
              {s === 'all' ? `All (${orders.length})` : `${s.replace('_', ' ')} (${orders.filter(o => o.status === s).length})`}
            </button>
          ))}
        </div>

        {/* Map + sidebar */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
          {/* Map */}
          <div className="xl:col-span-3">
            {isLoading ? (
              <Skeleton className="h-[560px] rounded-xl" />
            ) : (
              <DispatchOverlayMap
                stores={stores}
                zones={zones}
                orders={filteredOrders}
                drivers={drivers}
                height="560px"
              />
            )}
          </div>

          {/* Sidebar: order list */}
          <div className="xl:col-span-1 flex flex-col gap-4">

            {/* Unassigned alert */}
            {unassigned.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-sm font-semibold text-red-700 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" /> {unassigned.length} Unassigned
                </p>
                <p className="text-xs text-red-600 mt-0.5">Orders need a driver assigned</p>
              </div>
            )}

            {/* Order list */}
            <div className="bg-card border rounded-xl overflow-hidden flex flex-col" style={{ maxHeight: '510px' }}>
              <div className="px-4 py-3 border-b">
                <p className="font-semibold text-sm">Active Orders</p>
                <p className="text-xs text-muted-foreground">{filteredOrders.length} showing</p>
              </div>
              <div className="overflow-y-auto flex-1">
                {filteredOrders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <CheckCircle2 className="w-8 h-8 mb-2 text-emerald-400" />
                    <p className="text-sm">No active orders</p>
                  </div>
                ) : (
                  filteredOrders.map(order => (
                    <div key={order.id} className="px-4 py-3 border-b last:border-0 hover:bg-muted/40 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold">{order.order_number}</p>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[order.status] || 'bg-muted text-muted-foreground'}`}>
                          {order.status?.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{order.delivery_address}</p>
                      <div className="flex items-center justify-between mt-1.5">
                        <p className="text-xs text-primary font-medium">
                          {order.driver_name ? `🚗 ${order.driver_name}` : <span className="text-red-500">⚠️ No driver</span>}
                        </p>
                        <p className="text-xs font-bold">${order.total?.toFixed(2)}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{order.store_name}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Active drivers panel */}
            <div className="bg-card border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <p className="font-semibold text-sm">Active Drivers</p>
                <span className="text-xs font-medium text-sky-700 bg-sky-100 rounded-full px-2 py-0.5">{drivers.length} online</span>
              </div>
              <div className="divide-y max-h-48 overflow-y-auto">
                {drivers.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-4 py-3">No drivers online</p>
                ) : (
                  drivers.map(driver => {
                    const driverOrder = orders.find(o => o.driver_name === driver.name && o.status === 'in_transit');
                    return (
                      <div key={driver.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate">{driver.name}</p>
                          {driverOrder ? (
                            <p className="text-[10px] text-emerald-600 truncate">🚗 {driverOrder.order_number} — {driverOrder.delivery_address?.split(',')[0]}</p>
                          ) : (
                            <p className="text-[10px] text-muted-foreground">Standing by</p>
                          )}
                        </div>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                          driver.status === 'on_delivery' ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'
                        }`}>
                          {driver.status === 'on_delivery' ? 'Delivering' : 'Available'}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Zone summary */}
            <div className="bg-card border rounded-xl p-4">
              <p className="font-semibold text-sm mb-3">Zone Coverage</p>
              <div className="space-y-2">
                {zones.slice(0, 6).map(zone => {
                  function inZone(lat, lng) {
                    if (!lat || !zone.center_latitude || !zone.radius_miles) return false;
                    const R = 3958.8;
                    const dLat = (lat - zone.center_latitude) * Math.PI / 180;
                    const dLng = (lng - zone.center_longitude) * Math.PI / 180;
                    const a = Math.sin(dLat / 2) ** 2 + Math.cos(zone.center_latitude * Math.PI / 180) * Math.cos(lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
                    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) <= zone.radius_miles;
                  }
                  const zoneOrders = orders.filter(o => inZone(o.delivery_latitude, o.delivery_longitude));
                  const zoneDrivers = drivers.filter(d => inZone(d.current_latitude, d.current_longitude));
                  return (
                    <div key={zone.id} className="flex items-center justify-between text-xs gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${zone.is_wet ? 'bg-blue-500' : 'bg-red-400'}`} />
                        <span className="truncate text-muted-foreground">{zone.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-medium text-violet-700">{zoneOrders.length} orders</span>
                        <span className="font-medium text-sky-700">{zoneDrivers.length} 🚗</span>
                      </div>
                    </div>
                  );
                })}
                {zones.length === 0 && <p className="text-xs text-muted-foreground">No zones configured</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}