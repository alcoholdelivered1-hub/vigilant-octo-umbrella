import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Truck, MapPin, Clock, AlertCircle, CheckCircle2, Zap, Map } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format, addMinutes } from 'date-fns';

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'bg-slate-100 text-slate-800', icon: Clock },
  confirmed: { label: 'Confirmed', color: 'bg-blue-100 text-blue-800', icon: CheckCircle2 },
  preparing: { label: 'Preparing', color: 'bg-amber-100 text-amber-800', icon: Zap },
  pickup_ready: { label: 'Ready for Pickup', color: 'bg-orange-100 text-orange-800', icon: Truck },
  in_transit: { label: 'Out for Delivery', color: 'bg-primary/10 text-primary', icon: Truck },
  delivered: { label: 'Delivered', color: 'bg-emerald-100 text-emerald-800', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', color: 'bg-destructive/10 text-destructive', icon: AlertCircle },
  refused: { label: 'Refused', color: 'bg-red-100 text-red-800', icon: AlertCircle },
};

const ETA_MINUTES = {
  pending: 20,
  confirmed: 15,
  preparing: 10,
  pickup_ready: 15,
  in_transit: 20,
};

export default function ActiveDeliveries() {
  const [selectedZone, setSelectedZone] = useState('all');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch active orders
  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['active-orders'],
    queryFn: async () => {
      const active = await base44.entities.Order.filter({
        status: { $in: ['pending', 'confirmed', 'preparing', 'pickup_ready', 'in_transit'] }
      });
      return active.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    },
    refetchInterval: autoRefresh ? 10000 : false,
  });

  // Fetch zones for filtering
  const { data: zones = [] } = useQuery({
    queryKey: ['wet-zones'],
    queryFn: () => base44.entities.DeliveryZone.filter({ is_wet: true, is_active: true }),
  });

  // Real-time subscription
  useEffect(() => {
    const unsub = base44.entities.Order.subscribe(() => {
      // Subscription triggers query invalidation
    });
    return unsub;
  }, []);

  // Filter orders by zone
  const filteredOrders = selectedZone === 'all'
    ? orders
    : orders.filter(order => {
        const zone = zones.find(z => z.county === selectedZone);
        if (!zone) return false;
        // Simple distance check - in production use actual geolocation
        return true;
      });

  // Calculate stats
  const stats = {
    active: filteredOrders.filter(o => ['in_transit', 'pickup_ready'].includes(o.status)).length,
    preparing: filteredOrders.filter(o => ['confirmed', 'preparing'].includes(o.status)).length,
    pending: filteredOrders.filter(o => o.status === 'pending').length,
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Link to="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
              <ArrowLeft className="w-4 h-4" />
              Back to Admin
            </Link>
            <h1 className="font-display text-3xl font-bold">Active Deliveries</h1>
            <p className="text-muted-foreground mt-1">Real-time order tracking and driver assignments</p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/admin/live-map">
              <Button variant="outline" size="sm">
                <Map className="w-4 h-4 mr-1.5" /> Live Map
              </Button>
            </Link>
            <Button
              variant={autoRefresh ? 'default' : 'outline'}
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              {autoRefresh ? '🔄 Live' : 'Paused'}
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'In Transit', value: stats.active, color: 'text-primary' },
            { label: 'Preparing', value: stats.preparing, color: 'text-amber-600' },
            { label: 'Pending Confirmation', value: stats.pending, color: 'text-slate-600' },
          ].map((stat, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Filter by Zone</label>
            <Select value={selectedZone} onValueChange={setSelectedZone}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Zones</SelectItem>
                {zones.map(zone => (
                  <SelectItem key={zone.id} value={zone.county}>
                    {zone.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Orders List */}
        <div className="space-y-3">
          {ordersLoading ? (
            <>
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-32 rounded-2xl" />
              ))}
            </>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-12 bg-card rounded-2xl border">
              <p className="text-muted-foreground">No active deliveries at this time</p>
            </div>
          ) : (
            filteredOrders.map(order => {
              const statusConfig = STATUS_CONFIG[order.status];
              const StatusIcon = statusConfig.icon;
              const etaMinutes = ETA_MINUTES[order.status] || 20;
              const eta = addMinutes(new Date(order.created_date), etaMinutes);
              const isOverdue = new Date() > eta && !['delivered', 'cancelled', 'refused'].includes(order.status);

              return (
                <Card key={order.id} className={isOverdue ? 'border-destructive/50 bg-destructive/5' : ''}>
                  <CardContent className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                      {/* Order Info */}
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground font-semibold uppercase">Order</p>
                        <Link to={`/track?orderId=${order.id}`} className="text-sm font-bold hover:text-primary">
                          {order.order_number}
                        </Link>
                        <p className="text-xs text-muted-foreground">{order.store_name}</p>
                      </div>

                      {/* Status */}
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground font-semibold uppercase">Status</p>
                        <Badge className={statusConfig.color}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {statusConfig.label}
                        </Badge>
                      </div>

                      {/* Driver */}
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground font-semibold uppercase">Driver</p>
                        {order.driver_name ? (
                          <>
                            <p className="text-sm font-medium flex items-center gap-1.5">
                              <Truck className="w-4 h-4 text-primary" />
                              {order.driver_name}
                            </p>
                            {order.driver_id && (
                              <p className="text-xs text-muted-foreground">{order.driver_id.slice(0, 8)}</p>
                            )}
                          </>
                        ) : (
                          <p className="text-xs text-amber-600">Unassigned</p>
                        )}
                      </div>

                      {/* Delivery Address */}
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground font-semibold uppercase">Delivery</p>
                        <p className="text-sm flex items-start gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                          <span className="line-clamp-2">{order.delivery_address}</span>
                        </p>
                      </div>

                      {/* ETA */}
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground font-semibold uppercase">ETA</p>
                        <p className={`text-sm font-bold flex items-center gap-1.5 ${isOverdue ? 'text-destructive' : 'text-primary'}`}>
                          <Clock className="w-4 h-4" />
                          {format(eta, 'h:mm a')}
                        </p>
                        {isOverdue && (
                          <p className="text-xs text-destructive font-semibold flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Overdue
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Order Items */}
                    {order.items?.length > 0 && (
                      <div className="mt-4 pt-4 border-t space-y-1">
                        {order.items.slice(0, 2).map((item, i) => (
                          <p key={i} className="text-xs text-muted-foreground">
                            {item.quantity}× {item.product_name}
                          </p>
                        ))}
                        {order.items.length > 2 && (
                          <p className="text-xs text-muted-foreground font-semibold">+{order.items.length - 2} more items</p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}