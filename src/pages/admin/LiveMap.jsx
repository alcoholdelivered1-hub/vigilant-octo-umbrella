import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowLeft, Truck, Package, RefreshCw, MapPin, Clock, Flame } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import LiveDriverMap from '@/components/admin/LiveDriverMap';
import StatusBadge from '@/components/shared/StatusBadge';
import { format } from 'date-fns';

export default function LiveMap() {
  const queryClient = useQueryClient();
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['live-map-orders'],
    queryFn: () => base44.entities.Order.filter({ status: { $in: ['in_transit', 'pickup_ready', 'preparing', 'confirmed'] } }),
    refetchInterval: 8000,
    onSuccess: () => setLastUpdated(new Date()),
  });

  const { data: drivers = [], isLoading: driversLoading } = useQuery({
    queryKey: ['live-map-drivers'],
    queryFn: () => base44.entities.Driver.filter({ status: { $in: ['available', 'on_delivery'] } }),
    refetchInterval: 8000,
  });

  // Real-time subscriptions
  useEffect(() => {
    const u1 = base44.entities.Order.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['live-map-orders'] });
      setLastUpdated(new Date());
    });
    const u2 = base44.entities.Driver.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['live-map-drivers'] });
    });
    return () => { u1(); u2(); };
  }, []);

  const inTransit = orders.filter(o => o.status === 'in_transit');
  const driversWithLocation = drivers.filter(d => d.current_latitude || orders.find(o => o.driver_id === d.id && o.driver_current_latitude));

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Link to="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
              <ArrowLeft className="w-4 h-4" /> Back to Admin
            </Link>
            <h1 className="font-display text-3xl font-bold">Live Driver Map</h1>
            <p className="text-muted-foreground mt-1">
              Real-time locations &amp; delivery routes
              <span className="ml-3 text-xs text-emerald-600 font-medium">
                Updated {format(lastUpdated, 'h:mm:ss a')}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/admin/demand-heatmap"
              className="flex items-center gap-1.5 text-sm font-medium text-orange-600 hover:text-orange-700 border border-orange-200 bg-orange-50 hover:bg-orange-100 rounded-lg px-3 py-1.5 transition-colors"
            >
              <Flame className="w-4 h-4" /> Demand Heatmap
            </Link>
            <button
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ['live-map-orders'] });
                queryClient.invalidateQueries({ queryKey: ['live-map-drivers'] });
                setLastUpdated(new Date());
              }}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground border rounded-lg px-3 py-1.5 transition-colors"
            >
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Active Drivers', value: driversWithLocation.length, icon: Truck, color: 'text-primary' },
            { label: 'In Transit', value: inTransit.length, icon: Package, color: 'text-blue-600' },
            { label: 'Pickup Ready', value: orders.filter(o => o.status === 'pickup_ready').length, icon: MapPin, color: 'text-amber-600' },
            { label: 'Preparing', value: orders.filter(o => ['preparing', 'confirmed'].includes(o.status)).length, icon: Clock, color: 'text-slate-600' },
          ].map((s, i) => (
            <Card key={i}>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3">
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                  <div>
                    <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Map */}
        {ordersLoading || driversLoading ? (
          <Skeleton className="h-[520px] rounded-xl" />
        ) : (
          <LiveDriverMap height="520px" />
        )}

        {/* Active deliveries list below map */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* In-transit orders */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Truck className="w-4 h-4 text-primary" /> In Transit ({inTransit.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {inTransit.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No deliveries in transit</p>
              ) : inTransit.map(order => (
                <div key={order.id} className="flex items-start justify-between gap-3 p-3 bg-muted/40 rounded-lg">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{order.order_number}</p>
                    <p className="text-xs text-muted-foreground truncate">{order.delivery_address}</p>
                    <p className="text-xs text-primary font-medium mt-0.5">{order.driver_name || 'Unassigned'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold">${order.total?.toFixed(2)}</p>
                    <StatusBadge status={order.status} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Active drivers */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" /> Active Drivers ({drivers.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {drivers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No active drivers</p>
              ) : drivers.map(driver => {
                const currentOrder = orders.find(o => o.driver_id === driver.id);
                const hasLocation = driver.current_latitude || (currentOrder?.driver_current_latitude);
                return (
                  <div key={driver.id} className="flex items-center justify-between gap-3 p-3 bg-muted/40 rounded-lg">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-primary">
                          {driver.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{driver.name}</p>
                        {currentOrder
                          ? <p className="text-xs text-primary truncate">→ {currentOrder.order_number}</p>
                          : <p className="text-xs text-muted-foreground">No active order</p>
                        }
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {hasLocation && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" title="GPS active" />
                      )}
                      <StatusBadge status={driver.status} />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}